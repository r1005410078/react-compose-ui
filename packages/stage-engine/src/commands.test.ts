import {
  BUILTIN_COMMAND_TYPES,
  createTransactionRuntime,
  getComposeComposition,
  getComposeHierarchy,
  getComposeLayoutItem,
  getComposeSpatialTransform,
  type ComposeEntity,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import {
  createDuplicateCommand,
  createGroupCommand,
  createReparentCommand,
  createUngroupCommand,
  getGroupCommandAvailability,
  getUngroupCommandAvailability,
} from './commands'
import { document, entity, layoutSnapshot } from './test-fixtures'

function autoLayoutContainer(id: string, childIds: readonly string[]): ComposeEntity {
  const base = entity(id, { width: 400, height: 200, childIds })
  return {
    ...base,
    components: {
      ...base.components,
      Composition: {
        ...base.components.Composition,
        baseComponentKeys: [...getComposeComposition(base).baseComponentKeys, 'Layout'],
      },
      Layout: {
        type: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignContent: 'stretch',
        justifyContent: 'flex-start',
        alignItems: 'stretch',
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        rowGap: 0,
        columnGap: 0,
      },
    },
  }
}

function flowEntity(id: string, fillWidth = false): ComposeEntity {
  const base = entity(id)
  return {
    ...base,
    components: {
      ...base.components,
      LayoutItem: {
        ...base.components.LayoutItem,
        positioning: 'flow',
        width: {
          ...(base.components.LayoutItem?.width as object),
          mode: fillWidth ? 'fill' : 'fixed',
        },
      },
    },
  }
}

describe('Stage ECS commands', () => {
  it('OpenSpec: Entity 分组 / 创建可渲染无关的 Container 组合并保持世界位置', () => {
    const value = document([
      entity('a', { x: 20, y: 30 }),
      entity('b', { x: 150, y: 60 }),
    ])
    const runtime = createTransactionRuntime({
      document: value,
    })
    const result = runtime.dispatch(createGroupCommand(
      value,
      layoutSnapshot(value),
      ['a', 'b'],
      'container',
    ))
    expect(result.status).toBe('committed')
    const current = runtime.getState().document
    expect(current.rootIds).toEqual(['container'])
    expect(getComposeHierarchy(current.entities.container!)?.childIds).toEqual(['a', 'b'])
    expect(getComposeSpatialTransform(current.entities.container!)).toEqual({
      position: { x: 20, y: 30 },
      size: { width: 230, height: 80 },
      rotation: 0,
    })
    expect(getComposeSpatialTransform(current.entities.a!).position).toEqual({ x: 0, y: 0 })
    expect(getComposeSpatialTransform(current.entities.b!).position).toEqual({ x: 130, y: 30 })

    const ungroup = runtime.dispatch(createUngroupCommand(
      current,
      layoutSnapshot(current, 2),
      'container',
    ))
    expect(ungroup.status).toBe('committed')
    expect(runtime.getState().document.rootIds).toEqual(['a', 'b'])
  })

  it('OpenSpec: Entity reparent / 使用一个 batch 同步层级和局部 Transform', () => {
    const child = entity('child', { x: 300, y: 120 })
    const container = entity('container', {
      x: 100,
      y: 50,
      width: 400,
      height: 300,
      childIds: [],
    })
    const value = document([child, container], ['child', 'container'])
    const command = createReparentCommand(
      value,
      layoutSnapshot(value),
      ['child'],
      'container',
      0,
    )
    expect(command.type).toBe(BUILTIN_COMMAND_TYPES.batch)
    const runtime = createTransactionRuntime({
      document: value,
    })
    expect(runtime.dispatch(command).status).toBe('committed')
    const current = runtime.getState().document
    expect(getComposeHierarchy(current.entities.container!)?.childIds).toEqual(['child'])
    expect(getComposeSpatialTransform(current.entities.child!).position).toEqual({ x: 200, y: 70 })
  })

  it('OpenSpec: auto-layout-interactions / 移入 Layout / 自动转 Flow 并保留 offset fallback', () => {
    const child = entity('child', { x: 300, y: 120 })
    const container = autoLayoutContainer('container', [])
    const value = document([child, container], ['child', 'container'])
    const runtime = createTransactionRuntime({ document: value })
    expect(runtime.dispatch(createReparentCommand(
      value,
      layoutSnapshot(value),
      ['child'],
      'container',
      0,
    )).status).toBe('committed')
    expect(getComposeLayoutItem(runtime.document.entities.child!)).toMatchObject({
      positioning: 'flow',
      offset: { x: 300, y: 120 },
    })
  })

  it('OpenSpec: auto-layout-interactions / 移出 Layout / 烘焙 Absolute 且 Fill 转 Fixed', () => {
    const child = flowEntity('child', true)
    const container = {
      ...autoLayoutContainer('container', ['child']),
      components: {
        ...autoLayoutContainer('container', ['child']).components,
        LayoutItem: {
          ...autoLayoutContainer('container', ['child']).components.LayoutItem,
          offset: { x: 100, y: 50 },
        },
      },
    }
    const value = document([container, child], ['container'])
    const snapshot = {
      ...layoutSnapshot(value),
      boxes: {
        container: { x: 100, y: 50, width: 400, height: 200, positioning: 'absolute' as const },
        child: { x: 20, y: 30, width: 300, height: 50, positioning: 'flow' as const },
      },
    }
    const runtime = createTransactionRuntime({ document: value })
    expect(runtime.dispatch(createReparentCommand(
      value,
      snapshot,
      ['child'],
      null,
      1,
    )).status).toBe('committed')
    expect(getComposeLayoutItem(runtime.document.entities.child!)).toMatchObject({
      positioning: 'absolute',
      offset: { x: 120, y: 80 },
      width: { mode: 'fixed', value: 300 },
    })
  })

  it('OpenSpec: auto-layout-interactions / 跨 Layout 移动 / 保持 Flow 并采用目标 insertion index', () => {
    const child = flowEntity('child')
    const existing = flowEntity('existing')
    const source = autoLayoutContainer('source', ['child'])
    const target = autoLayoutContainer('target', ['existing'])
    const value = document([source, target, child, existing], ['source', 'target'])
    const runtime = createTransactionRuntime({ document: value })

    expect(runtime.dispatch(createReparentCommand(
      value,
      layoutSnapshot(value),
      ['child'],
      'target',
      0,
    )).status).toBe('committed')
    expect(getComposeHierarchy(runtime.document.entities.source!)?.childIds).toEqual([])
    expect(getComposeHierarchy(runtime.document.entities.target!)?.childIds)
      .toEqual(['child', 'existing'])
    expect(getComposeLayoutItem(runtime.document.entities.child!).positioning).toBe('flow')
  })

  it('OpenSpec: Entity duplicate / 深复制 Components 并重映射 Hierarchy', () => {
    const child = entity('child')
    const container = entity('container', { childIds: ['child'] })
    const value = document([container, child], ['container'])
    const ids = ['container-copy', 'child-copy'][Symbol.iterator]()
    const result = createDuplicateCommand(value, 'container', () => ids.next().value!)
    expect(result?.rootId).toBe('container-copy')
    expect(result?.command.type).toBe(BUILTIN_COMMAND_TYPES.duplicateEntity)
    const payload = result?.command.payload
    expect(payload?.entities).toMatchObject({
      'container-copy': {
        components: { Hierarchy: { childIds: ['child-copy'] } },
      },
      'child-copy': { id: 'child-copy' },
    })
  })

  it('OpenSpec: auto-layout-interactions / Duplicate Flow / 紧随源节点且不增加偏移', () => {
    const source = flowEntity('source')
    const container = autoLayoutContainer('container', ['source'])
    const value = document([container, source], ['container'])
    const result = createDuplicateCommand(value, 'source', () => 'copy')!
    const runtime = createTransactionRuntime({ document: value })
    expect(runtime.dispatch(result.command).status).toBe('committed')
    expect(getComposeHierarchy(runtime.document.entities.container!)?.childIds)
      .toEqual(['source', 'copy'])
    expect(getComposeLayoutItem(runtime.document.entities.copy!)).toEqual(
      getComposeLayoutItem(source),
    )
  })

  it('OpenSpec: auto-layout-interactions / Group availability / Flow 目标返回稳定禁用原因', () => {
    const flow = flowEntity('flow')
    const container = autoLayoutContainer('container', ['flow'])
    const value = document([container, flow], ['container'])
    expect(getGroupCommandAvailability(value, ['flow'])).toEqual({
      available: false,
      reason: '自动布局 Flow 子项不能参与 Group；请先转为 Absolute',
    })
    expect(getUngroupCommandAvailability(value, 'container')).toEqual({
      available: false,
      reason: '自动布局 Flow 子项不能参与 Ungroup；请先转为 Absolute',
    })
  })
})
