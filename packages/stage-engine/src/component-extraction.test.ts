import {
  createTransactionRuntime,
  createComposeGroupEntitySeed,
  getComposeHierarchy,
  getComposeLayoutItem,
  getComposeSpatialTransform,
  isComposeGroupEntity,
  type ComposeEntity,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import {
  createComponentExtractionPlan,
  createReplaceSelectionWithEntityCommand,
} from './component-extraction'
import { document, entity, layoutSnapshot } from './test-fixtures'

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
    expect(result.componentDocument.output).toEqual({
      width: 230,
      height: 80,
      backgroundPaint: { kind: 'solid', color: 'transparent' },
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
    expect(runtime.document.rootIds).toEqual(['before', 'instance', 'middle'])
    expect(getComposeSpatialTransform(runtime.document.entities.instance!)).toEqual(plan.instanceTransform)
    runtime.undo()
    expect(runtime.document.rootIds).toEqual(['before', 'a', 'middle', 'b'])
    runtime.redo()
    expect(runtime.document.rootIds).toEqual(['before', 'instance', 'middle'])
  })
})
