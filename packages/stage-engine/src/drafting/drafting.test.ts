import { createComposeLineCurve, normalizeComposeCurveGeometry, type ComposeCurve } from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { createStageDraftingCommands, createStageLineSession } from './line-command'
import type { StageDraftingContext } from './drafting-types'
import { createStageSceneIndex, findStageFeaturePoint } from '../hit-testing'
import { document, entity, layoutSnapshot } from '../test-fixtures'

const messages = {
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

describe('LINE 命令', () => {
  it('逐段落地：第一点只是起点，之后每一点提交一段', () => {
    const session = createStageLineSession(context)
    expect(session.prompt?.message).toBe('指定第一点')

    const first = session.advance({ kind: 'point', point: { x: 0, y: 0 } })
    expect(first.status).toBe('prompt')
    // 一个点还构不成一段，因此没有 commit。
    if (first.status === 'prompt') expect(first.commit).toBeUndefined()
    expect(session.prompt?.message).toBe('指定下一点')

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
    expect(session.prompt?.message).toBe('指定下一点')
    expect(session.advance({ kind: 'point', point: { x: 5, y: 5 } }).status).toBe('prompt')
  })

  it('命令按名称与别名解析', () => {
    const commands = createStageDraftingCommands(messages)
    expect(commands.map(({ id }) => id)).toEqual([
      'LINE', 'WIRE', 'ARC', 'CIRCLE', 'RECTANGLE', 'PLINE', 'MOVE', 'COPY', 'ERASE',
    ])
    expect(commands[0]?.aliases).toEqual(['L'])
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
