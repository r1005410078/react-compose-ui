import { describe, expect, it } from 'vitest'
import {
  COMPOSE_POLYGON_MAX_SIDES,
  COMPOSE_POLYGON_MIN_SIDES,
  createStageArcSession,
  createStageCircleSession,
  createStagePolygonSession,
  createStagePolylineSession,
  createStageRectangleSession,
} from './shape-commands'
import {
  createStageArrowSession,
  createStageDraftingCommands,
  createStageLineSession,
  createStageWireSession,
} from './line-command'
import type {
  StageDraftingContext,
  StageDraftingEffect,
  StageDraftingMessages,
} from './drafting-types'

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
  flattenTitle: '拍平',
  unionTitle: '并集',
  subtractTitle: '差集',
  intersectTitle: '交集',
  excludeTitle: '异或',
  vertexTitle: '编辑顶点',
  specifyNewLocation: '指定新位置',
  expectedSingleObject: '只能选择一个对象',
  trimTitle: '修剪',
  selectTrimTarget: '选择要修剪的一截，或按住拖过多条（回车结束）:',
  expectedPick: '需要点一下要修剪的一截',
  hatchTitle: '填充',
  pickHatchPoint: '点一下要填充的区域内部（回车结束）:',
  expectedHatchPoint: '需要点一下要填充的区域内部',
  hatchColorKeyword: '颜色',
  specifyHatchColor: '输入填充色（如 #3f5068）:',
  invalidHatchColor: '读不出这个颜色，试试 #3f5068',
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
  polygonTitle: '多边形',
  specifySides: (sides: number) => `输入边数 <${sides}>`,
  specifyPolygonCenter: (sides: number) => `指定中心点 [${sides} 边]`,
  specifyInscribedRadius: (sides: number) => `指定内接圆半径 [${sides} 边]`,
  specifyCircumscribedRadius: (sides: number) => `指定外切圆半径 [${sides} 边]`,
  inscribedKeyword: '内接',
  circumscribedKeyword: '外切',
  inscribedChip: '内接',
  circumscribedChip: '外切',
  moreSidesKeyword: '加一边',
  fewerSidesKeyword: '减一边',
  invalidSides: (min: number, max: number) => `边数必须是 ${min} 到 ${max} 之间的整数`,
  mirrorTitle: '镜像',
  mirrorFirstPoint: '指定镜像轴的第一点',
  mirrorSecondPoint: '指定镜像轴的第二点',
  mirrorDegenerateAxis: '两点重合，定不出镜像轴',
  alignLeftTitle: '左对齐',
  alignCenterXTitle: '水平居中',
  alignRightTitle: '右对齐',
  alignTopTitle: '顶对齐',
  alignCenterYTitle: '垂直居中',
  alignBottomTitle: '底对齐',
  distributeXTitle: '水平等距',
  distributeYTitle: '垂直等距',
  alignmentNeedsMore: (minimum: number) => `至少需要选中 ${minimum} 个对象`,
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

describe('WIRE 命令', () => {
  /** 喂一串点，返回每一步的结果。 */
  const pick = (session: ReturnType<typeof createStageWireSession>, ...points: { x: number; y: number }[]) =>
    points.map((point) => session.advance({ kind: 'point', point }))
  /** 一步的提交内容；不是 `prompt` 那一档时为 undefined。 */
  const committed = (step: ReturnType<ReturnType<typeof createStageWireSession>['advance']>) => (
    step.status === 'prompt' ? step.commit : undefined
  )

  it('OpenSpec: stage-engine / 导线每取一个点就落地 / 第二个点就产出一条可落地的曲线', () => {
    const session = createStageWireSession(context)
    const [first, second] = pick(session, { x: 0, y: 0 }, { x: 100, y: 0 })

    // 第一个点还构不成一段：一个点的导线画不出来。
    expect(committed(first!)).toBeUndefined()
    const commit = committed(second!)
    expect(commit?.curves).toEqual([{ kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }])
    expect(commit?.wire).toBe(true)
    // 此刻还没有可替换的对象，但这一条还没画完。
    expect(commit && 'replaceLastCreated' in commit).toBe(false)
    expect(commit?.pending).toBe(true)
  })

  it('OpenSpec: stage-engine / 导线每取一个点就落地 / 第三个点起是替换而不是新建', () => {
    const session = createStageWireSession(context)
    const [, , third] = pick(session, { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 })

    const commit = committed(third!)
    expect(commit?.curves).toEqual([{
      kind: 'polyline',
      vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }],
      closed: false,
    }])
    expect(commit?.replaceLastCreated).toBe(true)
    expect(commit?.pending).toBe(true)
  })

  it('OpenSpec: stage-engine / 导线每取一个点就落地 / 结束那一步不再是「还没画完」', () => {
    const session = createStageWireSession(context)
    pick(session, { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 })
    const step = session.advance({ kind: 'accept' })

    expect(step.status).toBe('commit')
    const effect = step.status === 'commit' ? step.effect : undefined
    // 接入节点只在这一步做：中途路过另一条导线不是接线意图。
    expect(effect?.pending).toBeUndefined()
    expect(effect?.replaceLastCreated).toBe(true)
    expect(effect?.curves?.[0]).toMatchObject({ kind: 'polyline' })
  })

  it('OpenSpec: stage-engine / 导线每取一个点就落地 / 放弃上一点把几何收回去', () => {
    const session = createStageWireSession(context)
    pick(session, { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 })
    const step = session.advance({ kind: 'keyword', key: 'U' })

    const commit = committed(step)
    // 只动会话的话（`PLINE` 的 `U` 就是那样）屏幕上那条线纹丝不动，而提示已经回退了一步。
    expect(commit?.curves).toEqual([{ kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }])
    expect(commit?.replaceLastCreated).toBe(true)
  })

  it('OpenSpec: stage-engine / 导线每取一个点就落地 / 放弃到只剩一个点时删掉那条线', () => {
    const session = createStageWireSession(context)
    pick(session, { x: 0, y: 0 }, { x: 100, y: 0 })
    const step = session.advance({ kind: 'keyword', key: 'U' })

    const commit = committed(step)
    expect(commit?.undoLastCreated).toBe(true)
    expect(commit?.curves).toBeUndefined()
  })

  it('OpenSpec: stage-engine / 导线每取一个点就落地 / 取消时说出要删掉哪一条', () => {
    const session = createStageWireSession(context)
    pick(session, { x: 0, y: 0 }, { x: 100, y: 0 })
    const step = session.advance({ kind: 'cancel' })

    expect(step.status).toBe('cancelled')
    expect(step.status === 'cancelled' ? step.effect?.undoLastCreated : undefined).toBe(true)
  })

  it('OpenSpec: stage-engine / 导线每取一个点就落地 / 一个点都没取过的取消不带效果', () => {
    const session = createStageWireSession(context)
    pick(session, { x: 0, y: 0 })
    const step = session.advance({ kind: 'cancel' })

    expect(step.status === 'cancelled' ? step.effect : undefined).toBeUndefined()
  })

  it('OpenSpec: stage-engine / 导线每取一个点就落地 / 预览只有待定的那一段', () => {
    const session = createStageWireSession(context)
    pick(session, { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 })

    // 已落地的部分是真的 Entity、由渲染器画；预览再画一遍就是同一条线画两遍。
    expect(session.preview?.({ x: 200, y: 80 })?.curves).toEqual([
      { kind: 'line', start: { x: 100, y: 80 }, end: { x: 200, y: 80 } },
    ])
  })

  it('OpenSpec: stage-engine / 导线每取一个点就落地 / 原地点两下不落地', () => {
    const session = createStageWireSession(context)
    const [, second] = pick(session, { x: 0, y: 0 }, { x: 0, y: 0 })

    // 退化的导线画不出来：顶点数已经是 2，但这一步什么都不该落地。
    expect(committed(second!)).toBeUndefined()
    expect(session.advance({ kind: 'cancel' }).status === 'cancelled').toBe(true)
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

/** 左上起顺时针的四个角；两个断言各写一遍会让「往哪边拖」那条用例失去判别力。 */
const RECTANGLE_VERTICES = [
  { x: 10, y: 20 }, { x: 110, y: 20 }, { x: 110, y: 70 }, { x: 10, y: 70 },
]

describe('RECTANGLE 命令', () => {
  it('OpenSpec: stage-engine / 绘图命令 / 矩形产出闭合多段线', () => {
    const session = createStageRectangleSession(context)
    session.advance({ kind: 'point', point: { x: 10, y: 20 } })
    const step = session.advance({ kind: 'point', point: { x: 110, y: 70 } })

    if (step.status !== 'commit') throw new Error('对角点之后应当提交')
    expect(step.effect.curves).toEqual([{
      kind: 'polyline',
      vertices: RECTANGLE_VERTICES,
      closed: true,
    }])
  })

  it('往左上拖也归一成同一个绕向', () => {
    const session = createStageRectangleSession(context)
    session.advance({ kind: 'point', point: { x: 110, y: 70 } })
    const step = session.advance({ kind: 'point', point: { x: 10, y: 20 } })

    if (step.status !== 'commit') throw new Error('对角点之后应当提交')
    // 谁在左上由用户往哪个方向拖决定，而矩形的表示只有一种。
    expect(step.effect.curves?.[0]).toMatchObject({ vertices: RECTANGLE_VERTICES })
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

  it('矩形预览是闭合四顶点而不是对角线', () => {
    const session = createStageRectangleSession(context)
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })

    // 形状只有命令知道：两个对角点怎么变四个顶点，宿主算不出来。预览与提交是同一种表示，
    // 两者各算一遍会产生一处只有实现者知道的不对称。
    expect(session.preview?.({ x: 40, y: 20 })).toEqual({
      curves: [{
        kind: 'polyline',
        vertices: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 }],
        closed: true,
      }],
      // 意图由命令显式说出：宿主据此挑 `rect` Preset，而不是按 kind 反推。
      rectangle: true,
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


/*
 * 判别性用例都从「内接与外切的差别只有一句话——落点是顶点还是边的中点」反推，而不是断言
 * 「画出来了」——那两档都会绿。
 */
describe('OpenSpec: stage-engine / POLYGON 命令画正多边形', () => {
  const context: StageDraftingContext = { messages }
  const vertexCountOf = (effect: StageDraftingEffect | undefined) => {
    const curve = effect?.curves?.[0]
    return curve?.kind === 'polyline' ? curve.vertices.length : -1
  }

  it('直接确认取用尖括号里的默认边数', () => {
    const session = createStagePolygonSession(context)
    expect(session.prompt?.message).toContain('<6>')
    const step = session.advance({ kind: 'accept' })
    expect(step.status).toBe('prompt')
    // 确认之后走到中心步，而不是取消整条命令。
    if (step.status === 'prompt') expect(step.prompt.message).toContain('中心点')
  })

  it('起始边数由宿主给出，改变时回调', () => {
    const seen: number[] = []
    const session = createStagePolygonSession({
      messages,
      polygonSides: 8,
      onPolygonSidesChange: (sides) => { seen.push(sides) },
    })
    expect(session.prompt?.message).toContain('<8>')
    session.advance({ kind: 'keyword', key: '+' })
    expect(seen).toEqual([9])
  })

  it('边数越界或不是整数被拒绝且不结束会话', () => {
    const session = createStagePolygonSession(context)
    for (const text of ['2', '2000', '5.5', 'abc']) {
      const step = session.advance({ kind: 'text', text })
      expect(step.status).toBe('rejected')
    }
    // 会话仍停在边数步。
    expect(session.prompt?.accepts).toContain('text')
  })

  it('同一个中心与落点，内接与外切产出不同的顶点', () => {
    const draw = (fit?: 'C') => {
      const session = createStagePolygonSession(context)
      // 档位在**第一步**换，此后一路跟到提交。
      if (fit) session.advance({ kind: 'keyword', key: fit })
      session.advance({ kind: 'accept' })
      session.advance({ kind: 'point', point: { x: 100, y: 100 } })
      return session.advance({ kind: 'point', point: { x: 160, y: 100 } })
    }
    const inscribed = draw()
    const circumscribed = draw('C')
    expect(inscribed.status).toBe('commit')
    expect(circumscribed.status).toBe('commit')
    if (inscribed.status !== 'commit' || circumscribed.status !== 'commit') return
    const first = (step: typeof inscribed) => {
      const curve = step.effect.curves?.[0]
      return curve?.kind === 'polyline' ? curve.vertices[0]! : null
    }
    expect(first(inscribed)).not.toEqual(first(circumscribed))
    // 外切的顶点在构造圆外，因此离中心更远。
    const radius = (vertex: { x: number, y: number } | null) => (
      vertex ? Math.hypot(vertex.x - 100, vertex.y - 100) : 0
    )
    expect(radius(first(circumscribed))).toBeGreaterThan(radius(first(inscribed)))
  })

  it('第一步只列出能切过去的那一档，并把当前档位印在光标旁', () => {
    const session = createStagePolygonSession(context)
    const keys = () => session.prompt?.keywords?.map((keyword) => keyword.key) ?? []
    expect(keys()).toContain('C')
    expect(keys()).not.toContain('I')
    expect(session.prompt?.cursorInput?.value).toBe('6')
    expect(session.prompt?.cursorInput?.toggle).toEqual({ value: '内接', keyword: 'C' })
    session.advance({ kind: 'keyword', key: 'C' })
    expect(keys()).toContain('I')
    expect(keys()).not.toContain('C')
    expect(session.prompt?.cursorInput?.toggle).toEqual({ value: '外切', keyword: 'I' })
  })

  /*
   * 这一版真正要钉住的那条：后两步**收干净了**。半个残留最糟——列不出来却仍然受理，等于留
   * 一条只有读过源码的人才知道的暗门；因此既断关键字没列出来，也断按下去不起作用。
   */
  it('后两步既不列出档位也不受理它', () => {
    const session = createStagePolygonSession(context)
    session.advance({ kind: 'accept' })
    const centerKeys = session.prompt?.keywords?.map((keyword) => keyword.key) ?? []
    expect(centerKeys).not.toContain('C')
    expect(centerKeys).not.toContain('I')
    expect(session.prompt?.cursorInput).toBeUndefined()

    session.advance({ kind: 'point', point: { x: 100, y: 100 } })
    const radiusKeys = session.prompt?.keywords?.map((keyword) => keyword.key) ?? []
    expect(radiusKeys).not.toContain('C')
    expect(radiusKeys).not.toContain('I')

    const before = session.preview?.({ x: 160, y: 100 })
    expect(session.advance({ kind: 'keyword', key: 'C' }).status).toBe('rejected')
    // 形状一点没变：被拒绝的关键字不该留下任何痕迹。
    expect(session.preview?.({ x: 160, y: 100 })).toEqual(before)
  })

  it('档位由宿主持有，跨命令记住', () => {
    const seen: string[] = []
    const session = createStagePolygonSession({
      messages,
      onPolygonFitChange: (fit) => { seen.push(fit) },
    })
    session.advance({ kind: 'keyword', key: 'C' })
    expect(seen).toEqual(['circumscribed'])
    // 同一档再按一次不回调：没有真的变化时宿主那份值不该被写一遍。
    session.advance({ kind: 'keyword', key: 'C' })
    expect(seen).toEqual(['circumscribed'])

    const next = createStagePolygonSession({ messages, polygonFit: 'circumscribed' })
    expect(next.prompt?.cursorInput?.toggle?.value).toBe('外切')
    next.advance({ kind: 'accept' })
    next.advance({ kind: 'point', point: { x: 0, y: 0 } })
    expect(next.prompt?.message).toContain('外切')
  })

  /*
   * 十字光标在第一步是画着的，让它真的能落点比把它画成装饰要好——「鼠标动了也没反应」是屏幕
   * 上不该出现的状态。判别点是**那一下就是中心**而不是「进到了下一步」。
   */
  it('第一步收点即取用默认边数并把那一下当作中心', () => {
    const session = createStagePolygonSession(context)
    expect(session.prompt?.accepts).toContain('point')
    const step = session.advance({ kind: 'point', point: { x: 100, y: 100 } })
    expect(step.status).toBe('prompt')
    if (step.status === 'prompt') expect(step.preview?.reference).toEqual({ x: 100, y: 100 })
    expect(session.prompt?.fields).toBe('radius')
    expect(vertexCountOf(session.preview?.({ x: 160, y: 100 }) ?? undefined)).toBe(6)
  })

  it('增减边数在每一步都可用，且当场改变预览', () => {
    const session = createStagePolygonSession(context)
    expect(session.prompt?.keywords?.map((keyword) => keyword.key)).toContain('+')
    session.advance({ kind: 'accept' })
    expect(session.prompt?.keywords?.map((keyword) => keyword.key)).toContain('+')
    session.advance({ kind: 'point', point: { x: 100, y: 100 } })
    expect(vertexCountOf(session.preview?.({ x: 160, y: 100 }) ?? undefined)).toBe(6)
    session.advance({ kind: 'keyword', key: '+' })
    expect(vertexCountOf(session.preview?.({ x: 160, y: 100 }) ?? undefined)).toBe(7)
    // 会话仍停在半径步。
    expect(session.prompt?.fields).toBe('radius')
  })

  it('增减到边界停住而不回绕', () => {
    const session = createStagePolygonSession({ messages, polygonSides: COMPOSE_POLYGON_MIN_SIDES })
    session.advance({ kind: 'keyword', key: '-' })
    expect(session.prompt?.message).toContain(`<${COMPOSE_POLYGON_MIN_SIDES}>`)
    const upper = createStagePolygonSession({ messages, polygonSides: COMPOSE_POLYGON_MAX_SIDES })
    upper.advance({ kind: 'keyword', key: '+' })
    expect(upper.prompt?.message).toContain(`<${COMPOSE_POLYGON_MAX_SIDES}>`)
  })

  it('半径步是单字段且画出被量的那一段', () => {
    const session = createStagePolygonSession(context)
    session.advance({ kind: 'accept' })
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    expect(session.prompt?.fields).toBe('radius')
    expect(session.prompt?.measured).toBe(true)
  })

  it('预览是完整多边形，不是半径线', () => {
    const session = createStagePolygonSession(context)
    session.advance({ kind: 'accept' })
    // 取到中心之前没有形状可言。
    expect(session.preview?.({ x: 10, y: 10 })).toBeNull()
    session.advance({ kind: 'point', point: { x: 100, y: 100 } })
    const preview = session.preview?.({ x: 160, y: 100 })
    expect(preview?.curves?.[0]).toMatchObject({ kind: 'polyline', closed: true })
    expect(vertexCountOf(preview ?? undefined)).toBe(6)
  })

  it('落点与中心重合被拒绝且不结束会话', () => {
    const session = createStagePolygonSession(context)
    session.advance({ kind: 'accept' })
    session.advance({ kind: 'point', point: { x: 100, y: 100 } })
    const step = session.advance({ kind: 'point', point: { x: 100, y: 100 } })
    expect(step.status).toBe('rejected')
    expect(session.prompt?.fields).toBe('radius')
  })

  it('提交的是闭合多段线，且不带任何意图标记', () => {
    const session = createStagePolygonSession(context)
    session.advance({ kind: 'text', text: '5' })
    session.advance({ kind: 'point', point: { x: 100, y: 100 } })
    const step = session.advance({ kind: 'point', point: { x: 160, y: 100 } })
    expect(step.status).toBe('commit')
    if (step.status !== 'commit') return
    expect(step.effect.curves?.[0]).toMatchObject({ kind: 'polyline', closed: true })
    expect(vertexCountOf(step.effect)).toBe(5)
    expect(step.effect.rectangle).toBeUndefined()
    expect(step.effect.arrow).toBeUndefined()
    expect(step.effect.wire).toBeUndefined()
  })

  it('注册表里可以按 POL 解析到它', () => {
    const command = createStageDraftingCommands(messages).find(({ id }) => id === 'POLYGON')
    expect(command?.aliases).toContain('POL')
    // 画完一个多边形九成是填色、接线、改顶点，因此不接着画。
    expect(command?.repeat).toBeUndefined()
  })
})
