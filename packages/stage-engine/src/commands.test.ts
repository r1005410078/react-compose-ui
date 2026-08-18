import {
  BUILTIN_COMMAND_TYPES,
  createTransactionRuntime,
  getComposeComposition,
  getComposeGeometryConstraints,
  getComposeHierarchy,
  getComposeLayoutItem,
  getComposeSpatialTransform,
  type ComposeDocument,
  type ComposeEntity,
  type EditorCommand,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import * as commandApi from './commands'
import {
  createDuplicateCommand,
  createGroupCommand,
  createReparentCommand,
  createUngroupCommand,
  getGroupCommandAvailability,
  getUngroupCommandAvailability,
} from './commands'
import { ROOT_FRAME_ID, document, entity, layoutSnapshot } from './test-fixtures'

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

type LayerOrderOperation =
  | 'bring-forward'
  | 'send-backward'
  | 'bring-to-front'
  | 'send-to-back'

interface LayerOrderApi {
  readonly createLayerOrderCommand?: (
    document: ComposeDocument,
    entityIds: readonly string[],
    operation: LayerOrderOperation,
    commandId?: string,
  ) => EditorCommand | null
  readonly getLayerOrderCommandAvailability?: (
    document: ComposeDocument,
    entityIds: readonly string[],
    operation: LayerOrderOperation,
  ) => { readonly available: boolean; readonly reason?: string }
}

const layerOrderApi = commandApi as LayerOrderApi

function createLayerOrderCommand(
  value: ComposeDocument,
  entityIds: readonly string[],
  operation: LayerOrderOperation,
) {
  expect(layerOrderApi.createLayerOrderCommand).toBeTypeOf('function')
  return layerOrderApi.createLayerOrderCommand!(value, entityIds, operation, 'layer-order')
}

/** v7 的顶层 Entity 是根 Frame 的子级；断言"根顺序"就是断言它的 childIds。 */
function rootChildIds(value: ComposeDocument): readonly string[] {
  return getComposeHierarchy(value.entities[ROOT_FRAME_ID]!)?.childIds ?? []
}

describe('Stage ECS commands', () => {
  it('OpenSpec: stage-engine / ECS 结构命令 / 成组生成 first-class Group', () => {
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
      'group',
    ))
    expect(result.status).toBe('committed')
    const current = runtime.getState().document
    expect(getComposeHierarchy(current.entities[ROOT_FRAME_ID]!)?.childIds).toEqual(['group'])
    expect(getComposeHierarchy(current.entities.group!)?.childIds).toEqual(['a', 'b'])
    expect(getComposeComposition(current.entities.group!).presetId).toBe('group')
    expect(getComposeGeometryConstraints(current.entities.group!)).toEqual({
      movable: true,
      resize: 'none',
      rotatable: false,
    })
    expect(current.entities.group!.components).not.toHaveProperty('Appearance')
    expect(current.entities.group!.components).not.toHaveProperty('Clip')
    expect(current.entities.group!.components).not.toHaveProperty('Layout')
    expect(getComposeSpatialTransform(current.entities.group!)).toEqual({
      position: { x: 20, y: 30 },
      size: { width: 230, height: 80 },
      rotation: 0,
    })
    expect(getComposeSpatialTransform(current.entities.a!).position).toEqual({ x: 0, y: 0 })
    expect(getComposeSpatialTransform(current.entities.b!).position).toEqual({ x: 130, y: 30 })

    const ungroup = runtime.dispatch(createUngroupCommand(
      current,
      layoutSnapshot(current, 2),
      'group',
    ))
    expect(ungroup.status).toBe('committed')
    expect(rootChildIds(runtime.getState().document)).toEqual(['a', 'b'])
  })

  it('OpenSpec: stage-engine / ECS 结构命令 / 限定解除分组', () => {
    const child = entity('child')
    const plainContainer = entity('container', { childIds: ['child'] })
    const container: ComposeEntity = {
      ...plainContainer,
      components: {
        ...plainContainer.components,
        Composition: {
          ...getComposeComposition(plainContainer),
          presetId: 'container',
        },
      },
    }
    const value = document([container, child], ['container'])

    expect(getUngroupCommandAvailability(value, 'container')).toEqual({
      available: false,
      reason: '普通 Container 不能 Ungroup',
    })
    const runtime = createTransactionRuntime({ document: value })
    expect(runtime.dispatch(createUngroupCommand(
      value,
      layoutSnapshot(value),
      'container',
    ))).toMatchObject({
      status: 'rejected',
      issues: [{ code: 'entity.invalid-ungroup' }],
    })
    expect(runtime.document).toEqual(value)
  })

  it('OpenSpec: stage-engine / ECS 结构命令 / 旧透明 Group 仍可显式 Ungroup', () => {
    const child = entity('child')
    const legacySource = entity('legacy', { childIds: ['child'] })
    const legacy: ComposeEntity = {
      ...legacySource,
      components: {
        ...legacySource.components,
        Composition: {
          presetId: null,
          baseComponentKeys: [
            'Transform',
            'LayoutItem',
            'Visibility',
            'Lock',
            'Hierarchy',
            'Clip',
            'Appearance',
          ],
          capabilityIds: [],
        },
        Clip: { enabled: false },
        Appearance: {
          backgroundPaint: { kind: 'solid', color: 'transparent' },
          borderColor: 'transparent',
          borderWidth: 0,
          borderRadius: 0,
          opacity: 1,
          shadow: null,
        },
      },
    }
    const value = document([legacy, child], ['legacy'])
    expect(getUngroupCommandAvailability(value, 'legacy')).toEqual({ available: true })
    const runtime = createTransactionRuntime({ document: value })
    expect(runtime.dispatch(createUngroupCommand(
      value,
      layoutSnapshot(value),
      'legacy',
    )).status).toBe('committed')
    expect(getComposeHierarchy(runtime.document.entities[ROOT_FRAME_ID]!)?.childIds).toEqual(['child'])
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

  it('OpenSpec: Entity reparent / 拖入绝对容器时采用手势落点而非拖拽前位置', () => {
    const child = entity('child', { x: 300, y: 120, width: 60, height: 40 })
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
      'reparent:child',
      { child: { x: 180, y: 90, width: 60, height: 40, rotation: 0 } },
    )
    const runtime = createTransactionRuntime({ document: value })
    expect(runtime.dispatch(command).status).toBe('committed')
    const current = runtime.getState().document
    expect(getComposeLayoutItem(current.entities.child!).offset).toEqual({ x: 80, y: 40 })
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

  it('OpenSpec: stage-engine / ECS 结构命令 / 固定尺寸子级进入拉伸容器', () => {
    const child = entity('child', { x: 300, y: 120, width: 80, height: 40 })
    const container = autoLayoutContainer('container', [])
    const value = document([child, container], ['child', 'container'])
    const runtime = createTransactionRuntime({ document: value })
    runtime.dispatch(createReparentCommand(value, layoutSnapshot(value), ['child'], 'container', 0))

    // row 容器的交叉轴是 height；stretch 对 fixed 子级本是空操作，采纳时改写为 fill。
    const item = getComposeLayoutItem(runtime.document.entities.child!)
    expect(item.height).toMatchObject({ mode: 'fill', value: 40 })
    expect(item.width).toMatchObject({ mode: 'fixed', value: 80 })
  })

  it('OpenSpec: stage-engine / ECS 结构命令 / column 容器改写宽度', () => {
    const child = entity('child', { x: 0, y: 0, width: 80, height: 40 })
    const base = autoLayoutContainer('container', [])
    const container = {
      ...base,
      components: {
        ...base.components,
        Layout: { ...base.components.Layout, flexDirection: 'column' },
      },
    }
    const value = document([child, container], ['child', 'container'])
    const runtime = createTransactionRuntime({ document: value })
    runtime.dispatch(createReparentCommand(value, layoutSnapshot(value), ['child'], 'container', 0))

    const item = getComposeLayoutItem(runtime.document.entities.child!)
    expect(item.width).toMatchObject({ mode: 'fill', value: 80 })
    expect(item.height).toMatchObject({ mode: 'fixed', value: 40 })
  })

  it('OpenSpec: stage-engine / ECS 结构命令 / 子级显式对齐或父级非拉伸时不改写尺寸', () => {
    const base = autoLayoutContainer('container', [])
    const centered = {
      ...base,
      components: {
        ...base.components,
        Layout: { ...base.components.Layout, alignItems: 'center' },
      },
    }
    const child = entity('child', { width: 80, height: 40 })
    const value = document([child, centered], ['child', 'container'])
    const runtime = createTransactionRuntime({ document: value })
    runtime.dispatch(createReparentCommand(value, layoutSnapshot(value), ['child'], 'container', 0))
    expect(getComposeLayoutItem(runtime.document.entities.child!).height).toMatchObject({ mode: 'fixed' })

    const pinned = entity('pinned', { width: 80, height: 40 })
    const pinnedItem = getComposeLayoutItem(pinned)
    const explicit = {
      ...pinned,
      components: {
        ...pinned.components,
        LayoutItem: { ...pinnedItem, alignSelf: 'flex-start' },
      },
    }
    const stretchValue = document([explicit, base], ['pinned', 'container'])
    const stretchRuntime = createTransactionRuntime({ document: stretchValue })
    stretchRuntime.dispatch(createReparentCommand(
      stretchValue,
      layoutSnapshot(stretchValue),
      ['pinned'],
      'container',
      0,
    ))
    expect(getComposeLayoutItem(stretchRuntime.document.entities.pinned!).height)
      .toMatchObject({ mode: 'fixed' })
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
        [ROOT_FRAME_ID]: { x: 0, y: 0, width: 1280, height: 720, positioning: 'absolute' as const },
        container: { x: 100, y: 50, width: 400, height: 200, positioning: 'absolute' as const },
        child: { x: 20, y: 30, width: 300, height: 50, positioning: 'flow' as const },
      },
    }
    const runtime = createTransactionRuntime({ document: value })
    expect(runtime.dispatch(createReparentCommand(
      value,
      snapshot,
      ['child'],
      ROOT_FRAME_ID,
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

  it('OpenSpec: stage-engine / Entity 会话剪贴板规划 / 复制到指定父级', () => {
    const source = entity('source', { x: 40, y: 50 })
    const target = entity('target', { childIds: [] })
    const value = document([source, target], ['source', 'target'])
    const result = createDuplicateCommand(
      value,
      'source',
      () => 'copy',
      'duplicate:source',
      { parentId: 'target', index: 0 },
    )!
    expect(result.command.payload).toMatchObject({
      parentId: 'target',
      index: 0,
    })
    const copy = (result.command.payload.entities as unknown as Record<string, ComposeEntity>).copy
    expect(getComposeLayoutItem(copy!)).toMatchObject({
      offset: { x: 40, y: 50 },
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

  it('OpenSpec: stage-engine / ECS 结构命令 / Flow 目标返回稳定禁用原因', () => {
    const flow = flowEntity('flow')
    const container = autoLayoutContainer('container', ['flow'])
    const value = document([container, flow], ['container'])
    expect(getGroupCommandAvailability(value, ['flow'])).toEqual({
      available: false,
      reason: '自动布局 Flow 子项不能参与 Group；请先转为 Absolute',
    })
    const group = {
      ...container,
      components: {
        ...container.components,
        Composition: {
          ...getComposeComposition(container),
          presetId: 'group',
        },
      },
    }
    const grouped = document([group, flow], ['container'])
    expect(getUngroupCommandAvailability(grouped, 'container')).toEqual({
      available: false,
      reason: '自动布局 Flow 子项不能参与 Ungroup；请先转为 Absolute',
    })
  })

  it.each([
    ['bring-forward', ['a', 'c', 'b', 'e', 'd']],
    ['send-backward', ['b', 'a', 'd', 'c', 'e']],
    ['bring-to-front', ['a', 'c', 'e', 'b', 'd']],
    ['send-to-back', ['b', 'd', 'a', 'c', 'e']],
  ] as const)(
    'OpenSpec: stage-engine / 同级节点层级命令规划 / 稳定调整多选层级 - %s',
    (operation, expected) => {
      const value = document(['a', 'b', 'c', 'd', 'e'].map((id) => entity(id)))
      const runtime = createTransactionRuntime({ document: value })
      const command = createLayerOrderCommand(value, ['b', 'd'], operation)

      expect(command).not.toBeNull()
      expect(runtime.dispatch(command!).status).toBe('committed')
      expect(rootChildIds(runtime.document)).toEqual(expected)
    },
  )

  it('OpenSpec: stage-engine / 同级节点层级命令规划 / 稳定调整多选层级 - 连续块只跨一个邻居', () => {
    const value = document(['a', 'b', 'c', 'd', 'e'].map((id) => entity(id)))
    const runtime = createTransactionRuntime({ document: value })

    expect(runtime.dispatch(createLayerOrderCommand(
      value,
      ['b', 'c'],
      'bring-forward',
    )!).status).toBe('committed')
    expect(rootChildIds(runtime.document)).toEqual(['a', 'd', 'b', 'c', 'e'])
  })

  it('OpenSpec: stage-engine / 同级节点层级命令规划 / 分父级原子重排', () => {
    const first = entity('first', { childIds: ['a', 'b', 'c'] })
    const second = entity('second', { childIds: ['d', 'e', 'f'] })
    const value = document([
      first,
      second,
      ...['a', 'b', 'c', 'd', 'e', 'f'].map((id) => entity(id)),
    ], ['first', 'second'])
    const runtime = createTransactionRuntime({ document: value })
    const command = createLayerOrderCommand(value, ['b', 'e'], 'bring-to-front')

    expect(command?.type).toBe(BUILTIN_COMMAND_TYPES.batch)
    expect(runtime.dispatch(command!).status).toBe('committed')
    expect(getComposeHierarchy(runtime.document.entities.first!)?.childIds)
      .toEqual(['a', 'c', 'b'])
    expect(getComposeHierarchy(runtime.document.entities.second!)?.childIds)
      .toEqual(['d', 'f', 'e'])

    runtime.undo()
    expect(getComposeHierarchy(runtime.document.entities.first!)?.childIds)
      .toEqual(['a', 'b', 'c'])
    expect(getComposeHierarchy(runtime.document.entities.second!)?.childIds)
      .toEqual(['d', 'e', 'f'])
  })

  it('OpenSpec: stage-engine / 同级节点层级命令规划 / 祖先与后代分别在直接父级重排', () => {
    const parent = entity('parent', { childIds: ['a', 'b', 'c'] })
    const value = document([
      entity('before'),
      parent,
      entity('after'),
      entity('a'),
      entity('b'),
      entity('c'),
    ], ['before', 'parent', 'after'])
    const runtime = createTransactionRuntime({ document: value })

    expect(runtime.dispatch(createLayerOrderCommand(
      value,
      ['parent', 'a'],
      'bring-forward',
    )!).status).toBe('committed')
    expect(rootChildIds(runtime.document)).toEqual(['before', 'after', 'parent'])
    expect(getComposeHierarchy(runtime.document.entities.parent!)?.childIds)
      .toEqual(['b', 'a', 'c'])
  })

  it('OpenSpec: stage-engine / 同级节点层级命令规划 / 普通边界不产生空事务', () => {
    const value = document([entity('a'), entity('b')])

    expect(layerOrderApi.getLayerOrderCommandAvailability!(
      value,
      ['b'],
      'bring-forward',
    )).toEqual(expect.objectContaining({ available: false }))
    expect(createLayerOrderCommand(value, ['b'], 'bring-forward')).toBeNull()
  })

  it('OpenSpec: stage-engine / 同级节点层级命令规划 / 跳过不可移动与边界目标', () => {
    const lockedParent = entity('locked-parent', { childIds: ['child'], locked: true })
    const value = document([
      entity('a'),
      entity('locked', { locked: true }),
      lockedParent,
      entity('child'),
    ], ['a', 'locked', 'locked-parent'])
    const runtime = createTransactionRuntime({ document: value })
    const command = createLayerOrderCommand(
      value,
      ['a', 'locked', 'child'],
      'bring-forward',
    )

    expect(runtime.dispatch(command!).status).toBe('committed')
    expect(rootChildIds(runtime.document)).toEqual(['locked', 'a', 'locked-parent'])
    expect(getComposeHierarchy(runtime.document.entities['locked-parent']!)?.childIds)
      .toEqual(['child'])

    expect(layerOrderApi.getLayerOrderCommandAvailability).toBeTypeOf('function')
    expect(layerOrderApi.getLayerOrderCommandAvailability!(
      runtime.document,
      ['locked-parent'],
      'bring-to-front',
    )).toEqual(expect.objectContaining({ available: false }))
    expect(createLayerOrderCommand(
      runtime.document,
      ['locked-parent'],
      'bring-to-front',
    )).toBeNull()
  })

  it('OpenSpec: stage-engine / 同级节点层级命令规划 / 重排 Flow 子项', () => {
    const a = flowEntity('a')
    const b = flowEntity('b')
    const c = flowEntity('c')
    const parent = autoLayoutContainer('parent', ['a', 'b', 'c'])
    const value = document([parent, a, b, c], ['parent'])
    const before = structuredClone({
      a: getComposeLayoutItem(a),
      b: getComposeLayoutItem(b),
      c: getComposeLayoutItem(c),
    })
    const runtime = createTransactionRuntime({ document: value })

    expect(runtime.dispatch(createLayerOrderCommand(
      value,
      ['a'],
      'bring-forward',
    )!).status).toBe('committed')
    expect(getComposeHierarchy(runtime.document.entities.parent!)?.childIds)
      .toEqual(['b', 'a', 'c'])
    expect({
      a: getComposeLayoutItem(runtime.document.entities.a!),
      b: getComposeLayoutItem(runtime.document.entities.b!),
      c: getComposeLayoutItem(runtime.document.entities.c!),
    }).toEqual(before)
  })
})
