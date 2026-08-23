import { describe, expect, it } from 'vitest'
import { createStageInteractionController } from '../interaction-controller'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import type { StageInteractionEffect } from '../interaction-controller'

// command 关掉网格吸附，让断言直接落在指针位移上。
const FREE = { shift: false, alt: false, command: true }

const value = document([
  entity('dragged', { x: 0, y: 0, width: 40, height: 40 }),
  entity('target', { x: 400, y: 0, width: 200, height: 200, childIds: [] }),
])

/**
 * 起一次移动手势。
 *
 * @remarks
 * 从 `move` 工具的轴向手柄改成 `select` 工具直接拖实体——轴向手柄随 `move` 工具一起删除了
 * （`MOVE` 命令能键入精确位移，严格更强）。这几条用例要的是「移动进行中」这个状态，
 * 至于它是怎么起来的无关紧要。
 */
function moveSetup(patch: Record<string, unknown> = {}) {
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
      tool: 'select',
      selectedIds: ['dragged'],
      idFactory: () => 'move-id',
      ...patch,
      ...next,
    } as never)
  }
  update()
  const grab = () => {
    controller.send({
      type: 'pointer.down',
      pointerId: 1,
      button: 0,
      point: { x: 10, y: 10 },
      hit: { kind: 'entity', entityId: 'dragged' },
      modifiers: FREE,
    })
    // 移动有激活阈值：不越过它手势还停在 idle。
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 30, y: 30 }, modifiers: FREE })
  }
  const commands = () => effects.filter((effect) => effect.type === 'command.dispatch')
  return { controller, effects, update, grab, commands }
}


describe('OpenSpec: stage-engine / 画布拖拽 reparent 会话 / Space 在移动中表达锁定原父级', () => {
  it('移动进行中按 Space 不切换临时平移标志', () => {
    const { controller, grab } = moveSetup()
    grab()
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 210, y: 130 }, modifiers: FREE })

    controller.send({ type: 'temporary-pan.start' })

    // 两种意图不会同时出现：手势中按不下第二个指针开始平移。判据由会话自报
    // （consumesTemporaryPan），内核不认识手势种类。
    expect(controller.getSnapshot().temporaryPan).toBe(false)
    expect(controller.getSnapshot().phase).toBe('move')
  })

  it('空闲时按 Space 仍然切换临时平移标志', () => {
    const { controller } = moveSetup()

    controller.send({ type: 'temporary-pan.start' })

    expect(controller.getSnapshot().temporaryPan).toBe(true)
  })

  it('Space 锁定原父级后经过容器不产生 reparent 落点', () => {
    const { controller, grab } = moveSetup()
    grab()
    // 拖到 target 容器体上：默认解析出 reparent 落点。
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 500, y: 110 }, modifiers: FREE })
    expect(controller.getSnapshot().dropTarget).toMatchObject({ kind: 'reparent', containerId: 'target' })

    controller.send({ type: 'temporary-pan.start' })

    // 原地重算而不是等下一次移动：锁定状态要立刻反映在落点高亮上。
    expect(controller.getSnapshot().dropTarget)
      .not.toMatchObject({ kind: 'reparent', containerId: 'target' })
  })

  it('松开 Space 后落点恢复', () => {
    const { controller, grab } = moveSetup()
    grab()
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 500, y: 110 }, modifiers: FREE })
    controller.send({ type: 'temporary-pan.start' })
    controller.send({ type: 'temporary-pan.end' })

    expect(controller.getSnapshot().dropTarget).toMatchObject({ kind: 'reparent', containerId: 'target' })
    // 结束平移键不该把会话当成 pan 取消掉。
    expect(controller.getSnapshot().phase).toBe('move')
  })
})
