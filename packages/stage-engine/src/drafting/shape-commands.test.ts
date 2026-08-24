import { describe, expect, it } from 'vitest'
import {
  createStageArcSession,
  createStageCircleSession,
  createStagePolylineSession,
  createStageRectangleSession,
} from './shape-commands'
import { createStageLineSession, createStageWireSession } from './line-command'
import type { StageDraftingContext, StageDraftingMessages } from './drafting-types'

const messages: StageDraftingMessages = {
  drawCategory: '绘图',
  editCategory: '编辑',
  specifyFirstPoint: '指定第一点',
  specifyNextPoint: '指定下一点',
  expectedPoint: '需要一个点',
  lineTitle: '直线',
  wireTitle: '导线',
  selectObjects: '选择对象',
  expectedSelection: '需要选择对象',
  basePoint: '指定基点',
  displacementPoint: '指定第二点',
  moveTitle: '移动',
  copyTitle: '复制',
  eraseTitle: '删除',
  arcTitle: '圆弧',
  circleTitle: '圆',
  rectangleTitle: '矩形',
  polylineTitle: '多段线',
  specifyThroughPoint: '指定圆弧上的一点',
  specifyCenter: '指定圆心',
  specifyRadius: '指定半径',
  specifyCorner: '指定第一个角点',
  specifyOppositeCorner: '指定对角点',
  undoKeyword: '放弃',
  collinearArc: '三点共线，无法定弧',
  degenerateShape: '这个形状是退化的',
}

const context: StageDraftingContext = { messages }

describe('WIRE 命令', () => {
  it('取两个点即结束，产出的曲线带 wire 标记', () => {
    const session = createStageWireSession({ messages } as never)
    expect(session.advance({ kind: 'point', point: { x: 0, y: 0 } }).status).toBe('prompt')
    const step = session.advance({ kind: 'point', point: { x: 100, y: 0 } })

    expect(step.status).toBe('commit')
    expect(step.status === 'commit' ? step.effect : null).toMatchObject({
      wire: true,
      curves: [{ kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }],
    })
  })

  it('LINE 不带 wire 标记，即使端点吸附到了端口上', () => {
    // 绑定改变对象此后的行为，意图必须显式——捕捉到端口不等于用户想接线。
    const session = createStageLineSession({ messages } as never)
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    const step = session.advance({ kind: 'point', point: { x: 100, y: 0 } })

    expect(step.status === 'prompt' ? step.commit?.wire : undefined).toBeUndefined()
  })
})

describe('ARC 命令', () => {
  it('OpenSpec: stage-engine / 绘图命令 / 三点定弧', () => {
    const session = createStageArcSession(context)
    session.advance({ kind: 'point', point: { x: 100, y: 0 } })
    session.advance({ kind: 'point', point: { x: 0, y: 100 } })
    const step = session.advance({ kind: 'point', point: { x: -100, y: 0 } })

    if (step.status !== 'commit') throw new Error('第三点之后应当提交')
    const [curve] = step.effect.curves ?? []
    if (curve?.kind !== 'arc') throw new Error('应当产出弧')
    expect(curve.center.x).toBeCloseTo(0, 6)
    expect(curve.center.y).toBeCloseTo(0, 6)
    expect(curve.radius).toBeCloseTo(100, 6)
  })

  it('OpenSpec: stage-engine / 绘图命令 / 三点共线的弧被拒绝', () => {
    const session = createStageArcSession(context)
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    session.advance({ kind: 'point', point: { x: 50, y: 0 } })
    const step = session.advance({ kind: 'point', point: { x: 100, y: 0 } })

    // 沿一条既有直线连点三下很常见：必须是可预期的拒绝而不是产出一个半径巨大的假弧，
    // 而且不能结束会话——用户只是最后一点点歪了。
    expect(step.status).toBe('rejected')
    expect(session.prompt?.message).toBe('指定下一点')

    // 收回第三点之后可以直接重取。
    const retry = session.advance({ kind: 'point', point: { x: 50, y: 50 } })
    expect(retry.status).toBe('commit')
  })
})

describe('CIRCLE 命令', () => {
  it('OpenSpec: compose-document / 曲线是带盒的普通 Entity / 整圆是扫掠 360 的弧', () => {
    const session = createStageCircleSession(context)
    session.advance({ kind: 'point', point: { x: 50, y: 50 } })
    const step = session.advance({ kind: 'point', point: { x: 80, y: 90 } })

    if (step.status !== 'commit') throw new Error('半径点之后应当提交')
    const [curve] = step.effect.curves ?? []
    if (curve?.kind !== 'arc') throw new Error('整圆应当是弧')
    expect(curve.sweep).toBe(360)
    expect(curve.radius).toBeCloseTo(50, 6)
  })

  it('半径为零被拒绝且不结束会话', () => {
    const session = createStageCircleSession(context)
    session.advance({ kind: 'point', point: { x: 50, y: 50 } })
    const step = session.advance({ kind: 'point', point: { x: 50, y: 50 } })

    expect(step.status).toBe('rejected')
    expect(session.prompt?.message).toBe('指定半径')
  })
})

describe('RECTANGLE 命令', () => {
  it('OpenSpec: compose-document / 曲线是带盒的普通 Entity / 矩形是闭合多段线', () => {
    const session = createStageRectangleSession(context)
    session.advance({ kind: 'point', point: { x: 10, y: 20 } })
    const step = session.advance({ kind: 'point', point: { x: 110, y: 70 } })

    if (step.status !== 'commit') throw new Error('对角点之后应当提交')
    const [curve] = step.effect.curves ?? []
    if (curve?.kind !== 'polyline') throw new Error('矩形应当是多段线')
    expect(curve.closed).toBe(true)
    expect(curve.vertices).toEqual([
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 70 },
      { x: 10, y: 70 },
    ])
  })

  it('两角共轴时退化，被拒绝', () => {
    const session = createStageRectangleSession(context)
    session.advance({ kind: 'point', point: { x: 10, y: 20 } })

    expect(session.advance({ kind: 'point', point: { x: 110, y: 20 } }).status).toBe('rejected')
  })
})

describe('PLINE 命令', () => {
  it('OpenSpec: stage-engine / 绘图命令 / 多段线攒成一个 Entity', () => {
    const session = createStagePolylineSession(context)
    for (const point of [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]) {
      const step = session.advance({ kind: 'point', point })
      // 逐点期间不提交任何东西——这正是它与 LINE 的差别。
      if (step.status !== 'prompt') throw new Error('取点期间应当继续等待')
      expect(step.commit).toBeUndefined()
    }

    const done = session.advance({ kind: 'accept' })
    if (done.status !== 'commit') throw new Error('确认应当提交')
    const curves = done.effect.curves ?? []
    expect(curves).toHaveLength(1)
    if (curves[0]?.kind !== 'polyline') throw new Error('应当产出多段线')
    expect(curves[0].vertices).toHaveLength(4)
  })

  it('OpenSpec: stage-engine / 绘图命令 / 多段线可放弃上一点', () => {
    const session = createStagePolylineSession(context)
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    session.advance({ kind: 'point', point: { x: 100, y: 0 } })
    session.advance({ kind: 'point', point: { x: 100, y: 100 } })

    const undone = session.advance({ kind: 'keyword', key: 'U' })
    // 放弃的是会话里的顶点，此刻文档上什么都还没有——因此这一步不该是文档撤销。
    if (undone.status !== 'prompt') throw new Error('放弃之后应当继续等待')
    expect(undone.preview?.reference).toEqual({ x: 100, y: 0 })

    const done = session.advance({ kind: 'accept' })
    if (done.status !== 'commit') throw new Error('确认应当提交')
    const [curve] = done.effect.curves ?? []
    if (curve?.kind !== 'polyline') throw new Error('应当产出多段线')
    expect(curve.vertices).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }])
  })

  it('第二点之后才出现放弃关键字', () => {
    const session = createStagePolylineSession(context)
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    expect(session.prompt?.keywords).toBeUndefined()
    session.advance({ kind: 'point', point: { x: 100, y: 0 } })
    expect(session.prompt?.keywords).toEqual([{ key: 'U', label: '放弃' }])
  })

  it('不足两个顶点时确认什么也不提交', () => {
    const session = createStagePolylineSession(context)
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })

    expect(session.advance({ kind: 'accept' }).status).toBe('cancelled')
  })
})
