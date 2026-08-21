import { describe, expect, it } from 'vitest'
import { createStageInteractionController } from '../interaction-controller'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import { createStageMoveAxisPlugin, STAGE_MOVE_AXIS_PLUGIN_ID } from './move-plugin'
import type { StageInteractionEffect } from '../interaction-controller'

// command 关掉网格吸附，让断言直接落在指针位移上。
const FREE = { shift: false, alt: false, command: true }

const value = document([
  entity('dragged', { x: 0, y: 0, width: 40, height: 40 }),
  entity('target', { x: 400, y: 0, width: 200, height: 200, childIds: [] }),
])

function moveAxisSetup(patch: Record<string, unknown> = {}) {
  const effects: StageInteractionEffect[] = []
  const controller = createStageInteractionController()
  controller.connectSurface({
    resolveClientPoint: (point) => point,
    applyEffects: (next) => effects.push(...next),
  })
  const update = (next: Record<string, unknown> = {}) => {
    controller.updateContext({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'move',
      selectedIds: ['dragged'],
      idFactory: () => 'move-id',
      ...patch,
      ...next,
    } as never)
  }
  update()
  const grabAxis = (axis: 'x' | 'y' = 'x') => controller.send({
    type: 'pointer.down',
    pointerId: 1,
    button: 0,
    point: { x: 10, y: 10 },
    hit: { kind: 'move-axis', axis },
    modifiers: FREE,
  })
  const commands = () => effects.filter((effect) => effect.type === 'command.dispatch')
  return { controller, effects, update, grabAxis, commands }
}

describe('OpenSpec: stage-engine / 受约束变换 System / 轴向移动手柄插件', () => {
  it('move-axis 插件优先级与表一致', () => {
    const fromTable = STAGE_GESTURE_PRIORITY
      .find(({ id }) => id === STAGE_MOVE_AXIS_PLUGIN_ID)

    expect(createStageMoveAxisPlugin().priority).toBe(fromTable?.priority)
  })

  it('拖动 X 轴手柄只改变 X', () => {
    const { controller, grabAxis } = moveAxisSetup()
    grabAxis('x')

    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 210, y: 130 }, modifiers: FREE })

    expect(controller.getSnapshot().previewTransforms.dragged).toMatchObject({ x: 200, y: 0 })
  })

  it('非 move 工具下命中手柄被消费，不退化成自由拖动', () => {
    const { controller, effects } = moveAxisSetup({ tool: 'select' })

    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 10, y: 10 },
      hit: { kind: 'move-axis', axis: 'x' },
      modifiers: FREE,
    })

    expect(effects).toEqual([])
    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('松手请求一次命令', () => {
    const { controller, grabAxis, commands } = moveAxisSetup()
    grabAxis('x')
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 210, y: 130 }, modifiers: FREE })
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 210, y: 130 }, modifiers: FREE })

    expect(commands()).toHaveLength(1)
  })

  it('并发文档变化中止移动且不提交', () => {
    const { controller, update, grabAxis, commands } = moveAxisSetup()
    grabAxis('x')
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 210, y: 130 }, modifiers: FREE })

    const next = document([
      entity('dragged', { x: 0, y: 0, width: 40, height: 40 }),
      entity('target', { x: 400, y: 0, width: 200, height: 200, childIds: [] }),
    ])
    update({ document: next, layoutSnapshot: layoutSnapshot(next) })

    expect(controller.getSnapshot().phase).toBe('idle')
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 210, y: 130 }, modifiers: FREE })
    expect(commands()).toHaveLength(0)
  })
})

describe('OpenSpec: stage-engine / 画布拖拽 reparent 会话 / Space 在移动中表达锁定原父级', () => {
  it('移动进行中按 Space 不切换临时平移标志', () => {
    const { controller, grabAxis } = moveAxisSetup()
    grabAxis('x')
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 210, y: 130 }, modifiers: FREE })

    controller.send({ type: 'temporary-pan.start' })

    // 两种意图不会同时出现：手势中按不下第二个指针开始平移。判据由会话自报
    // （consumesTemporaryPan），内核不认识手势种类。
    expect(controller.getSnapshot().temporaryPan).toBe(false)
    expect(controller.getSnapshot().phase).toBe('move')
  })

  it('空闲时按 Space 仍然切换临时平移标志', () => {
    const { controller } = moveAxisSetup()

    controller.send({ type: 'temporary-pan.start' })

    expect(controller.getSnapshot().temporaryPan).toBe(true)
  })

  it('Space 锁定原父级后经过容器不产生 reparent 落点', () => {
    const { controller, grabAxis } = moveAxisSetup()
    grabAxis('x')
    // 拖到 target 容器体上：默认解析出 reparent 落点。
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 500, y: 110 }, modifiers: FREE })
    expect(controller.getSnapshot().dropTarget).toMatchObject({ kind: 'reparent', containerId: 'target' })

    controller.send({ type: 'temporary-pan.start' })

    // 原地重算而不是等下一次移动：锁定状态要立刻反映在落点高亮上。
    expect(controller.getSnapshot().dropTarget)
      .not.toMatchObject({ kind: 'reparent', containerId: 'target' })
  })

  it('松开 Space 后落点恢复', () => {
    const { controller, grabAxis } = moveAxisSetup()
    grabAxis('x')
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 500, y: 110 }, modifiers: FREE })
    controller.send({ type: 'temporary-pan.start' })
    controller.send({ type: 'temporary-pan.end' })

    expect(controller.getSnapshot().dropTarget).toMatchObject({ kind: 'reparent', containerId: 'target' })
    // 结束平移键不该把会话当成 pan 取消掉。
    expect(controller.getSnapshot().phase).toBe('move')
  })
})
