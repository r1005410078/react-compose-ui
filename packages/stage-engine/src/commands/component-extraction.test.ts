import {
  createTransactionRuntime,
  createComposeGroupEntitySeed,
  getComposeHierarchy,
  getComposeLayoutItem,
  getComposeSpatialTransform,
  isComposeGroupEntity,
  type ComposeEntity,
  type JsonObject,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import {
  createComponentExtractionPlan,
  createReplaceSelectionWithEntityCommand,
} from './component-extraction'
import { ROOT_FRAME_ID, document, entity, layoutSnapshot } from '../test-fixtures'

function instanceEntity(): ComposeEntity {
  return {
    ...entity('instance'),
    name: 'Card',
    components: {
      ...entity('instance').components,
      Composition: {
        presetId: 'component-instance',
        baseComponentKeys: ['Transform', 'LayoutItem', 'Visibility', 'Lock', 'Renderer'],
        capabilityIds: [],
      },
      Renderer: { type: 'component-instance', props: {} },
    },
  }
}

describe('OpenSpec: stage-engine / 场景选区组件抽取', () => {
  it('规范化祖先选区、保持 sibling 顺序并拒绝不同父级或 Flow', () => {
    const group = entity('container', { childIds: ['a', 'b'] })
    const value = document([
      group,
      entity('a', { x: 20 }),
      entity('b', { x: 160 }),
      entity('root'),
    ], ['container', 'root'])

    const normalized = createComponentExtractionPlan({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      selectedIds: ['b', 'container', 'a'],
      groupId: 'component-root',
      name: 'Card',
    })
    expect(normalized.status).toBe('ready')
    if (normalized.status !== 'ready') return
    expect(normalized.sourceEntityIds).toEqual(['container'])

    const differentParents = createComponentExtractionPlan({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      selectedIds: ['a', 'root'],
      groupId: 'component-root',
      name: 'Card',
    })
    expect(differentParents).toMatchObject({ status: 'unavailable' })

    const flow = entity('flow')
    const flowValue = {
      ...value,
      rootIds: [...value.rootIds, flow.id],
      entities: {
        ...value.entities,
        [flow.id]: {
          ...flow,
          components: {
            ...flow.components,
            LayoutItem: { ...getComposeLayoutItem(flow), positioning: 'flow' },
          },
        },
      },
    }
    expect(createComponentExtractionPlan({
      document: flowValue,
      layoutSnapshot: layoutSnapshot(flowValue),
      selectedIds: ['flow'],
      groupId: 'component-root',
      name: 'Card',
    })).toMatchObject({ status: 'unavailable' })
  })

  it('多选输出透明单根 Group，并把世界几何归一化到输出原点', () => {
    const value = document([
      entity('a', { x: 20, y: 30, width: 100, height: 50 }),
      entity('b', { x: 150, y: 60, width: 100, height: 50 }),
    ])
    const result = createComponentExtractionPlan({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      selectedIds: ['b', 'a'],
      groupId: 'component-root',
      name: 'Card',
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return

    expect(result.sourceEntityIds).toEqual(['a', 'b'])
    // 组件根即 Frame：创建组件是「隐含升格」的四个入口之一。
    expect(result.componentDocument.entities['component-root']!.components.Frame).toEqual({
      size: { width: 230, height: 80 },
      guides: [],
    })
    expect(result.componentDocument.rootIds).toEqual(['component-root'])
    const root = result.componentDocument.entities['component-root']!
    expect(isComposeGroupEntity(root)).toBe(true)
    expect(getComposeHierarchy(root)?.childIds).toEqual(['a', 'b'])
    expect(getComposeSpatialTransform(result.componentDocument.entities.a!).position)
      .toEqual({ x: 0, y: 0 })
    expect(getComposeSpatialTransform(result.componentDocument.entities.b!).position)
      .toEqual({ x: 130, y: 30 })
    expect(result.instanceTransform).toEqual({
      position: { x: 20, y: 30 },
      size: { width: 230, height: 80 },
      rotation: 0,
    })
  })

  it('单选 first-class Group 时不重复包 Group', () => {
    const value = document([
      createComposeGroupEntitySeed({
        id: 'group',
        childIds: ['a', 'b'],
        position: { x: 20, y: 30 },
        size: { width: 220, height: 50 },
      }),
      entity('a'),
      entity('b', { x: 120 }),
    ], ['group'])
    const result = createComponentExtractionPlan({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      selectedIds: ['group'],
      groupId: 'unused-wrapper',
      name: 'Card',
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.componentDocument.rootIds).toEqual(['group'])
    expect(result.componentDocument.entities).not.toHaveProperty('unused-wrapper')
  })

  it('单选 Container 时复用它作为组件根，不追加包装层', () => {
    const value = document([
      entity('container', { x: 20, y: 30, width: 220, height: 50, childIds: ['a'] }),
      entity('a'),
    ], ['container'])
    const result = createComponentExtractionPlan({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      selectedIds: ['container'],
      groupId: 'unused-wrapper',
      name: 'Card',
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    // 组件根就是被选中的 Container 本身，场景树里不会多出同名包装层。
    expect(result.componentDocument.rootIds).toEqual(['container'])
    expect(result.componentDocument.entities).not.toHaveProperty('unused-wrapper')
    expect(isComposeGroupEntity(result.componentDocument.entities.container!)).toBe(false)
    // 复用路径同样把根坐标归零到输出原点。
    expect(getComposeLayoutItem(result.componentDocument.entities.container!).offset)
      .toEqual({ x: 0, y: 0 })
  })

  it('资源成功后用一个可撤销事务在最小 sibling index 原子替换选区', () => {
    const value = document([
      entity('before'),
      entity('a', { x: 120 }),
      entity('middle'),
      entity('b', { x: 360 }),
    ])
    const plan = createComponentExtractionPlan({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      selectedIds: ['b', 'a'],
      groupId: 'component-root',
      name: 'Card',
    })
    if (plan.status !== 'ready') throw new Error(plan.reason)
    const runtime = createTransactionRuntime({ document: value })
    const result = runtime.dispatch(createReplaceSelectionWithEntityCommand({
      commandId: 'replace',
      createCommandId: 'create-instance',
      deleteCommandId: 'delete-source',
      document: value,
      entity: instanceEntity(),
      plan,
    }))

    expect(result.status).toBe('committed')
    expect(getComposeHierarchy(runtime.document.entities[ROOT_FRAME_ID]!)?.childIds).toEqual(['before', 'instance', 'middle'])
    expect(getComposeSpatialTransform(runtime.document.entities.instance!)).toEqual(plan.instanceTransform)
    runtime.undo()
    expect(getComposeHierarchy(runtime.document.entities[ROOT_FRAME_ID]!)?.childIds).toEqual(['before', 'a', 'middle', 'b'])
    runtime.redo()
    expect(getComposeHierarchy(runtime.document.entities[ROOT_FRAME_ID]!)?.childIds).toEqual(['before', 'instance', 'middle'])
  })
})

describe('OpenSpec: stage-engine / 组件提取搬运动画清单', () => {
  const ROTATION_TRACK = {
    path: ['Transform', 'rotation'],
    valueKind: 'number',
    keyframes: [
      { id: 'k0', timeMs: 0, value: 0, interpolation: { kind: 'linear' } },
      { id: 'k1', timeMs: 200, value: 60, interpolation: { kind: 'linear' } },
    ],
  }
  const manifest = (id: string, name: string) => ({
    id,
    name,
    durationMs: 200,
    playbackMode: 'play-once' as const,
  })

  /** 给一个 Entity 挂上某条动画的轨道。 */
  function animated(target: ComposeEntity, animationIds: readonly string[]): ComposeEntity {
    return {
      ...target,
      components: {
        ...target.components,
        Animation: {
          clips: Object.fromEntries(animationIds.map((id) => [id, [ROTATION_TRACK]])),
        },
      },
    }
  }

  /** 根 Frame 上挂清单；`source` 与 `bindings` 都带上，用来验证它们不会被复制过去。 */
  function withManifest(
    value: ReturnType<typeof document>,
    items: readonly JsonObject[],
  ) {
    const frame = value.entities[ROOT_FRAME_ID]!
    return {
      ...value,
      entities: {
        ...value.entities,
        [ROOT_FRAME_ID]: {
          ...frame,
          components: {
            ...frame.components,
            Animations: {
              items,
              source: { providerId: 'demo', assetKey: 'page.animation.json', scope: 'persistent' },
            },
          },
        },
      },
    }
  }

  function scene() {
    const container = entity('container', { childIds: ['a'] })
    const value = document([
      container,
      animated(entity('a', { x: 20 }), ['swing']),
      animated(entity('b', { x: 300 }), ['swing', 'blink']),
    ], ['container', 'b'])
    return withManifest(value, [
      { ...manifest('swing', '摆动'), bindings: { currentTime: { scope: 'page', exportName: 'openMs' } } },
      manifest('blink', '闪烁'),
    ])
  }

  /** 轨道 Component 是 `@compose-ui/animation` 的词汇，本包不依赖它，由调用方注入读取。 */
  function readEntityAnimationIds(target: ComposeEntity): readonly string[] {
    const component = target.components.Animation as { clips?: Record<string, unknown> } | undefined
    return component?.clips ? Object.keys(component.clips) : []
  }

  function extract(value: ReturnType<typeof scene>, selectedIds: readonly string[]) {
    const plan = createComponentExtractionPlan({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      selectedIds,
      groupId: 'component-root',
      name: '刀闸',
      readEntityAnimationIds,
    })
    if (plan.status !== 'ready') throw new Error(`extraction unavailable: ${plan.reason}`)
    const rootId = plan.componentDocument.rootIds[0]!
    return {
      plan,
      rootId,
      animations: plan.componentDocument.entities[rootId]!.components.Animations as
        { items?: readonly { id: string }[]; source?: unknown } | undefined,
    }
  }

  it('动画 id 与轨道分组键一致', () => {
    const { plan, animations } = extract(scene(), ['container'])

    /*
     * 判别点。轨道按动画 id 分组（`Animation.clips[animationId]`），复制清单时换一个新 id
     * 会让刚提取出来的轨道全部变成悬空分组——时间线上什么都不动，而文档校验不会拒绝它。
     * 只断言「组件有一条动画」的用例在那个错误实现下是全绿的。
     */
    expect(animations?.items?.map((item) => item.id)).toEqual(['swing'])
    const clips = plan.componentDocument.entities.a!.components.Animation as
      { clips: Record<string, unknown> }
    expect(Object.keys(clips.clips)).toEqual(['swing'])
    expect(clips.clips.swing).toEqual([ROTATION_TRACK])
  })

  it('部分选区不破坏留下的轨道', () => {
    const source = scene()
    const before = structuredClone(source)
    const { animations } = extract(source, ['container'])

    // 组件只拿到 A 的那一份轨道。
    expect(animations?.items ?? []).toHaveLength(1)
    // 源文档一个字节都不能变：这条动画在页面上还给 B 打着点，搬运式实现会让 B 的轨道悬空，
    // 而用户根本没有选中 B。
    expect(source).toEqual(before)
  })

  it('与被提取实体无关的动画不进组件', () => {
    const { animations } = extract(scene(), ['container'])

    // `blink` 只给 B 打了点，B 没被提取。整份清单照抄的实现会让组件多出一条零轨道的动画。
    const ids = animations?.items?.map((item) => item.id) ?? []
    expect(ids).toContain('swing')
    expect(ids).not.toContain('blink')
  })

  it('不携带文件引用与页面绑定', () => {
    const { animations } = extract(scene(), ['container'])

    expect(animations).toBeDefined()
    // `source` 指向页面目录下的动画文件，跟着组件走就是跨作用域的悬空引用。
    expect(animations?.source).toBeUndefined()
    // `bindings` 指向页面 setup 的导出名，而嵌套文档没有脚本作用域——复制过去只会让用户
    // 在组件的动画检查器里看见一个永远不生效的变量名。
    expect(animations?.items?.[0] ?? {}).not.toHaveProperty('bindings')
  })

  it('源上没有动画时组件不带 Animations', () => {
    const value = document([entity('container', { childIds: ['a'] }), entity('a')], ['container'])
    const plan = createComponentExtractionPlan({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      selectedIds: ['container'],
      groupId: 'component-root',
      name: '刀闸',
      readEntityAnimationIds,
    })
    if (plan.status !== 'ready') throw new Error('extraction unavailable')
    const rootId = plan.componentDocument.rootIds[0]!
    expect(plan.componentDocument.entities[rootId]!.components.Animations).toBeUndefined()
  })
})
