import { describe, expect, it } from 'vitest'
import { createStageInteractionController } from '../interaction-controller'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { createStageDrawPlugin, STAGE_DRAW_PLUGIN_ID } from './draw-plugin'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import type { StageInteractionEffect, StageInteractionHit } from '../interaction-controller'

const MODIFIERS = { shift: false, alt: false, command: false }
const value = document([entity('a', { x: 0, y: 0, width: 100, height: 50 })])

function drawSetup(tool = 'draw-rectangle') {
  const effects: StageInteractionEffect[] = []
  const controller = createStageInteractionController()
  controller.connectSurface({
    resolveClientPoint: (point) => point,
    applyEffects: (next) => effects.push(...next),
  })
  const update = (patch: Record<string, unknown> = {}) => {
    controller.updateContext({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool,
      selectedIds: [],
      idFactory: () => 'draw-id',
      ...patch,
    } as never)
  }
  update()
  const down = (hit: StageInteractionHit = { kind: 'surface' }) => controller.send({
    type: 'pointer.down',
    pointerId: 1,
    button: 0,
    point: { x: 20, y: 20 },
    hit,
    modifiers: MODIFIERS,
  })
  const commits = () => effects.filter((effect) => effect.type === 'drawing.commit')
  return { controller, effects, update, down, commits }
}

describe('OpenSpec: stage-engine / Headless 绘制会话 / 独立插件承担', () => {
  it('draw 插件优先级与表一致', () => {
    const fromTable = STAGE_GESTURE_PRIORITY.find(({ id }) => id === STAGE_DRAW_PLUGIN_ID)

    expect(createStageDrawPlugin().priority).toBe(fromTable?.priority)
  })

  it('压在节点上也起笔', () => {
    const { controller, down } = drawSetup()

    down({ kind: 'entity', entityId: 'a' })

    // 画布上已有内容不该挡住继续作图。
    expect(controller.getSnapshot().phase).toBe('draw')
  })

  it('并发文档变化不打断绘制', () => {
    const { controller, update, down, commits } = drawSetup()
    down()
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 80, y: 60 }, modifiers: MODIFIERS })

    // 退出文字编辑时删除空文字就会在同一次按下里改动文档；一并中止会让紧接着开始的绘制
    // 当场消失。绘制只由世界坐标定义，因此**刻意**不接空间基线。
    const next = document([entity('a', { x: 0, y: 0, width: 100, height: 50 })])
    update({ document: next, layoutSnapshot: layoutSnapshot(next) })

    expect(controller.getSnapshot().phase).toBe('draw')
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 80, y: 60 }, modifiers: MODIFIERS })
    expect(commits()).toHaveLength(1)
  })

  it('工具切换中止绘制', () => {
    const { controller, update, down, commits } = drawSetup()
    down()
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 80, y: 60 }, modifiers: MODIFIERS })

    // 换工具是用户改了主意，与文档被别处改动是两回事。
    update({ tool: 'select' })

    expect(controller.getSnapshot().phase).toBe('idle')
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 80, y: 60 }, modifiers: MODIFIERS })
    expect(commits()).toHaveLength(0)
  })

  it('没有移动的按下不创建图形', () => {
    const { controller, down, commits } = drawSetup()
    down()
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 20, y: 20 }, modifiers: MODIFIERS })

    // 零尺寸的框来自一次没有真正移动的按下。
    expect(commits()).toHaveLength(0)
  })

  it('文字工具没有尺寸门槛，按点即创建', () => {
    const { controller, down, commits } = drawSetup('draw-text')
    down()
    controller.send({ type: 'pointer.up', pointerId: 1, point: { x: 20, y: 20 }, modifiers: MODIFIERS })

    expect(commits()).toHaveLength(1)
    expect(commits()[0]).toMatchObject({ tool: 'draw-text', bounds: { width: 0, height: 0 } })
  })

  it('取消不创建任何图形', () => {
    const { controller, effects, down, commits } = drawSetup()
    down()
    controller.send({ type: 'pointer.move', pointerId: 1, point: { x: 80, y: 60 }, modifiers: MODIFIERS })
    controller.send({ type: 'pointer.cancel', pointerId: 1 })

    expect(controller.getSnapshot().drawing).toBeNull()
    expect(effects).toContainEqual({ type: 'pointer.release', pointerId: 1 })
    expect(commits()).toHaveLength(0)
  })
})
