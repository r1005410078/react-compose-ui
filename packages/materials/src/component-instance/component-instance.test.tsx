import {
  COMPOSE_COMPONENT_MEDIA_TYPE,
  createComposeGroupEntitySeed,
  createEmptyComposePageDocument,
  getComposeGeometryConstraints,
  getComposeLayoutItem,
  getComposeRenderer,
  serializeComposeComponentAsset,
  type ComposeBaseComponentAsset,
  type ComposeComponentReference,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeResolvedComponentSnapshot,
  type JsonObject,
} from '@compose-ui/core'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createComposeBasicMaterials } from '../create-basic-materials'
import { ComposeComponentInstanceNestProvider } from './nest-context'

const reference: ComposeComponentReference = {
  kind: 'component',
  providerId: 'memory',
  assetKey: 'Components/Card.component.json',
  scope: 'persistent',
}

function componentDocument(): ComposeDocument {
  const materials = createComposeBasicMaterials()
  const rectangleSeed = materials.registry.createSeed('rectangle')
  if (!rectangleSeed.ok) throw new Error(rectangleSeed.error.message)
  const rectangle: ComposeEntity = {
    id: 'rectangle',
    ...rectangleSeed.seed,
    components: {
      ...rectangleSeed.seed.components,
      LayoutItem: {
        ...rectangleSeed.seed.components.LayoutItem,
        offset: { x: 10, y: 8 },
      },
    },
  }
  const group = createComposeGroupEntitySeed({
    id: 'component-root',
    name: 'Card',
    childIds: [rectangle.id],
    size: { width: 120, height: 80 },
  })
  // 组件根就地升格为 Frame：Component Asset v2 要求单根是 Frame。
  return {
    ...createEmptyComposePageDocument(),
    rootIds: [group.id],
    entities: {
      [group.id]: {
        ...group,
        components: {
          ...group.components,
          Frame: { size: { width: 120, height: 80 }, guides: [] },
        },
      },
      [rectangle.id]: rectangle,
    },
  }
}

function baseAsset(): ComposeBaseComponentAsset {
  return {
    schemaVersion: 2,
    kind: 'base',
    componentId: 'card',
    name: 'Card',
    document: componentDocument(),
  }
}

function snapshot(): ComposeResolvedComponentSnapshot {
  return {
    componentId: 'card',
    kind: 'base',
    revision: '1',
    document: componentDocument(),
    appliedLineage: [{
      reference,
      componentId: 'card',
      kind: 'base',
      revision: '1',
    }],
  }
}

function instanceProps() {
  return {
    reference,
    resolvedSnapshot: snapshot(),
    propertyOverrides: {},
  } as unknown as JsonObject
}

afterEach(cleanup)

describe('OpenSpec: basic-materials / 关联组件实例物料', () => {
  it('注册隐藏的 component-instance Preset 并只接受组件媒体类型', () => {
    const materials = createComposeBasicMaterials()
    const preset = materials.registry.getPreset('component-instance')

    expect(preset).toMatchObject({ id: 'component-instance', paletteHidden: true })
    expect(preset?.assetDrop?.accepts({
      mediaType: COMPOSE_COMPONENT_MEDIA_TYPE,
      name: 'Card.component.json',
    })).toBe(true)
    expect(preset?.assetDrop?.accepts({
      mediaType: 'application/json',
      name: 'Card.component.json',
    })).toBe(false)
  })

  it('资源拖入创建 Hug、不可缩放的关联实例并保存离线快照', async () => {
    const materials = createComposeBasicMaterials()
    const preset = materials.registry.getPreset('component-instance')!
    const seed = await preset.assetDrop?.createSeed({
      reference,
      resolved: {
        blob: new Blob([serializeComposeComponentAsset(baseAsset())]),
        revision: '1',
        mediaType: COMPOSE_COMPONENT_MEDIA_TYPE,
      },
      name: 'Card.component.json',
    })
    if (!seed) throw new Error('component-instance seed is missing')

    const entity: ComposeEntity = { id: 'instance', ...seed }
    expect(getComposeRenderer(entity)).toMatchObject({
      type: 'component-instance',
      props: { reference, resolvedSnapshot: { componentId: 'card', revision: '1' } },
    })
    expect(getComposeLayoutItem(entity)).toMatchObject({
      width: { mode: 'hug', value: 120 },
      height: { mode: 'hug', value: 80 },
    })
    expect(getComposeGeometryConstraints(entity)).toEqual({
      movable: true,
      resize: 'free',
      rotatable: true,
    })
  })

  it('没有 Store 时仍使用保存快照渲染内部文档，编辑态不命中内部节点', async () => {
    const materials = createComposeBasicMaterials()
    const definition = materials.registry.getRenderer('component-instance')!
    const Renderer = definition.renderer
    const props = instanceProps()

    render(<Renderer
      authoredProps={props}
      entity={{ id: 'instance', name: 'Card', components: {} } as ComposeEntity}
      mode="editor"
      props={props}
      registry={materials.registry}
      renderer={{ type: 'component-instance', props }}
    />)

    const content = await screen.findByTestId('compose-component-instance-content')
    await waitFor(() => {
      expect(screen.getByTestId('compose-material-rectangle')).toBeInTheDocument()
    })
    expect(content).toHaveStyle({ pointerEvents: 'none' })
  })

  it('嵌套实体应用 Appearance 圆角与 overflow，Material 不盖默认蓝底', async () => {
    const materials = createComposeBasicMaterials()
    const Renderer = materials.registry.getRenderer('component-instance')!.renderer
    const base = componentDocument()
    const rectangle = base.entities.rectangle!
    // 模拟组件源里改过颜色与圆角的矩形。
    const sourceDocument: ComposeDocument = {
      ...base,
      entities: {
        ...base.entities,
        rectangle: {
          ...rectangle,
          components: {
            ...rectangle.components,
            Appearance: {
              backgroundPaint: { kind: 'solid', color: '#ef4444' },
              borderColor: 'transparent',
              borderWidth: 0,
              borderRadius: 24,
              opacity: 1,
              shadow: null,
            },
          },
        },
      },
    }
    const props = {
      reference,
      resolvedSnapshot: {
        componentId: 'card',
        kind: 'base',
        revision: '1',
        document: sourceDocument,
        appliedLineage: snapshot().appliedLineage,
      },
      instanceOverrides: { operations: [] },
    } as unknown as JsonObject

    render(<Renderer
      authoredProps={props}
      entity={{ id: 'instance', name: 'Card', components: {} } as ComposeEntity}
      mode="preview"
      props={props}
      registry={materials.registry}
      renderer={{ type: 'component-instance', props }}
    />)

    const node = await waitFor(() => {
      const el = globalThis.document.querySelector('[data-component-instance-entity-id="rectangle"]')
      if (!el) throw new Error('nested rectangle missing')
      return el as HTMLElement
    })
    // 叶子 overflow:hidden 才能用 border-radius 裁剪内部层。
    expect(node).toHaveStyle({
      borderRadius: '24px',
      backgroundColor: 'rgb(239, 68, 68)',
      overflow: 'hidden',
    })
    const material = screen.getByTestId('compose-material-rectangle')
    // Material 必须透明，否则会盖住 Appearance 并露出无圆角蓝块。
    expect(getComputedStyle(material).backgroundColor).toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)|transparent/)
  })

  it('按 instanceOverrides 的结构操作渲染', async () => {
    const materials = createComposeBasicMaterials()
    const Renderer = materials.registry.getRenderer('component-instance')!.renderer
    // 结构操作删除组件内部矩形，渲染结果必须反映操作后的结构而不是原始快照。
    const props = {
      reference,
      resolvedSnapshot: snapshot(),
      instanceOverrides: {
        properties: {},
        operations: [{ id: 'op-1', kind: 'remove-entity', entityId: 'rectangle' }],
      },
    } as unknown as JsonObject

    render(<Renderer
      authoredProps={props}
      entity={{ id: 'instance', name: 'Card', components: {} } as ComposeEntity}
      mode="editor"
      props={props}
      registry={materials.registry}
      renderer={{ type: 'component-instance', props }}
    />)

    await screen.findByTestId('compose-component-instance-content')
    await waitFor(() => {
      expect(screen.queryByTestId('compose-material-rectangle')).not.toBeInTheDocument()
    })
  })

  it('循环和超过八层时拒绝继续嵌套', () => {
    const materials = createComposeBasicMaterials()
    const Renderer = materials.registry.getRenderer('component-instance')!.renderer
    const props = instanceProps()
    const entity = { id: 'instance', name: 'Card', components: {} } as ComposeEntity

    const { rerender } = render(
      <ComposeComponentInstanceNestProvider
        ancestorKeys={[`${reference.providerId}:${reference.scope}:${reference.assetKey}`]}
        depth={1}
      >
        <Renderer
          authoredProps={props}
          entity={entity}
          mode="preview"
          props={props}
          registry={materials.registry}
          renderer={{ type: 'component-instance', props }}
        />
      </ComposeComponentInstanceNestProvider>,
    )
    expect(screen.getByTestId('compose-component-instance-cycle')).toHaveAttribute('role', 'alert')

    rerender(
      <ComposeComponentInstanceNestProvider ancestorKeys={[]} depth={8}>
        <Renderer
          authoredProps={props}
          entity={entity}
          mode="preview"
          props={props}
          registry={materials.registry}
          renderer={{ type: 'component-instance', props }}
        />
      </ComposeComponentInstanceNestProvider>,
    )
    expect(screen.getByTestId('compose-component-instance-depth')).toHaveAttribute('role', 'alert')
  })
})

/**
 * 组件文档：矩形带一条 0 → 90 度的旋转轨道，清单挂在根 Frame 上。
 *
 * @remarks
 * 用 `Transform.rotation` 而不是 `LayoutItem.offset`：旋转直接落在
 * `composeEntitySceneStyle` 产出的 `transform` 上，断言读的是浏览器要画的那个值，
 * 中间不隔着 Yoga 求解。轨道指向的 Component 必须真实存在，否则采样器会把它当失效数据跳过。
 */
function animatedComponentDocument(): ComposeDocument {
  const base = componentDocument()
  const rootId = base.rootIds[0]!
  const root = base.entities[rootId]!
  const rectangle = base.entities.rectangle!
  return {
    ...base,
    entities: {
      [rootId]: {
        ...root,
        components: {
          ...root.components,
          Animations: {
            items: [{
              id: 'switch',
              name: '合分闸',
              durationMs: 1000,
              playbackMode: 'play-once',
            }],
          },
        },
      },
      rectangle: {
        ...rectangle,
        components: {
          ...rectangle.components,
          Animation: {
            clips: {
              switch: [{
                path: ['Transform', 'rotation'],
                valueKind: 'number',
                keyframes: [
                  { id: 'a', timeMs: 0, value: 0, interpolation: { kind: 'linear' } },
                  { id: 'b', timeMs: 1000, value: 90, interpolation: { kind: 'linear' } },
                ],
              }],
            },
          },
        },
      },
    },
  }
}

function animatedSnapshot(): ComposeResolvedComponentSnapshot {
  return { ...snapshot(), document: animatedComponentDocument() }
}

function animatedProps(animation: string | null, animationTime: number) {
  return {
    reference,
    resolvedSnapshot: animatedSnapshot(),
    instanceOverrides: { properties: {}, operations: [] },
    animation,
    animationTime,
  } as unknown as JsonObject
}

/** 读嵌套矩形实际拿到的 `transform`。 */
async function nestedRotation(container: HTMLElement): Promise<string> {
  await waitFor(() => {
    expect(container.querySelector('[data-component-instance-entity-id="rectangle"]'))
      .not.toBeNull()
  })
  const node = container.querySelector<HTMLElement>(
    '[data-component-instance-entity-id="rectangle"]',
  )!
  return node.style.transform
}

describe('OpenSpec: basic-materials / 组件实例的动画播放头', () => {
  it('播放头驱动实例内部姿态', async () => {
    const materials = createComposeBasicMaterials()
    const Renderer = materials.registry.getRenderer('component-instance')!.renderer
    const entity = { id: 'instance', name: 'Switch', components: {} } as ComposeEntity
    const at = (timeMs: number) => {
      const props = animatedProps('switch', timeMs)
      return (
        <Renderer
          authoredProps={props}
          entity={entity}
          mode="preview"
          props={props}
          registry={materials.registry}
          renderer={{ type: 'component-instance', props }}
        />
      )
    }

    const { container, rerender } = render(at(0))
    expect(await nestedRotation(container)).toBe('rotate(0deg)')

    rerender(at(1000))
    expect(await nestedRotation(container)).toBe('rotate(90deg)')
  })

  it('同一组件的两个实例各走各的播放头', async () => {
    const materials = createComposeBasicMaterials()
    const Renderer = materials.registry.getRenderer('component-instance')!.renderer
    const instance = (id: string, timeMs: number) => {
      const props = animatedProps('switch', timeMs)
      return (
        <div data-testid={id} key={id}>
          <Renderer
            authoredProps={props}
            entity={{ id, name: 'Switch', components: {} } as ComposeEntity}
            mode="preview"
            props={props}
            registry={materials.registry}
            renderer={{ type: 'component-instance', props }}
          />
        </div>
      )
    }

    render(<>{instance('open', 0)}{instance('closed', 1000)}</>)

    // 判别点在这里：只测一个实例的话，把播放头做成全局单值的实现同样能全绿。
    // 「粒度」这个问题在屏幕上的样子，就是同一帧里两个实例姿态不同。
    expect(await nestedRotation(screen.getByTestId('open'))).toBe('rotate(0deg)')
    expect(await nestedRotation(screen.getByTestId('closed'))).toBe('rotate(90deg)')
  })
})
