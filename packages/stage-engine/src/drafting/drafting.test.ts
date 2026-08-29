import { createComposeLineCurve, normalizeComposeCurveGeometry, type ComposeCurve } from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { createComposeCommandRegistry, resolveComposeCommand } from '@compose-ui/commands'
import { createStageDraftingCommands, createStageLineSession } from './line-command'
import type { StageDraftingContext } from './drafting-types'
import { createStageSceneIndex, findStageFeaturePoint } from '../hit-testing'
import { document, entity, layoutSnapshot } from '../test-fixtures'

const messages = {
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

describe('LINE 命令', () => {
  it('逐段落地：第一点只是起点，之后每一点提交一段', () => {
    const session = createStageLineSession(context)
    expect(session.prompt?.message).toBe('指定第一点')

    const first = session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    expect(first.status).toBe('prompt')
    // 一个点还构不成一段，因此没有 commit。
    if (first.status === 'prompt') expect(first.commit).toBeUndefined()
    expect(session.prompt?.message).toBe(messages.specifyNextPoint)

    const second = session.advance({ kind: 'point', point: { x: 100, y: 0 } })
    if (second.status !== 'prompt') throw new Error('第二点应当继续等待下一点')
    expect(second.commit?.curves).toEqual([
      { kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
    ])

    const third = session.advance({ kind: 'point', point: { x: 100, y: 50 } })
    if (third.status !== 'prompt') throw new Error('第三点应当继续等待下一点')
    // 每一段只提交自己，不重复提交上一段。
    expect(third.commit?.curves).toEqual([
      { kind: 'line', start: { x: 100, y: 0 }, end: { x: 100, y: 50 } },
    ])
  })

  it('参照点始终是上一个已确定的点', () => {
    const session = createStageLineSession(context)
    session.advance({ kind: 'point', point: { x: 10, y: 20 } })
    const step = session.advance({ kind: 'point', point: { x: 30, y: 40 } })
    if (step.status !== 'prompt') throw new Error('应当继续等待下一点')
    expect(step.preview?.reference).toEqual({ x: 30, y: 40 })
  })

  it('Esc 中止会话，Enter 是正常结束', () => {
    const escaped = createStageLineSession(context)
    escaped.advance({ kind: 'point', point: { x: 0, y: 0 } })
    expect(escaped.advance({ kind: 'cancel' }).status).toBe('cancelled')

    // 两者都留住已画的线，因此宿主只能靠 status 区分提示文案；回 cancelled 的话，用户
    // 画完一条线按 Enter 会看到「已取消」。
    const accepted = createStageLineSession(context)
    accepted.advance({ kind: 'point', point: { x: 0, y: 0 } })
    expect(accepted.advance({ kind: 'accept' }).status).toBe('commit')
  })

  it('一点都没取时 Enter 什么也没发生', () => {
    const session = createStageLineSession(context)
    expect(session.advance({ kind: 'accept' }).status).toBe('cancelled')
  })

  it('非点输入被拒绝且不结束会话', () => {
    const session = createStageLineSession(context)
    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    const step = session.advance({ kind: 'text', text: 'WAT' })
    expect(step.status).toBe('rejected')
    // 拒绝之后提示不变，用户可以接着取点——点错、打错在这类工具里是常态。
    expect(session.prompt?.message).toBe(messages.specifyNextPoint)
    expect(session.advance({ kind: 'point', point: { x: 5, y: 5 } }).status).toBe('prompt')
  })

  it('命令按名称与别名解析', () => {
    const commands = createStageDraftingCommands(messages)
    expect(commands.map(({ id }) => id)).toEqual([
      'LINE', 'WIRE', 'ARROW', 'ARC', 'CIRCLE', 'RECTANGLE', 'PLINE',
      'MOVE', 'COPY', 'ERASE', 'VERTEX',
    ])
    expect(commands[0]?.aliases).toEqual(['L'])
    // 导线在一次接线图上是独立的活儿（红色粗实线、只走横平竖直、可以有拐点），因此有自己
    // 的词；`LINE` 顺手吸上端口时同样绑定，两条路都通，没有「画错就永远接不上」这一档。
    expect(commands.flatMap(({ aliases }) => aliases ?? [])).toContain('WI')
  })

  describe('OpenSpec: stage-engine / 连续取点命令的闭合关键字', () => {
    it('LINE 闭合补上收尾那一段', () => {
      const session = createStageLineSession(context)
      for (const point of [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }]) {
        session.advance({ kind: 'point', point })
      }
      const step = session.advance({ kind: 'keyword', key: 'C' })

      // 逐段落地，因此闭合是「补最后一段」而不是「把 closed 置位」——两条命令的 `C` 同名
      // 而机制不同。
      if (step.status !== 'commit') throw new Error('闭合之后应当提交并结束')
      expect(step.effect.curves).toEqual([
        { kind: 'line', start: { x: 100, y: 80 }, end: { x: 0, y: 0 } },
      ])
    })

    it('OpenSpec: stage-engine / LINE 的放弃上一段 / U 回退一个点并带上撤销标记', () => {
      const session = createStageLineSession(context)
      for (const point of [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }]) {
        session.advance({ kind: 'point', point })
      }
      const step = session.advance({ kind: 'keyword', key: 'U' })

      if (step.status !== 'prompt') throw new Error('放弃之后会话应当继续')
      // 会话只回退自己的点序列；那一段的 Entity 由宿主删——引擎建不了也记不住 id。
      expect(step.commit).toEqual({ undoLastCreated: true })
      expect(step.preview?.reference).toEqual({ x: 100, y: 0 })

      // 回退之后从 b 接着画：新的一段从 b 连出去，而不是从已经不存在的 c。
      const next = session.advance({ kind: 'point', point: { x: 200, y: 0 } })
      if (next.status !== 'prompt') throw new Error('取点之后会话应当继续')
      expect(next.commit?.curves).toEqual([
        { kind: 'line', start: { x: 100, y: 0 }, end: { x: 200, y: 0 } },
      ])
    })

    it('退到只剩一个点之后不再列出关键字', () => {
      const session = createStageLineSession(context)
      session.advance({ kind: 'point', point: { x: 0, y: 0 } })
      session.advance({ kind: 'point', point: { x: 100, y: 0 } })
      session.advance({ kind: 'keyword', key: 'U' })

      expect(session.prompt?.keywords ?? []).toHaveLength(0)
      // 第一个点没有对应的段，再退一次什么都不该发生。
      expect(session.advance({ kind: 'keyword', key: 'U' }).status).toBe('rejected')
    })

    it('只取过一个点时没有闭合关键字，键入也被拒', () => {
      const session = createStageLineSession(context)
      session.advance({ kind: 'point', point: { x: 0, y: 0 } })
      expect(session.prompt?.keywords ?? []).toHaveLength(0)
      expect(session.advance({ kind: 'keyword', key: 'C' }).status).toBe('rejected')
    })

    it('取过两个点之后提示里出现闭合', () => {
      const session = createStageLineSession(context)
      session.advance({ kind: 'point', point: { x: 0, y: 0 } })
      session.advance({ kind: 'point', point: { x: 100, y: 0 } })
      expect(session.prompt?.keywords).toEqual([
        { key: 'C', label: '闭合' },
        { key: 'U', label: '放弃' },
      ])
    })
  })

  it('OpenSpec: stage-engine / 单键快捷键同时是命令别名 / 六条绘图命令各有一个单字母别名', () => {
    const registry = createComposeCommandRegistry(createStageDraftingCommands(messages))
    // 用户只记一套词：按 `P` 与在命令行敲 `P↵` 必须指向同一条命令。
    const single: readonly (readonly [string, string])[] = [
      ['L', 'LINE'], ['P', 'PLINE'], ['R', 'RECTANGLE'],
      // `W` 随 `WIRE` 一起删掉：导线合并进 `LINE` 之后没有第二种线可分。
      ['C', 'CIRCLE'], ['A', 'ARC'], ['X', 'ARROW'],
    ]
    for (const [key, id] of single) {
      expect(resolveComposeCommand(registry, key)?.id).toBe(id)
    }
    // 反向不成立：多字母别名不因此被要求有对应的快捷键，它们照旧可用。
    expect(resolveComposeCommand(registry, 'REC')?.id).toBe('RECTANGLE')
  })

  it('OpenSpec: stage-engine / 绘图命令 / ARROW 取两点即结束并标记为箭头', () => {
    const command = createStageDraftingCommands(messages).find(({ id }) => id === 'ARROW')!
    expect(command.aliases).toEqual(['AR', 'X'])
    const session = command.start({ messages })

    expect(session.advance({ kind: 'point', point: { x: 10, y: 10 } }).status).toBe('prompt')
    const step = session.advance({ kind: 'point', point: { x: 60, y: 40 } })

    // 一支箭头只有一个头：取两点就结束，不像 `LINE` 那样连着画。
    expect(step.status).toBe('commit')
    const effect = step.status === 'commit' ? step.effect : undefined
    expect(effect?.curves).toHaveLength(1)
    // 引擎只给出一个标记：它不认识 Renderer props，也不认识 Preset id。
    expect(effect?.arrow).toBe(true)
  })

  it('OpenSpec: stage-engine / LINE 取点落在端口上即绑定 / 效果上不再有导线标记', () => {
    const command = createStageDraftingCommands(messages).find(({ id }) => id === 'LINE')!
    const session = command.start({ messages })

    session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    const step = session.advance({ kind: 'point', point: { x: 40, y: 0 } })

    // 合并之后没有第二种线可分，因此标记整个删掉而不是恒为真——恒为真的标记会让读代码的人
    // 以为还存在另一种情形。端点绑到哪个端口由宿主按取点时记下的来源判定，几何本身够用：
    // 曲线的两个端点就是那两次落点。
    const commit = step.status === 'prompt' ? step.commit : undefined
    expect(commit?.curves).toHaveLength(1)
    expect(commit && 'wire' in commit).toBe(false)
  })
})

function curveEntity(
  id: string,
  start: { readonly x: number; readonly y: number },
  end: { readonly x: number; readonly y: number },
) {
  const next = normalizeComposeCurveGeometry(createComposeLineCurve(start, end))
  const base = entity(id, {
    x: next.offset.x,
    y: next.offset.y,
    width: next.size.width,
    height: next.size.height,
  })
  return {
    ...base,
    components: { ...base.components, Renderer: { type: 'curve', props: {} }, Curve: next.curve },
  }
}

function shapeEntity(id: string, curve: ComposeCurve) {
  const next = normalizeComposeCurveGeometry(curve)
  const base = entity(id, {
    x: next.offset.x,
    y: next.offset.y,
    width: next.size.width,
    height: next.size.height,
  })
  return {
    ...base,
    components: { ...base.components, Renderer: { type: 'curve', props: {} }, Curve: next.curve },
  }
}

function indexFor(value: ReturnType<typeof document>) {
  return createStageSceneIndex(value, layoutSnapshot(value))
}

describe('弧与多段线的特征点', () => {
  // 圆心 (200,200)、半径 100、0°→90°：端点 (300,200) 与 (200,300)，象限点同为这两个。
  const arc = shapeEntity('arc', {
    kind: 'arc',
    center: { x: 200, y: 200 },
    radius: 100,
    startAngle: 0,
    sweep: 90,
  })
  const arcDoc = document([arc], ['arc'])

  it('OpenSpec: stage-engine / 特征点捕捉 / 弧提供圆心', () => {
    const hit = findStageFeaturePoint(arcDoc, indexFor(arcDoc), { x: 202, y: 201 }, 8)

    // 圆心不是任何线段的端点，只能由弧提供。
    expect(hit).toMatchObject({ mode: 'center', entityId: 'arc' })
    expect(hit?.point.x).toBeCloseTo(200, 6)
    expect(hit?.point.y).toBeCloseTo(200, 6)
  })

  it('OpenSpec: stage-engine / 特征点捕捉 / 弧的象限点排在圆心之后', () => {
    // 180° 象限点 (100,200) 不在 0°→90° 的扫掠内，因此不产生候选。
    expect(findStageFeaturePoint(arcDoc, indexFor(arcDoc), { x: 100, y: 200 }, 8)).toBeNull()
  })

  it('OpenSpec: stage-engine / 端口捕捉 / 端口压过更近的端点', () => {
    // 端口落在 (300,200)，与弧的一个端点重合；另一条线的端点落在 (302,201)，离光标更近。
    const port = {
      ...entity('device', { x: 300, y: 200, width: 40, height: 40 }),
      components: {
        ...entity('device', { x: 300, y: 200, width: 40, height: 40 }).components,
        Ports: { items: [{ id: 'L1', position: { x: 0, y: 0 } }] },
      },
    }
    const near = curveEntity('near', { x: 302, y: 201 }, { x: 400, y: 300 })
    const value = document([port, near], ['device', 'near'])

    const hit = findStageFeaturePoint(value, indexFor(value), { x: 302, y: 201 }, 8)

    // 端点正落在光标上，端口差 2 个单位——优先级严格先于距离。
    expect(hit).toMatchObject({ mode: 'port', entityId: 'device' })
    expect(hit?.point).toMatchObject({ x: 300, y: 200 })
  })

  it('OpenSpec: stage-engine / 端口捕捉 / 没有端口的 Entity 不产生候选', () => {
    const plain = entity('plain', { x: 300, y: 200, width: 40, height: 40 })
    const value = document([plain], ['plain'])

    expect(findStageFeaturePoint(value, indexFor(value), { x: 300, y: 200 }, 8)).toBeNull()
  })

  it('OpenSpec: stage-engine / 特征点捕捉 / 多段线顶点按端点优先级返回', () => {
    const polyline = shapeEntity('poly', {
      kind: 'polyline',
      vertices: [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }],
      closed: false,
    })
    const value = document([polyline], ['poly'])

    // 中间顶点是两段共用的端点，不是任何一段的中点。
    const hit = findStageFeaturePoint(value, indexFor(value), { x: 302, y: 101 }, 8)
    expect(hit).toMatchObject({ mode: 'endpoint', entityId: 'poly' })
    expect(hit?.point).toEqual({ x: 300, y: 100 })

    // 第二段的中点照常提供。
    expect(findStageFeaturePoint(value, indexFor(value), { x: 301, y: 201 }, 8))
      .toMatchObject({ mode: 'midpoint' })
  })

  it('OpenSpec: stage-engine / 特征点捕捉 / 点级排除只收走那一个点', () => {
    const polyline = shapeEntity('poly', {
      kind: 'polyline',
      vertices: [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }],
      closed: false,
    })
    const value = document([polyline], ['poly'])
    const index = indexFor(value)

    // 排除首顶点：它自己不再是候选……
    expect(findStageFeaturePoint(value, index, { x: 101, y: 101 }, 8, [], { x: 100, y: 100 }))
      .toBeNull()
    // ……而**同一条**多段线的其他顶点与各段中点照常命中。用整个 Entity 去排除时这两条都会
    // 一起失效，而它们正是「把这个角对到那个角上」要用的。
    expect(findStageFeaturePoint(value, index, { x: 302, y: 101 }, 8, [], { x: 100, y: 100 }))
      .toMatchObject({ mode: 'endpoint', entityId: 'poly' })
    expect(findStageFeaturePoint(value, index, { x: 201, y: 101 }, 8, [], { x: 100, y: 100 }))
      .toMatchObject({ mode: 'midpoint', entityId: 'poly' })
  })

  it('闭合多段线多出的那一段同样提供中点', () => {
    const closed = shapeEntity('closed', {
      kind: 'polyline',
      vertices: [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }],
      closed: true,
    })
    const value = document([closed], ['closed'])

    // 闭合边 (300,300)→(100,100) 的中点是 (200,200)。
    expect(findStageFeaturePoint(value, indexFor(value), { x: 201, y: 200 }, 8))
      .toMatchObject({ mode: 'midpoint' })
  })
})

describe('OpenSpec: stage-engine / 命中与捕捉应用同一个盒到几何的变换 / 特征点跟着几何走', () => {
  it('拉宽后端点落在新形状上', () => {
    const next = normalizeComposeCurveGeometry(
      createComposeLineCurve({ x: 100, y: 100 }, { x: 200, y: 200 }),
    )
    const base = entity('curve', {
      x: next.offset.x,
      y: next.offset.y,
      // 盒拉到几何紧包围盒的两倍宽；几何数值一个都没变。
      width: next.size.width * 2,
      height: next.size.height,
    })
    const stretched = {
      ...base,
      components: { ...base.components, Renderer: { type: 'curve', props: {} }, Curve: next.curve },
    }
    const value = document([stretched], ['curve'])
    const index = indexFor(value)

    // 端点搬到了 x = 300。漏掉投影时它会停在旧位置 200，而那正是「捕捉到看不见的点」。
    const moved = findStageFeaturePoint(value, index, { x: 300, y: 200 }, 8)
    expect(moved).toMatchObject({ mode: 'endpoint', entityId: 'curve' })
    expect(moved?.point.x).toBeCloseTo(300, 6)

    expect(findStageFeaturePoint(value, index, { x: 200, y: 200 }, 8)).toBeNull()
  })
})

describe('特征点捕捉', () => {
  const line = curveEntity('line', { x: 100, y: 100 }, { x: 300, y: 100 })
  const doc = document([line], ['line'])

  it('命中端点', () => {
    const hit = findStageFeaturePoint(doc, indexFor(doc), { x: 303, y: 102 }, 8)
    expect(hit).toMatchObject({ mode: 'endpoint', entityId: 'line' })
    expect(hit?.point).toEqual({ x: 300, y: 100 })
  })

  it('命中中点', () => {
    const hit = findStageFeaturePoint(doc, indexFor(doc), { x: 201, y: 101 }, 8)
    expect(hit).toMatchObject({ mode: 'midpoint' })
    expect(hit?.point).toEqual({ x: 200, y: 100 })
  })

  it('容差内端点压过中点，即使中点更近', () => {
    // 光标 (210,100)：中点 (200,100) 距离 10，端点 (300,100) 距离 90，两者都在容差内。
    // 优先级严格先于距离：端点压过中点，即使中点更近。
    const hit = findStageFeaturePoint(doc, indexFor(doc), { x: 210, y: 100 }, 100)
    expect(hit?.mode).toBe('endpoint')
  })

  it('同一优先级内取最近的一个', () => {
    // 两个端点都在容差内时按距离分胜负。
    const hit = findStageFeaturePoint(doc, indexFor(doc), { x: 280, y: 100 }, 250)
    expect(hit?.point).toEqual({ x: 300, y: 100 })
  })

  it('容差之外不命中', () => {
    expect(findStageFeaturePoint(doc, indexFor(doc), { x: 320, y: 100 }, 8)).toBeNull()
  })

  it('容差随缩放换算后结果一致', () => {
    const screenTolerance = 8
    // world = 屏幕 / zoom：漏乘 zoom 时 zoom 恒为 1 的用例仍然会绿。
    expect(findStageFeaturePoint(doc, indexFor(doc), { x: 312, y: 100 }, screenTolerance / 0.5))
      .not.toBeNull()
    expect(findStageFeaturePoint(doc, indexFor(doc), { x: 312, y: 100 }, screenTolerance / 2))
      .toBeNull()
  })

  it('不返回盒的角点', () => {
    const box = entity('rect', { x: 500, y: 500, width: 100, height: 100 })
    const withBox = document([box], ['rect'])
    // 盒角点属于「对齐」语义，由既有的 guide 吸附覆盖；两套同时生效会互相拉扯。
    expect(findStageFeaturePoint(withBox, indexFor(withBox), { x: 500, y: 500 }, 8)).toBeNull()
  })

  it('排除的 Entity 不参与捕捉', () => {
    expect(findStageFeaturePoint(doc, indexFor(doc), { x: 300, y: 100 }, 8, ['line'])).toBeNull()
  })
})
