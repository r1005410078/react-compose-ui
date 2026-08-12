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
  return {
    ...createEmptyComposePageDocument(),
    output: {
      width: 120,
      height: 80,
      backgroundPaint: { kind: 'solid', color: 'transparent' },
    },
    rootIds: [group.id],
    entities: { [group.id]: group, [rectangle.id]: rectangle },
  }
}

function baseAsset(): ComposeBaseComponentAsset {
  return {
    schemaVersion: 1,
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
      resize: 'none',
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
