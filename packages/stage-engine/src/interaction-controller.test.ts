import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  type ComposeDocument,
} from '@compose-ui/core'
import { describe, expect, it, vi } from 'vitest'
import {
  createStageInteractionController,
  type StageInteractionEffect,
} from './index'

const document: ComposeDocument = {
  schemaVersion: 3,
  canvas: createDefaultCanvasSettings(),
  output: createDefaultOutputSettings(),
  rootIds: ['frame'],
  nodes: {
    frame: {
      id: 'frame',
      kind: 'frame',
      name: 'Frame',
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, width: 400, height: 300, rotation: 0 },
      childIds: ['node'],
      clipContent: true,
    },
    node: {
      id: 'node',
      kind: 'component',
      name: 'Node',
      visible: true,
      locked: false,
      transform: { x: 20, y: 30, width: 40, height: 30, rotation: 0 },
      componentType: 'box',
      props: {},
    },
  },
}

const groupDocument: ComposeDocument = {
  ...document,
  nodes: {
    frame: {
      id: 'frame',
      kind: 'frame',
      name: 'Frame',
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, width: 400, height: 300, rotation: 0 },
      childIds: ['group'],
      clipContent: true,
    },
    group: {
      id: 'group',
      kind: 'frame',
      name: 'Nested Frame',
      visible: true,
      locked: false,
      transform: { x: 20, y: 30, width: 40, height: 30, rotation: 0 },
      childIds: ['child'],
      clipContent: false,
    },
    child: {
      id: 'child',
      kind: 'component',
      name: 'Child',
      visible: true,
      locked: false,
      transform: { x: 5, y: 6, width: 10, height: 8, rotation: 0 },
      componentType: 'box',
      props: {},
    },
  },
}

const mixedDocument: ComposeDocument = {
  ...groupDocument,
  nodes: {
    ...groupDocument.nodes,
    frame: {
      id: 'frame',
      kind: 'frame',
      name: 'Frame',
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, width: 400, height: 300, rotation: 0 },
      childIds: ['group', 'sibling'],
      clipContent: true,
    },
    sibling: {
      id: 'sibling',
      kind: 'component',
      name: 'Sibling',
      visible: true,
      locked: false,
      transform: { x: 100, y: 30, width: 20, height: 20, rotation: 0 },
      componentType: 'box',
      props: {},
    },
  },
}

function connect() {
  const controller = createStageInteractionController()
  const effects: StageInteractionEffect[] = []
  const disconnect = controller.connectSurface({
    resolveClientPoint: (point) => point,
    applyEffects: (next) => effects.push(...next),
  })
  const context = {
    document,
    viewport: { x: 0, y: 0, zoom: 1 },
    surfaceSize: { width: 800, height: 600 },
    tool: 'select' as const,
    selectedIds: ['node'],
    idFactory: vi.fn(() => 'command'),
  }
  controller.updateContext(context)
  return { controller, disconnect, effects, context }
}

describe('StageInteractionController', () => {
  it('OpenSpec: stage-engine / 输出区域检查命中 / 点击输出区域请求检查 Canvas', () => {
    const { controller, effects } = connect()

    controller.send({
      type: 'pointer.down',
      pointerId: 90,
      button: 0,
      point: { x: 300, y: 200 },
      hit: { kind: 'output' },
      modifiers: { shift: false, alt: false, command: false },
    })
    controller.send({
      type: 'pointer.up',
      pointerId: 90,
      point: { x: 300, y: 200 },
      modifiers: { shift: false, alt: false, command: false },
    })

    expect(effects).toContainEqual({
      type: 'selection.change',
      selectedIds: [],
    })
    expect(effects).toContainEqual({ type: 'output.select' })
  })

  it('OpenSpec: stage-engine / 输出区域检查命中 / 输出区域框选切回节点选择', () => {
    const { controller, effects } = connect()

    controller.send({
      type: 'pointer.down',
      pointerId: 91,
      button: 0,
      point: { x: 0, y: 0 },
      hit: { kind: 'output' },
      modifiers: { shift: false, alt: false, command: false },
    })
    controller.send({
      type: 'pointer.move',
      pointerId: 91,
      point: { x: 100, y: 100 },
      modifiers: { shift: false, alt: false, command: false },
    })
    controller.send({
      type: 'pointer.up',
      pointerId: 91,
      point: { x: 100, y: 100 },
      modifiers: { shift: false, alt: false, command: false },
    })

    const selections = effects.filter((effect) => effect.type === 'selection.change')
    expect(effects).toContainEqual({ type: 'output.select' })
    expect(selections[selections.length - 1]).toEqual({
      type: 'selection.change',
      selectedIds: ['node'],
    })
  })

  it('OpenSpec: stage-engine / 输出区域检查命中 / 平移不切换检查目标', () => {
    const { controller, effects, context } = connect()
    controller.updateContext({ ...context, tool: 'pan' })

    controller.send({
      type: 'pointer.down',
      pointerId: 92,
      button: 0,
      point: { x: 300, y: 200 },
      hit: { kind: 'output' },
      modifiers: { shift: false, alt: false, command: false },
    })
    controller.send({
      type: 'pointer.up',
      pointerId: 92,
      point: { x: 300, y: 200 },
      modifiers: { shift: false, alt: false, command: false },
    })

    expect(effects).not.toContainEqual({ type: 'output.select' })
  })

  it('OpenSpec: stage-engine / Headless 交互 Controller / 拒绝第二个同时连接的 surface', () => {
    const { controller } = connect()
    expect(() => controller.connectSurface({
      resolveClientPoint: (point) => point,
      applyEffects: () => undefined,
    })).toThrow(/already has a connected surface/)
  })

  it('OpenSpec: stage-engine / 手势预览与原子提交 / 高频更新后单次提交', () => {
    const { controller, effects } = connect()
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 30, y: 40 },
      hit: { kind: 'node', nodeId: 'node' },
      modifiers: { shift: false, alt: false, command: true },
    })
    controller.send({
      type: 'pointer.move',
      pointerId: 1,
      point: { x: 50, y: 60 },
      modifiers: { shift: false, alt: false, command: true },
    })
    controller.send({
      type: 'pointer.move',
      pointerId: 1,
      point: { x: 70, y: 80 },
      modifiers: { shift: false, alt: false, command: true },
    })

    expect(controller.getSnapshot().previewTransforms.node).toMatchObject({ x: 60, y: 70 })
    expect(effects.filter((effect) => effect.type === 'command.dispatch')).toHaveLength(0)

    controller.send({
      type: 'pointer.up',
      pointerId: 1,
      point: { x: 70, y: 80 },
      modifiers: { shift: false, alt: false, command: true },
    })

    expect(effects.filter((effect) => effect.type === 'command.dispatch')).toHaveLength(1)
    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('OpenSpec: stage-engine / 手势预览与原子提交 / 最终点先提交再清理和释放', () => {
    const controller = createStageInteractionController()
    const order: string[] = []
    controller.connectSurface({
      resolveClientPoint: (point) => point,
      applyEffects: (effects) => {
        effects.forEach((effect) => order.push(effect.type))
      },
    })
    controller.subscribe(() => order.push(`snapshot.${controller.getSnapshot().phase}`))
    controller.updateContext({
      document,
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'select',
      selectedIds: ['node'],
      idFactory: () => 'command',
    })
    controller.send({
      type: 'pointer.down',
      pointerId: 2,
      button: 0,
      point: { x: 30, y: 40 },
      hit: { kind: 'node', nodeId: 'node' },
      modifiers: { shift: false, alt: false, command: true },
    })
    order.length = 0

    controller.send({
      type: 'pointer.up',
      pointerId: 2,
      point: { x: 90, y: 70 },
      modifiers: { shift: false, alt: false, command: true },
    })

    const commandIndex = order.indexOf('command.dispatch')
    const idleIndex = order.indexOf('snapshot.idle')
    const releaseIndex = order.indexOf('pointer.release')
    expect(commandIndex).toBeGreaterThanOrEqual(0)
    expect(idleIndex).toBeGreaterThan(commandIndex)
    expect(releaseIndex).toBeGreaterThan(idleIndex)
    expect(order.filter((entry) => entry === 'command.dispatch')).toHaveLength(1)
  })

  it('OpenSpec: stage-engine / 手势预览与原子提交 / surface 重测不中断活动变换', () => {
    const { controller, effects, context } = connect()
    controller.send({
      type: 'pointer.down',
      pointerId: 3,
      button: 0,
      point: { x: 30, y: 40 },
      hit: { kind: 'node', nodeId: 'node' },
      modifiers: { shift: false, alt: false, command: true },
    })

    controller.updateContext({
      ...context,
      surfaceSize: { width: 960, height: 720 },
    })
    expect(controller.getSnapshot().phase).toBe('move')

    controller.send({
      type: 'pointer.up',
      pointerId: 3,
      point: { x: 70, y: 80 },
      modifiers: { shift: false, alt: false, command: true },
    })
    const dispatch = effects.find(
      (effect): effect is Extract<StageInteractionEffect, { type: 'command.dispatch' }> =>
        effect.type === 'command.dispatch',
    )
    expect(dispatch?.command.payload).toEqual({
      updates: [{
        nodeId: 'node',
        transform: {
          x: 60,
          y: 70,
          width: 40,
          height: 30,
          rotation: 0,
        },
      }],
    })
  })

  it('OpenSpec: stage-engine / 手势预览与原子提交 / 文档和受控选择变化仍取消', () => {
    const first = connect()
    first.controller.send({
      type: 'pointer.down',
      pointerId: 4,
      button: 0,
      point: { x: 30, y: 40 },
      hit: { kind: 'node', nodeId: 'node' },
      modifiers: { shift: false, alt: false, command: true },
    })
    first.controller.updateContext({
      ...first.context,
      document: { ...first.context.document },
    })
    expect(first.controller.getSnapshot().phase).toBe('idle')
    expect(first.effects.some((effect) => effect.type === 'command.dispatch')).toBe(false)

    const second = connect()
    second.controller.send({
      type: 'pointer.down',
      pointerId: 5,
      button: 0,
      point: { x: 30, y: 40 },
      hit: { kind: 'node', nodeId: 'node' },
      modifiers: { shift: false, alt: false, command: true },
    })
    second.controller.updateContext({
      ...second.context,
      selectedIds: [],
    })
    expect(second.controller.getSnapshot().phase).toBe('idle')
    expect(second.effects.some((effect) => effect.type === 'command.dispatch')).toBe(false)
  })

  it('OpenSpec: stage-engine / 统一外部拖入 / 拖入 Component', () => {
    const { controller, effects } = connect()
    controller.send({
      type: 'external.begin',
      item: { kind: 'component', componentType: 'box' },
      clientPoint: { x: 20, y: 20 },
    })
    controller.send({ type: 'external.move', clientPoint: { x: 100, y: 100 } })
    controller.send({ type: 'external.end', clientPoint: { x: 100, y: 100 } })

    expect(effects).toContainEqual({
      type: 'external.drop',
      item: { kind: 'component', componentType: 'box' },
      clientPoint: { x: 100, y: 100 },
      worldPoint: { x: 100, y: 100 },
      parentId: 'frame',
    })
    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('OpenSpec: stage-engine / 资源批量外部拖入会话 / 资源落到 Frame 或 Canvas', () => {
    const { controller, effects } = connect()
    const item = {
      kind: 'assets' as const,
      items: [{
        providerId: 'library',
        assetKey: 'hero',
        scope: 'persistent' as const,
        name: 'hero.png',
        mediaType: 'image/png',
      }],
    }
    controller.send({
      type: 'external.begin',
      item,
      clientPoint: { x: 20, y: 20 },
    })
    controller.send({ type: 'external.end', clientPoint: { x: 100, y: 100 } })
    expect(effects).toContainEqual(expect.objectContaining({
      type: 'external.drop',
      item,
      parentId: 'frame',
    }))
  })

  // OpenSpec: stage-engine / 统一外部拖入 / 拖入根或嵌套 Frame
  it('OpenSpec: stage-engine / 统一外部拖入 / Frame 外落到隐式 Canvas 根', () => {
    const { controller, effects } = connect()
    controller.send({
      type: 'external.begin',
      item: { kind: 'component', componentType: 'box' },
      clientPoint: { x: 700, y: 500 },
    })
    controller.send({ type: 'external.end', clientPoint: { x: 700, y: 500 } })

    expect(effects).toContainEqual({
      type: 'external.drop',
      item: { kind: 'component', componentType: 'box' },
      clientPoint: { x: 700, y: 500 },
      worldPoint: { x: 700, y: 500 },
      parentId: null,
    })
  })

  it('OpenSpec: stage-engine / 统一外部拖入 / 键盘新增推导父级', () => {
    const { controller, effects } = connect()
    controller.send({
      type: 'external.add',
      item: { kind: 'component', componentType: 'box' },
    })

    expect(effects).toContainEqual({
      type: 'external.drop',
      item: { kind: 'component', componentType: 'box' },
      clientPoint: null,
      worldPoint: { x: 200, y: 150 },
      parentId: 'frame',
    })
  })

  it('OpenSpec: stage-engine / Snapshot 派生状态 / 选区、光标与滚动范围由引擎维护', () => {
    const { controller, context } = connect()
    const first = controller.getSnapshot()

    expect(first.selectionBounds).toEqual({
      x: 20,
      y: 30,
      width: 40,
      height: 30,
    })
    expect(first.scrollRange).not.toBeNull()
    expect(first.cursor).toBe('default')

    controller.send({ type: 'temporary-pan.start' })
    expect(controller.getSnapshot()).toMatchObject({
      temporaryPan: true,
      cursor: 'grab',
    })
    controller.updateContext({
      ...context,
      viewport: { x: -2400, y: -1800, zoom: 1 },
    })
    const expanded = controller.getSnapshot().scrollRange!
    controller.updateContext(context)
    expect(controller.getSnapshot().scrollRange).toEqual(expanded)
  })

  it('OpenSpec: stage-engine / Context 变化取消 / 文档或受控选区变化时不提交预览', () => {
    const { controller, effects, context } = connect()
    controller.send({
      type: 'pointer.down',
      pointerId: 7,
      button: 0,
      point: { x: 30, y: 40 },
      hit: { kind: 'node', nodeId: 'node' },
      modifiers: { shift: false, alt: false, command: true },
    })
    controller.send({
      type: 'pointer.move',
      pointerId: 7,
      point: { x: 70, y: 80 },
      modifiers: { shift: false, alt: false, command: true },
    })
    controller.updateContext({
      ...context,
      selectedIds: [],
    })

    expect(controller.getSnapshot()).toMatchObject({
      phase: 'idle',
      previewTransforms: {},
    })
    expect(effects).toContainEqual({ type: 'pointer.release', pointerId: 7 })
    expect(effects.filter((effect) => effect.type === 'command.dispatch')).toHaveLength(0)
  })

  it('OpenSpec: stage-engine / 最后点同步提交 / pointerup 自身坐标参与唯一命令', () => {
    const { controller, effects } = connect()
    controller.send({
      type: 'pointer.down',
      pointerId: 9,
      button: 0,
      point: { x: 30, y: 40 },
      hit: { kind: 'node', nodeId: 'node' },
      modifiers: { shift: false, alt: false, command: true },
    })
    controller.send({
      type: 'pointer.up',
      pointerId: 9,
      point: { x: 90, y: 100 },
      modifiers: { shift: false, alt: false, command: true },
    })

    const commands = effects.filter(
      (effect): effect is Extract<StageInteractionEffect, { type: 'command.dispatch' }> =>
        effect.type === 'command.dispatch',
    )
    expect(commands).toHaveLength(1)
    expect(commands[0]?.command.payload).toMatchObject({
      updates: [{
        nodeId: 'node',
        transform: expect.objectContaining({ x: 80, y: 90 }),
      }],
    })
  })

  // OpenSpec: stage-engine / 资源批量外部拖入会话 / 取消资源拖入
  it('OpenSpec: stage-engine / 取消外部拖入 / 清空 preview 且不产生 drop', () => {
    const { controller, effects } = connect()
    controller.send({
      type: 'external.begin',
      item: {
        kind: 'assets',
        items: [{
          providerId: 'memory',
          assetKey: 'logo',
          scope: 'persistent',
          name: 'logo.svg',
          mediaType: 'image/svg+xml',
        }],
      },
      clientPoint: { x: 10, y: 20 },
    })
    controller.send({ type: 'external.cancel' })

    expect(controller.getSnapshot()).toMatchObject({
      phase: 'idle',
      external: null,
    })
    expect(effects.some((effect) => effect.type === 'external.drop')).toBe(false)
  })

  it('OpenSpec: stage-engine / Surface 生命周期 / 断开时清理 external preview', () => {
    const { controller, disconnect } = connect()
    controller.send({
      type: 'external.begin',
      item: { kind: 'component', componentType: 'box' },
      clientPoint: { x: 20, y: 20 },
    })

    disconnect()

    expect(controller.getSnapshot()).toMatchObject({
      phase: 'idle',
      external: null,
    })
  })

  // OpenSpec: stage-engine / 世界几何保持的结构命令 / Resize Frame 不缩放孩子
  it('OpenSpec: stage / Frame resize / 只改变 Frame 边界且保持后代局部几何', () => {
    const { controller, effects, context } = connect()
    controller.updateContext({
      ...context,
      selectedIds: ['frame'],
    })
    controller.send({
      type: 'pointer.down',
      pointerId: 10,
      button: 0,
      point: { x: 400, y: 300 },
      hit: { kind: 'resize', handle: 'se' },
      modifiers: { shift: false, alt: false, command: true },
    })
    controller.send({
      type: 'pointer.up',
      pointerId: 10,
      point: { x: 800, y: 600 },
      modifiers: { shift: false, alt: false, command: true },
    })

    const dispatch = [...effects].reverse().find(
      (effect): effect is Extract<StageInteractionEffect, { type: 'command.dispatch' }> =>
        effect.type === 'command.dispatch',
    )
    expect(dispatch?.command.payload).toEqual({
      updates: [{
        nodeId: 'frame',
        transform: {
          x: 0,
          y: 0,
          width: 800,
          height: 600,
          rotation: 0,
        },
      }],
    })
  })

  it('OpenSpec: stage / 多选 resize / 只规划顶层 Frame 与 Component', () => {
    const { controller, effects, context } = connect()
    controller.updateContext({
      ...context,
      document: mixedDocument,
      selectedIds: ['group', 'sibling'],
    })
    controller.send({
      type: 'pointer.down',
      pointerId: 12,
      button: 0,
      point: { x: 120, y: 60 },
      hit: { kind: 'resize', handle: 'se' },
      modifiers: { shift: false, alt: false, command: true },
    })
    controller.send({
      type: 'pointer.up',
      pointerId: 12,
      point: { x: 220, y: 90 },
      modifiers: { shift: false, alt: false, command: true },
    })

    const dispatch = [...effects].reverse().find(
      (effect): effect is Extract<StageInteractionEffect, { type: 'command.dispatch' }> =>
        effect.type === 'command.dispatch',
    )
    const updates = dispatch?.command.payload.updates
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'group' }),
      expect.objectContaining({ nodeId: 'sibling' }),
    ]))
    expect(updates).toHaveLength(2)
  })

  it('OpenSpec: stage-engine / Frame resize / 后代局部 transform 保持不变', () => {
    const { controller, effects, context } = connect()
    controller.updateContext({
      ...context,
      document: groupDocument,
      selectedIds: ['group'],
    })
    controller.send({
      type: 'pointer.down',
      pointerId: 11,
      button: 0,
      point: { x: 60, y: 60 },
      hit: { kind: 'resize', handle: 'se' },
      modifiers: { shift: false, alt: false, command: true },
    })
    controller.send({
      type: 'pointer.up',
      pointerId: 11,
      point: { x: 100, y: 90 },
      modifiers: { shift: false, alt: false, command: true },
    })

    const dispatch = [...effects].reverse().find(
      (effect): effect is Extract<StageInteractionEffect, { type: 'command.dispatch' }> =>
        effect.type === 'command.dispatch',
    )
    expect(dispatch?.command.payload).toEqual({
      updates: [{
        nodeId: 'group',
        transform: expect.objectContaining({ width: 80, height: 60 }),
      }],
    })
  })
})
