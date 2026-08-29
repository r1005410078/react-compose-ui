import { describe, expect, it } from 'vitest'
import {
  createStageArcSession,
  createStageCircleSession,
  createStagePolylineSession,
  createStageRectangleSession,
} from './shape-commands'
import {
  createStageArrowSession,
  createStageDraftingCommands,
  createStageLineSession,
} from './line-command'
import type { StageDraftingContext, StageDraftingMessages } from './drafting-types'

const messages: StageDraftingMessages = {
  drawCategory: '绘图',
  editCategory: '编辑',
  specifyFirstPoint: '指定第一点',
  specifyNextPoint: '指定下一点（回车结束）',
  specifyEndPoint: '指定端点',
  expectedPoint: '需要一个点',
  lineTitle: '直线',
  arrowTitle: '箭头',
  wireTitle: '导线',
  selectObjects: '选择对象',
  expectedSelection: '需要选择对象',
  basePoint: '指定基点',
  displacementPoint: '指定第二点',
  moveTitle: '移动',
  copyTitle: '复制',
  eraseTitle: '删除',
  vertexTitle: '编辑顶点',
  specifyNewLocation: '指定新位置',
  expectedSingleObject: '只能选择一个对象',
  arcTitle: '圆弧',
  circleTitle: '圆',
  rectangleTitle: '矩形',
  polylineTitle: '多段线',
  specifyThroughPoint: '指定圆弧上的一点',
  specifyCenter: '指定圆心',
  specifyRadius: '指定半径',
  specifyDiameter: '指定直径',
  diameterKeyword: '直径',
  radiusKeyword: '半径',
  specifyCorner: '指定第一个角点',
  specifyOppositeCorner: '指定对角点',
  closeKeyword: '闭合',
  undoKeyword: '放弃',
  collinearArc: '三点共线，无法定弧',
  degenerateShape: '这个形状是退化的',
}

const context: StageDraftingContext = { messages }

describe('OpenSpec: stage-engine / 成批作业的命令提交后接着画', () => {
  const byId = new Map(createStageDraftingCommands(messages).map((c) => [c.id, c]))

  it('箭头声明重开', () => {
    // 判据是「用户画完之后想对它做什么」：箭头是成批标注出来的。
    expect(byId.get('ARROW')?.repeat).toBe(true)
  })

  it('取够即结束的形状命令不声明', () => {
    /*
     * 矩形、圆、弧画完九成是填色、调圆角、往里塞东西。给它们也重开的话，想调刚画的那个
     * 得先按一次 `Escape`，而那一下按键不携带任何信息。`LINE` 与 `PLINE` 本来就连续取点。
     */
    for (const id of ['RECTANGLE', 'CIRCLE', 'ARC', 'LINE', 'PLINE']) {
      expect(byId.get(id)?.repeat).toBeUndefined()
    }
  })
})

describe('ARROW 命令', () => {
  it('OpenSpec: stage-engine / 绘图命令复用泛型命令引擎 / 第二步不说「回车结束」', () => {
    const session = createStageArrowSession({ messages } as never)
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    /*
     * 取够两点自己就提交，因此这一步没有「怎么结束」这个问题——沿用 `LINE` 那句会让提示说
     * 一件在这里做不到的事。既有规范明写：取够点自己就提交的命令不得带这句提示。
     */
    expect(session.prompt?.message).toBe(messages.specifyEndPoint)
    expect(session.prompt?.message).not.toBe(messages.specifyNextPoint)
  })
})

describe('LINE 命令', () => {
  it('OpenSpec: stage-engine / LINE 取点落在端口上即绑定 / 效果上没有导线标记', () => {
    // `WIRE` 合并进 `LINE` 之后没有第二种线可分，标记因此整个删掉而不是恒为真。绑定由宿主
    // 按取点时记下的来源接上，本包不认识端口。
    const session = createStageLineSession({ messages } as never)
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    const step = session.advance({ kind: 'point', point: { x: 100, y: 0 } })

    const commit = step.status === 'prompt' ? step.commit : undefined
    expect(commit?.curves).toEqual([{ kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }])
    expect(commit && 'wire' in commit).toBe(false)
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
    expect(session.prompt?.message).toBe(messages.specifyEndPoint)

    // 收回第三点之后可以直接重取。
    const retry = session.advance({ kind: 'point', point: { x: 50, y: 50 } })
    expect(retry.status).toBe('commit')
  })

  it('OpenSpec: stage-engine / 圆与弧各步声明自己的参数化 / 只有端点步画被量的那一段', () => {
    const session = createStageArcSession(context)
    expect(session.prompt).toMatchObject({ fields: 'absolute' })

    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    // 途经点步的预览**就是**那条直线，再画一遍就是同一条线加粗。
    expect(session.prompt).toMatchObject({ fields: 'polar' })
    expect(session.prompt?.measured).toBeUndefined()
    expect(session.preview?.({ x: 100, y: 0 })?.curves?.[0]).toMatchObject({ kind: 'line' })

    const step = session.advance({ kind: 'point', point: { x: 50, y: 50 } })
    // 端点步的预览换成了弧，途经点到落点那一段不在弧上。
    expect(session.prompt).toMatchObject({ fields: 'polar', measured: true })
    // 两个数从**上一个点**起算：第三点从途经点。
    expect(step.status === 'prompt' && step.preview?.reference).toEqual({ x: 50, y: 50 })
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

  describe('OpenSpec: stage-engine / CIRCLE 在半径与直径之间切换', () => {
    /** 取过圆心的 `CIRCLE`。 */
    function afterCenter() {
      const session = createStageCircleSession(context)
      session.advance({ kind: 'point', point: { x: 50, y: 50 } })
      return session
    }

    it('半径步是单字段、打开被量的那一段，且只列出能切过去的那一个', () => {
      const session = afterCenter()
      expect(session.prompt).toMatchObject({
        message: '指定半径', fields: 'radius', measured: true,
      })
      expect(session.prompt?.keywords).toEqual([{ key: 'D', label: '直径' }])
    })

    it('D 一次改提示、参数化与关键字三样', () => {
      const session = afterCenter()
      const step = session.advance({ kind: 'keyword', key: 'D' })

      expect(step.status).toBe('prompt')
      expect(session.prompt).toMatchObject({
        message: '指定直径', fields: 'diameter', measured: true,
      })
      // 列一个按下去只会把当前状态再确认一遍的关键字，等于给用户一个没有效果的选项。
      expect(session.prompt?.keywords).toEqual([{ key: 'R', label: '半径' }])
    })

    it('R 切回半径', () => {
      const session = afterCenter()
      session.advance({ kind: 'keyword', key: 'D' })
      session.advance({ kind: 'keyword', key: 'R' })
      expect(session.prompt).toMatchObject({ message: '指定半径', fields: 'radius' })
    })

    it('切换不改变落地的几何——半径由落点算，不由档位算', () => {
      const session = afterCenter()
      session.advance({ kind: 'keyword', key: 'D' })
      const step = session.advance({ kind: 'point', point: { x: 80, y: 90 } })

      if (step.status !== 'commit') throw new Error('半径点之后应当提交')
      const [curve] = step.effect.curves ?? []
      if (curve?.kind !== 'arc') throw new Error('整圆应当是弧')
      // 直径档只改「这个数怎么读」，落点仍然是圆上的一个点。
      expect(curve.radius).toBeCloseTo(50, 6)
    })

    it('圆心还没取时无档可切', () => {
      const session = createStageCircleSession(context)
      expect(session.advance({ kind: 'keyword', key: 'D' }).status).toBe('rejected')
      expect(session.prompt?.message).toBe('指定圆心')
    })

    it('下一次 CIRCLE 从半径起步', () => {
      const used = afterCenter()
      used.advance({ kind: 'keyword', key: 'D' })
      // 记住上一次的选择会让这条命令有一份看不见的状态。
      expect(afterCenter().prompt?.fields).toBe('radius')
    })
  })
})

describe('RECTANGLE 命令', () => {
  it('OpenSpec: stage-engine / 绘图命令 / 矩形产出盒而不是曲线', () => {
    const session = createStageRectangleSession(context)
    session.advance({ kind: 'point', point: { x: 10, y: 20 } })
    const step = session.advance({ kind: 'point', point: { x: 110, y: 70 } })

    if (step.status !== 'commit') throw new Error('对角点之后应当提交')
    // 意图由命令显式说出：按 kind 反推是错的——`PLINE` 画四点按 `C` 同样得到闭合四顶点折线。
    expect(step.effect.curves).toBeUndefined()
    expect(step.effect.boxes).toEqual([{ x: 10, y: 20, width: 100, height: 50 }])
  })

  it('往左上拖也归一成左上角加正宽高', () => {
    const session = createStageRectangleSession(context)
    session.advance({ kind: 'point', point: { x: 110, y: 70 } })
    const step = session.advance({ kind: 'point', point: { x: 10, y: 20 } })

    if (step.status !== 'commit') throw new Error('对角点之后应当提交')
    expect(step.effect.boxes).toEqual([{ x: 10, y: 20, width: 100, height: 50 }])
  })

  it('两角共轴时退化，被拒绝', () => {
    const session = createStageRectangleSession(context)
    session.advance({ kind: 'point', point: { x: 10, y: 20 } })

    expect(session.advance({ kind: 'point', point: { x: 110, y: 20 } }).status).toBe('rejected')
  })
})

describe('PLINE 命令', () => {
  it('OpenSpec: stage-engine / 连续取点命令的闭合关键字 / PLINE 闭合置位并提交', () => {
    const session = createStagePolylineSession(context)
    for (const point of [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }]) {
      session.advance({ kind: 'point', point })
    }
    expect(session.prompt?.keywords).toEqual([
      { key: 'C', label: '闭合' },
      { key: 'U', label: '放弃' },
    ])

    const step = session.advance({ kind: 'keyword', key: 'C' })
    // 攒到结束才提交，因此闭合是把 `closed` 置位——顶点仍是三个，不重复第一个。
    if (step.status !== 'commit') throw new Error('闭合之后应当提交并结束')
    expect(step.effect.curves?.[0]).toEqual({
      kind: 'polyline',
      vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }],
      closed: true,
    })
  })

  it('OpenSpec: stage-engine / 连续取点命令的闭合关键字 / 两个顶点围不出面积，没有闭合', () => {
    const session = createStagePolylineSession(context)
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    session.advance({ kind: 'point', point: { x: 100, y: 0 } })

    expect(session.prompt?.keywords).toEqual([{ key: 'U', label: '放弃' }])
    expect(session.advance({ kind: 'keyword', key: 'C' }).status).toBe('rejected')
  })

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

describe('OpenSpec: stage-engine / 预览几何 / 会话回答「落在这里会是什么样」', () => {
  it('多段线预览含已取的全部点，而不只是最后一段', () => {
    const session = createStagePolylineSession(context)
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    session.advance({ kind: 'point', point: { x: 10, y: 10 } })
    session.advance({ kind: 'point', point: { x: 20, y: 0 } })

    const curve = session.preview?.({ x: 30, y: 10 })?.curves?.[0]
    // 判别点是**四**：`PLINE` 攒到结束才提交，在那之前没画出来的部分对用户就是不存在的。
    expect(curve).toMatchObject({ kind: 'polyline', closed: false })
    expect(curve?.kind === 'polyline' ? curve.vertices : []).toEqual([
      { x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }, { x: 30, y: 10 },
    ])
  })

  it('矩形预览是一个盒而不是对角线', () => {
    const session = createStageRectangleSession(context)
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })

    // 形状只有命令知道：两个对角点怎么变一个盒，宿主算不出来。预览与提交是同一种表示，
    // 让预览回折线、提交回盒会产生一处只有实现者知道的不对称。
    expect(session.preview?.({ x: 40, y: 20 })).toEqual({
      boxes: [{ x: 0, y: 0, width: 40, height: 20 }],
    })
  })

  it('圆预览是整圆而不是半径线', () => {
    const session = createStageCircleSession(context)
    session.advance({ kind: 'point', point: { x: 10, y: 10 } })

    expect(session.preview?.({ x: 40, y: 10 })?.curves?.[0])
      .toMatchObject({ kind: 'arc', radius: 30, sweep: 360 })
  })

  it('还没取到第一个点时没有可呈现的内容', () => {
    expect(createStagePolylineSession(context).preview?.({ x: 1, y: 1 })).toBeNull()
    expect(createStageRectangleSession(context).preview?.({ x: 1, y: 1 })).toBeNull()
    expect(createStageCircleSession(context).preview?.({ x: 1, y: 1 })).toBeNull()
  })

  it('查询不推进会话', () => {
    const session = createStagePolylineSession(context)
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    session.advance({ kind: 'point', point: { x: 10, y: 0 } })

    const before = session.prompt
    for (let index = 0; index < 5; index += 1) session.preview?.({ x: index, y: index })

    // 查询若真的推进了状态，「取了几个点」就会跟着鼠标动——而撤销、关键字与提示都挂在
    // 那个计数上。这里的证据是提交出来的顶点数没变。
    expect(session.prompt).toEqual(before)
    const step = session.advance({ kind: 'accept' })
    const curve = step.status === 'commit' ? step.effect?.curves?.[0] : undefined
    expect(curve?.kind === 'polyline' ? curve.vertices : []).toHaveLength(2)
  })
})
