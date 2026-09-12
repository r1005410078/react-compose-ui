import { describe, expect, it } from 'vitest'
import {
  COMPOSE_CURVE_MIN_EXTENT,
  composeCurveBounds,
  composeCurveBoxScale,
  composeCurveSegments,
  composePolylineOutline,
  composeCurveViewBox,
  createComposeLineCurve,
  distanceToComposeCurve,
  getComposeCurve,
  isComposeClosedCurve,
  isPointInsideComposeCurve,
  isValidComposeCurve,
  normalizeComposeCurveGeometry,
  projectComposeCurveToBox,
  translateComposeCurve,
  type ComposeCurve,
  type ComposePolylineCurve,
} from './curve'
import { validateComposeDocument } from './document'
import { BUILTIN_COMMAND_TYPES } from './builtin-commands'
import { createTransactionRuntime } from './runtime'
import { getComposeLayoutItem } from './entity'
import type { JsonObject } from './document-types'
import type { DocumentValidationIssueCode } from './document-types'
import { documentFixture, rendererEntity } from './test-fixtures'

let curveCommandId = 0

function issueCodes(document: Parameters<typeof validateComposeDocument>[0]) {
  const result = validateComposeDocument(document)
  return result.valid ? [] : result.issues.map((issue) => issue.code as DocumentValidationIssueCode)
}

/** 只保留指向 Curve Component 的问题——「缺 Renderer」既有规则也会报，按路径区分才判别得了。 */
function curveIssueCodes(document: Parameters<typeof validateComposeDocument>[0]) {
  const result = validateComposeDocument(document)
  if (result.valid) return []
  return result.issues
    .filter((issue) => issue.path[issue.path.length - 1] === 'Curve')
    .map((issue) => issue.code as DocumentValidationIssueCode)
}

/** 按漏斗的归一化不变量构造曲线 Entity——盒落在紧包围盒左上角，几何最小点归零。 */
function curveEntity(
  start = { x: 10, y: 20 },
  end = { x: 110, y: 80 },
  extra: Readonly<Record<string, object>> = {},
) {
  const next = normalizeComposeCurveGeometry(createComposeLineCurve(start, end))
  return rendererEntity('curve-1', {
    transform: {
      position: next.offset,
      size: next.size,
      rotation: 0,
    },
    components: {
      Renderer: { type: 'curve', props: {} },
      Curve: next.curve,
      ...extra,
    },
  })
}

describe('Curve Component 校验', () => {
  it('合法曲线 Entity 通过校验且不改变协议版本', () => {
    const document = documentFixture({ 'curve-1': curveEntity() })
    expect(validateComposeDocument(document).valid).toBe(true)
    expect(document.schemaVersion).toBe(7)
  })

  it('几何点不是有限数时拒绝', () => {
    const document = documentFixture({
      'curve-1': rendererEntity('curve-1', {
        components: {
          Renderer: { type: 'curve', props: {} },
          Curve: { kind: 'line', start: { x: Number.NaN, y: 0 }, end: { x: 1, y: 1 } },
        },
      }),
    })
    expect(issueCodes(document)).toContain('curve.invalid')
  })

  it('未知 kind 拒绝而不是静默忽略', () => {
    expect(isValidComposeCurve({ kind: 'arc', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }))
      .toBe(false)
  })

  it('Curve 缺少 Renderer 时拒绝', () => {
    const entity = curveEntity()
    const components = { ...entity.components }
    delete (components as Record<string, unknown>).Renderer
    const document = documentFixture({ 'curve-1': { ...entity, components } })
    expect(curveIssueCodes(document)).toContain('component.invalid-combination')
  })

  it('Curve 与 Hierarchy 组合时拒绝', () => {
    const document = documentFixture({
      'curve-1': curveEntity({ x: 0, y: 0 }, { x: 1, y: 1 }, { Hierarchy: { childIds: [] } }),
    })
    expect(curveIssueCodes(document)).toContain('component.invalid-combination')
  })

  it('不含 Curve 的既有文档校验结果不变', () => {
    expect(validateComposeDocument(documentFixture()).valid).toBe(true)
  })
})

describe('曲线几何', () => {
  it('紧包围盒覆盖两个端点', () => {
    const bounds = composeCurveBounds(createComposeLineCurve({ x: 30, y: 80 }, { x: 10, y: 20 }))
    expect(bounds).toEqual({ x: 10, y: 20, width: 20, height: 60 })
  })

  it('归一化把盒放到紧包围盒左上角，几何最小点归零', () => {
    const next = normalizeComposeCurveGeometry(
      createComposeLineCurve({ x: 40, y: 100 }, { x: 140, y: 60 }),
    )
    expect(next.offset).toEqual({ x: 40, y: 60 })
    expect(next.size).toEqual({ width: 100, height: 40 })
    expect(next.curve).toEqual({ kind: 'line', start: { x: 0, y: 40 }, end: { x: 100, y: 0 } })
  })

  it('水平线的退化轴钳到最小尺寸，几何保持精确', () => {
    const next = normalizeComposeCurveGeometry(
      createComposeLineCurve({ x: 10, y: 50 }, { x: 90, y: 50 }),
    )
    expect(next.size.height).toBe(COMPOSE_CURVE_MIN_EXTENT)
    if (next.curve.kind !== 'line') throw new Error('kind 应当保持 line')
    expect(next.curve.start.y).toBe(0)
    expect(next.curve.end.y).toBe(0)
  })

  it('量化到两位小数', () => {
    const next = normalizeComposeCurveGeometry(
      createComposeLineCurve({ x: 0, y: 0 }, { x: 82.96874999999991, y: 10 }),
    )
    expect(next.size.width).toBe(82.97)
  })

  it('平移移动全部几何点', () => {
    const moved = translateComposeCurve(createComposeLineCurve({ x: 1, y: 2 }, { x: 3, y: 4 }), 5, 6)
    expect(moved).toEqual({ kind: 'line', start: { x: 6, y: 8 }, end: { x: 8, y: 10 } })
  })
})

describe('点到曲线的距离', () => {
  const curve = createComposeLineCurve({ x: 0, y: 0 }, { x: 100, y: 100 })

  it('线身上的点距离为 0', () => {
    expect(distanceToComposeCurve(curve, { x: 50, y: 50 })).toBe(0)
  })

  it('包围盒内远离线身的空角距离很大', () => {
    // 这一条是「按距离而不是按盒」的可观察差异：空角在盒内，但离对角线很远。
    expect(distanceToComposeCurve(curve, { x: 100, y: 0 })).toBeCloseTo(Math.hypot(50, 50), 6)
  })

  it('线段之外的点取到端点的距离', () => {
    expect(distanceToComposeCurve(curve, { x: -30, y: -40 })).toBeCloseTo(50, 6)
  })

  it('零长度线段退化成点而不是 NaN', () => {
    const degenerate = createComposeLineCurve({ x: 10, y: 10 }, { x: 10, y: 10 })
    expect(distanceToComposeCurve(degenerate, { x: 13, y: 14 })).toBeCloseTo(5, 6)
  })
})

describe('读取入口', () => {
  it('没有 Curve 的 Entity 返回 undefined', () => {
    expect(getComposeCurve(rendererEntity('rect'))).toBeUndefined()
  })
})

describe('entity.curve.set 漏斗', () => {
  function runtimeWithCurve() {
    return createTransactionRuntime({ document: documentFixture({ 'curve-1': curveEntity() }) })
  }

  function dispatchCurve(
    runtime: ReturnType<typeof createTransactionRuntime>,
    payload: JsonObject,
  ) {
    return runtime.dispatch({
      id: `curve-command-${curveCommandId++}`,
      type: BUILTIN_COMMAND_TYPES.setCurve,
      payload,
      meta: { label: 'curve', source: 'test' },
    })
  }

  it('端点写入的同一事务里把盒对齐成紧包围盒', () => {
    const runtime = runtimeWithCurve()
    const result = dispatchCurve(runtime, {
      entityId: 'curve-1',
      curve: { kind: 'line', start: { x: 200, y: 300 }, end: { x: 260, y: 340 } },
    })
    expect(result.status).toBe('committed')
    const entity = runtime.document.entities['curve-1']!
    expect(getComposeCurve(entity)).toEqual({
      kind: 'line',
      start: { x: 0, y: 0 },
      end: { x: 60, y: 40 },
    })
    const item = getComposeLayoutItem(entity)!
    expect(item.offset).toEqual({ x: 200, y: 300 })
    expect(item.width.value).toBe(60)
    expect(item.height.value).toBe(40)
  })

  it('水平线的盒高钳到最小尺寸而不是让文档校验失败', () => {
    const runtime = runtimeWithCurve()
    const result = dispatchCurve(runtime, {
      entityId: 'curve-1',
      curve: { kind: 'line', start: { x: 10, y: 50 }, end: { x: 90, y: 50 } },
    })
    expect(result.status).toBe('committed')
    expect(getComposeLayoutItem(runtime.document.entities['curve-1']!)!.height.value)
      .toBe(COMPOSE_CURVE_MIN_EXTENT)
  })

  it('撤销一步同时还原几何与盒', () => {
    const runtime = runtimeWithCurve()
    const before = runtime.document.entities['curve-1']!
    dispatchCurve(runtime, {
      entityId: 'curve-1',
      curve: { kind: 'line', start: { x: 200, y: 300 }, end: { x: 260, y: 340 } },
    })
    runtime.undo()
    const after = runtime.document.entities['curve-1']!
    expect(getComposeCurve(after)).toEqual(getComposeCurve(before))
    expect(getComposeLayoutItem(after)).toEqual(getComposeLayoutItem(before))
  })

  it('几何没有变化时是 noop', () => {
    const runtime = runtimeWithCurve()
    expect(dispatchCurve(runtime, {
      entityId: 'curve-1',
      curve: { kind: 'line', start: { x: 10, y: 20 }, end: { x: 110, y: 80 } },
    }).status).toBe('noop')
  })

  it('目标不是曲线时拒绝', () => {
    const runtime = createTransactionRuntime({ document: documentFixture() })
    expect(dispatchCurve(runtime, {
      entityId: 'rectangle',
      curve: { kind: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
    }).status).toBe('rejected')
  })

  it('几何非法时拒绝', () => {
    const runtime = runtimeWithCurve()
    expect(dispatchCurve(runtime, {
      entityId: 'curve-1',
      curve: { kind: 'line', start: { x: 0, y: 0 }, end: { x: Number.POSITIVE_INFINITY, y: 1 } },
    }).status).toBe('rejected')
  })

  it('OpenSpec: compose-document / 曲线几何经由单一写入漏斗 / 尺寸锁死时拒绝', () => {
    /*
     * 这条漏斗写 `Curve` 的同时**重算盒**，因此它是 `resize: 'none'` 唯一的漏洞：
     * `entity.transform.set` 那条既有拒绝完全没参与，拖一下夹点就把盒改了。
     */
    const runtime = createTransactionRuntime({
      document: documentFixture({
        'curve-1': curveEntity({ x: 10, y: 20 }, { x: 110, y: 80 }, {
          GeometryConstraints: { movable: true, resize: 'none', rotatable: false },
        }),
      }),
    })
    const result = dispatchCurve(runtime, {
      entityId: 'curve-1',
      curve: { kind: 'line', start: { x: 200, y: 300 }, end: { x: 260, y: 340 } },
    })
    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') return
    // 可判别：与锁定、目标非曲线、几何非法各自分得开。
    expect(result.issues[0]!.code).toBe('curve.constraint')
    expect(getComposeCurve(runtime.document.entities['curve-1']!)).toEqual({
      kind: 'line',
      start: { x: 0, y: 0 },
      end: { x: 100, y: 60 },
    })
  })

  it('不带约束的曲线照旧写得进', () => {
    // 只断前一条时，「把所有曲线都挡住了」同样绿。
    const runtime = runtimeWithCurve()
    expect(dispatchCurve(runtime, {
      entityId: 'curve-1',
      curve: { kind: 'line', start: { x: 200, y: 300 }, end: { x: 260, y: 340 } },
    }).status).toBe('committed')
  })
})

describe('弧与多段线词汇', () => {
  const quarterArc = {
    kind: 'arc' as const,
    center: { x: 0, y: 0 },
    radius: 10,
    startAngle: 0,
    sweep: 90,
  }

  it('OpenSpec: compose-document / 曲线是带盒的普通 Entity / 弧与多段线通过校验', () => {
    expect(isValidComposeCurve(quarterArc)).toBe(true)
    expect(isValidComposeCurve({
      kind: 'polyline',
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
      closed: false,
    })).toBe(true)
  })

  it('OpenSpec: compose-document / 曲线是带盒的普通 Entity / 非法弧与多段线被拒绝', () => {
    // 半径为零、扫掠为零都是点不中也删不掉的幽灵。
    expect(isValidComposeCurve({ ...quarterArc, radius: 0 })).toBe(false)
    expect(isValidComposeCurve({ ...quarterArc, sweep: 0 })).toBe(false)
    expect(isValidComposeCurve({ kind: 'polyline', vertices: [{ x: 0, y: 0 }], closed: false }))
      .toBe(false)
    expect(isValidComposeCurve({
      kind: 'polyline',
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      closed: 'yes',
    })).toBe(false)
  })

  it('OpenSpec: compose-document / 曲线是带盒的普通 Entity / 跨象限的弧不被盒裁掉', () => {
    // −45°→45° 的弧，两个端点的 x 都是 10cos45≈7.07，而弧鼓到 0° 象限点 x=10。
    const wide = { ...quarterArc, startAngle: -45, sweep: 90 }
    const bounds = composeCurveBounds(wide)

    // 只用端点算会短 2.93 —— 弧被自己的盒裁掉一块。
    expect(bounds.x + bounds.width).toBeCloseTo(10, 6)
  })

  it('OpenSpec: compose-document / 曲线是带盒的普通 Entity / 整圆是扫掠 360 的弧', () => {
    const bounds = composeCurveBounds({ ...quarterArc, sweep: 360 })

    expect(bounds.x).toBeCloseTo(-10, 6)
    expect(bounds.y).toBeCloseTo(-10, 6)
    expect(bounds.width).toBeCloseTo(20, 6)
    expect(bounds.height).toBeCloseTo(20, 6)
  })

  it('OpenSpec: compose-document / 曲线几何经由单一写入漏斗 / 弧归一化到盒原点', () => {
    const normalized = normalizeComposeCurveGeometry(quarterArc)

    // 紧盒左上角恒为盒原点：圆心随之平移，半径与角度不变。
    expect(normalized.offset).toEqual({ x: 0, y: 0 })
    expect(normalized.size).toEqual({ width: 10, height: 10 })
    if (normalized.curve.kind !== 'arc') throw new Error('kind 应当保持 arc')
    expect(normalized.curve.center).toEqual({ x: 0, y: 0 })
    expect(normalized.curve.radius).toBe(10)
  })

  it('OpenSpec: compose-document / 曲线几何经由单一写入漏斗 / 多段线归一化到盒原点', () => {
    const normalized = normalizeComposeCurveGeometry({
      kind: 'polyline',
      vertices: [{ x: 5, y: 7 }, { x: 25, y: 7 }, { x: 25, y: 27 }],
      closed: true,
    })

    expect(normalized.offset).toEqual({ x: 5, y: 7 })
    if (normalized.curve.kind !== 'polyline') throw new Error('kind 应当保持 polyline')
    expect(normalized.curve.vertices).toEqual([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }])
    expect(normalized.curve.closed).toBe(true)
  })

  it('OpenSpec: compose-document / 曲线是带盒的普通 Entity / 命中按到几何的距离', () => {
    // 弧的包围盒里，靠近圆心的位置离弧身有整整一个半径。
    expect(distanceToComposeCurve(quarterArc, { x: 0, y: 0 })).toBeCloseTo(10, 6)
    expect(distanceToComposeCurve(quarterArc, { x: 10, y: 0 })).toBeCloseTo(0, 6)
    // 扫掠之外的方位取最近**端点**而不是径向距离：(-10,0) 的方位角是 180°，不在 [0,90]，
    // 因此答案是到 (0,10) 的 14.14，而不是「到圆心距离 − 半径」给出的 20。
    expect(distanceToComposeCurve(quarterArc, { x: -10, y: 0 }))
      .toBeCloseTo(Math.hypot(10, 10), 6)

    const polyline = {
      kind: 'polyline' as const,
      vertices: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }],
      closed: false,
    }
    expect(distanceToComposeCurve(polyline, { x: 10, y: 5 })).toBeCloseTo(5, 6)
    // (11,11) 正落在闭合边（(20,20)→(0,0) 的对角线）上，而离两条既有边分别有 11 与 9：
    // 开放时点不中，闭合之后那条边把它接住。这条断言正是 `closed` 必须是布尔的理由——
    // 它改变的是候选几何，不只是渲染。
    expect(distanceToComposeCurve(polyline, { x: 11, y: 11 })).toBeCloseTo(9, 6)
    expect(distanceToComposeCurve({ ...polyline, closed: true }, { x: 11, y: 11 }))
      .toBeCloseTo(0, 6)
  })

  it('既有直线的归一化与距离逐值不变', () => {
    const line = createComposeLineCurve({ x: 5, y: 5 }, { x: 105, y: 5 })
    const normalized = normalizeComposeCurveGeometry(line)

    expect(normalized.offset).toEqual({ x: 5, y: 5 })
    expect(normalized.size).toEqual({ width: 100, height: COMPOSE_CURVE_MIN_EXTENT })
    expect(distanceToComposeCurve(line, { x: 55, y: 15 })).toBeCloseTo(10, 6)
  })
})

describe('OpenSpec: compose-document / 盒与几何之间只有一个换算入口', () => {
  const diagonal: ComposeCurve = {
    kind: 'line',
    start: { x: 0, y: 0 },
    end: { x: 100, y: 50 },
  }

  it('非等比盒给出两个不同的轴比例', () => {
    const scale = composeCurveBoxScale(diagonal, { width: 200, height: 50 })

    expect(scale).toEqual({ x: 2, y: 1 })
  })

  it('退化轴不除零，钳值与 LayoutItem 尺寸同一个常量', () => {
    const horizontal: ComposeCurve = {
      kind: 'line',
      start: { x: 0, y: 0 },
      end: { x: 80, y: 0 },
    }

    const view = composeCurveViewBox(horizontal)

    expect(view.height).toBe(COMPOSE_CURVE_MIN_EXTENT)
    expect(Number.isFinite(composeCurveBoxScale(horizontal, { width: 80, height: 40 }).y)).toBe(true)
  })

  it('比例为 1 时原样返回，不产生新对象', () => {
    expect(projectComposeCurveToBox(diagonal, { width: 100, height: 50 })).toBe(diagonal)
  })

  it('直线与多段线按轴缩放', () => {
    expect(projectComposeCurveToBox(diagonal, { width: 200, height: 50 })).toEqual({
      kind: 'line',
      start: { x: 0, y: 0 },
      end: { x: 200, y: 50 },
    })

    const polyline: ComposeCurve = {
      kind: 'polyline',
      vertices: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }],
      closed: true,
    }
    expect(projectComposeCurveToBox(polyline, { width: 80, height: 20 })).toMatchObject({
      vertices: [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 20 }],
      closed: true,
    })
  })

  it('等比缩放的弧仍是弧', () => {
    const arc: ComposeCurve = {
      kind: 'arc',
      center: { x: 10, y: 10 },
      radius: 10,
      startAngle: 0,
      sweep: 360,
    }

    const projected = projectComposeCurveToBox(arc, { width: 40, height: 40 })

    // 圆心与象限点是圆弧最有用的两个特征点；拍扁会让它们消失，因此等比时不能拍。
    expect(projected).toMatchObject({ kind: 'arc', radius: 20, center: { x: 20, y: 20 } })
  })

  it('写进文档的弧仍判成等比：盒尺寸被量化，两轴比例天生对不齐', () => {
    // 用户画完一条弧之后文档里就是这个样子：几何不量化，而盒尺寸被舍到两位小数。
    const drawn: ComposeCurve = {
      kind: 'arc',
      center: { x: 312.4, y: 205.7 },
      radius: 143.6,
      startAngle: 200,
      sweep: 140,
    }
    const normalized = normalizeComposeCurveGeometry(drawn)

    const projected = projectComposeCurveToBox(normalized.curve, normalized.size)

    // 两轴比例差 4e-5，全部来自那次舍入——把它判成非等比会让**每一条**画出来的弧在命中、
    // 捕捉与几何编辑里退化成二十来个顶点的多段线，而渲染仍按 `viewBox` 画着真正的弧。
    expect(projected.kind).toBe('arc')
  })

  it('容差不吞掉真实的拉伸：同一条弧横向拉宽 1% 就拍扁', () => {
    const drawn: ComposeCurve = {
      kind: 'arc',
      center: { x: 312.4, y: 205.7 },
      radius: 143.6,
      startAngle: 200,
      sweep: 140,
    }
    const normalized = normalizeComposeCurveGeometry(drawn)

    const projected = projectComposeCurveToBox(normalized.curve, {
      width: normalized.size.width * 1.01,
      height: normalized.size.height,
    })

    expect(projected.kind).toBe('polyline')
  })

  it('非等比缩放的弧拍扁成多段线，整圆仍闭合', () => {
    const circle: ComposeCurve = {
      kind: 'arc',
      center: { x: 10, y: 10 },
      radius: 10,
      startAngle: 0,
      sweep: 360,
    }

    const projected = projectComposeCurveToBox(circle, { width: 40, height: 20 })

    expect(projected.kind).toBe('polyline')
    if (projected.kind !== 'polyline') throw new Error('unreachable')
    expect(projected.closed).toBe(true)
    // 按 x 拉伸两倍：最右点到 40，最下点仍是 20。硬按某一轴算成圆会得到一个正圆。
    const xs = projected.vertices.map((vertex) => vertex.x)
    const ys = projected.vertices.map((vertex) => vertex.y)
    expect(Math.max(...xs)).toBeCloseTo(40, 0)
    expect(Math.max(...ys)).toBeCloseTo(20, 0)
  })

  it('开放弧拍扁后不闭合', () => {
    const arc: ComposeCurve = {
      kind: 'arc',
      center: { x: 10, y: 10 },
      radius: 10,
      startAngle: 0,
      sweep: 90,
    }

    const projected = projectComposeCurveToBox(arc, { width: 40, height: 20 })

    // 闭合它会凭空多出一条弦。
    expect(projected).toMatchObject({ kind: 'polyline', closed: false })
  })

  it('映射后的几何与盒同尺寸，因此命中与渲染落在同一处', () => {
    const projected = projectComposeCurveToBox(diagonal, { width: 200, height: 150 })
    const bounds = composeCurveBounds(projected)

    expect(bounds).toMatchObject({ x: 0, y: 0, width: 200, height: 150 })
  })
})

describe('isPointInsideComposeCurve', () => {
  const square: ComposeCurve = {
    kind: 'polyline',
    vertices: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }],
    closed: true,
  }

  it('闭合多段线内外分明', () => {
    expect(isPointInsideComposeCurve(square, { x: 10, y: 10 })).toBe(true)
    expect(isPointInsideComposeCurve(square, { x: 30, y: 10 })).toBe(false)
  })

  it('整圆的圆心在内部', () => {
    const circle: ComposeCurve = {
      kind: 'arc',
      center: { x: 10, y: 10 },
      radius: 10,
      startAngle: 0,
      sweep: 360,
    }

    expect(isPointInsideComposeCurve(circle, { x: 10, y: 10 })).toBe(true)
    // 盒角落在圆外：正是「包围盒里绝大部分是空的」那一片。
    expect(isPointInsideComposeCurve(circle, { x: 0.5, y: 0.5 })).toBe(false)
  })

  it('开放几何按隐式闭合，与 SVG 填充它时画出的区域一致', () => {
    const open: ComposeCurve = {
      kind: 'polyline',
      vertices: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }],
      closed: false,
    }

    // 首尾连线围出的是右上三角形。
    expect(isPointInsideComposeCurve(open, { x: 15, y: 8 })).toBe(true)
    expect(isPointInsideComposeCurve(open, { x: 5, y: 15 })).toBe(false)
  })

  it('直线没有可填充的面积', () => {
    const line: ComposeCurve = { kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 100 } }

    expect(isPointInsideComposeCurve(line, { x: 50, y: 50 })).toBe(false)
  })
})

describe('OpenSpec: compose-document / 多段线的四角联动圆角', () => {
  /** 200 × 100 的闭合矩形，左上角在原点。 */
  const rectangle = (cornerRadius?: number): ComposeCurve => ({
    kind: 'polyline',
    vertices: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }],
    closed: true,
    ...(cornerRadius === undefined ? {} : { cornerRadius }),
  })

  it('缺席时与今天逐段相同', () => {
    // 缺席即尖角这条回退让既有文档逐像素不变，因此本字段不需要迁移。
    expect(composeCurveSegments(rectangle())).toEqual([
      { start: { x: 0, y: 0 }, end: { x: 200, y: 0 } },
      { start: { x: 200, y: 0 }, end: { x: 200, y: 100 } },
      { start: { x: 200, y: 100 }, end: { x: 0, y: 100 } },
      { start: { x: 0, y: 100 }, end: { x: 0, y: 0 } },
    ])
  })

  it('四个角各出一段弧，直段按切点缩短', () => {
    const pieces = composePolylineOutline(rectangle(20) as ComposePolylineCurve)
    expect(pieces.filter(({ kind }) => kind === 'arc')).toHaveLength(4)
    // 上边从 (20,0) 走到 (180,0)：两端各让出一个切线长。三角函数的往返留下末位残渣，
    // 而轮廓不进文档——量化只作用在写回文档的那个漏斗上。
    const top = pieces.find(({ kind }) => kind === 'segment')
    if (top?.kind !== 'segment') throw new Error('上边应当是一条直段')
    expect(top.segment.start.x).toBeCloseTo(20)
    expect(top.segment.start.y).toBe(0)
    expect(top.segment.end.x).toBeCloseTo(180)
  })

  it('半径超过相邻边的一半时按边长钳制，且不回写文档', () => {
    const curve = rectangle(999) as ComposePolylineCurve
    const arcs = composePolylineOutline(curve)
      .flatMap((piece) => (piece.kind === 'arc' ? [piece.arc] : []))
    // 短边 100，切线长钳到 50，直角下 `tan(45°) = 1` 因此半径就是 50。
    expect(arcs).toHaveLength(4)
    arcs.forEach(({ radius }) => expect(radius).toBeCloseTo(50))
    // 钳的是**呈现**：作者写进去的意图原样留在文档里，盒拉回去圆角就回来。
    expect(curve.cornerRadius).toBe(999)
  })

  it('圆角削掉的那一块不再算作内部', () => {
    // 判别点取左上角内侧：尖角时它在内部，半径 40 之后它落在弧外。
    const probe = { x: 4, y: 4 }
    expect(isPointInsideComposeCurve(rectangle(), probe)).toBe(true)
    expect(isPointInsideComposeCurve(rectangle(40), probe)).toBe(false)
  })

  it('共线的角不圆，开放折线的两端也不圆', () => {
    const straight: ComposeCurve = {
      kind: 'polyline',
      vertices: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }],
      closed: false,
      cornerRadius: 10,
    }
    // 三个顶点里只有 (100,0) 是真的角：(0,0) 与 (100,60) 是端点，(50,0) 共线。
    expect(composePolylineOutline(straight as ComposePolylineCurve)
      .filter(({ kind }) => kind === 'arc')).toHaveLength(1)
  })

  it('cornerRadius 在场时必须是有限正数', () => {
    // 0 与缺席是同一件事：留两种表示会让「有没有圆角」在两处读出不同答案。
    expect(isValidComposeCurve(rectangle(0))).toBe(false)
    expect(isValidComposeCurve(rectangle(-1))).toBe(false)
    expect(isValidComposeCurve(rectangle(12))).toBe(true)
    expect(isValidComposeCurve(rectangle())).toBe(true)
  })
})

/*
 * 判据是「盒是不是这个对象的轮廓」，而闭合与否是它在文档里读得出来的代理。用例因此都从
 * **不是矩形**的形状取：拿矩形当证据会让「只认矩形」那个旧实现照样绿。
 */
describe('OpenSpec: compose-document / 曲线闭不闭合有一个谓词', () => {
  const hexagon = (closed: boolean): ComposeCurve => ({
    kind: 'polyline',
    vertices: [
      { x: 100, y: 0 }, { x: 150, y: 87 }, { x: 100, y: 174 },
      { x: 0, y: 174 }, { x: -50, y: 87 }, { x: 0, y: 0 },
    ],
    closed,
  })

  it('闭合多段线为真，顶点数与是否轴对齐都不影响', () => {
    expect(isComposeClosedCurve(hexagon(true))).toBe(true)
  })

  it('未闭合的折线为假', () => {
    expect(isComposeClosedCurve(hexagon(false))).toBe(false)
  })

  it('整圆为真，一段弧为假', () => {
    const arc = (sweep: number): ComposeCurve => ({
      kind: 'arc',
      center: { x: 0, y: 0 },
      radius: 50,
      startAngle: 0,
      sweep,
    })
    expect(isComposeClosedCurve(arc(360))).toBe(true)
    expect(isComposeClosedCurve(arc(-360))).toBe(true)
    expect(isComposeClosedCurve(arc(90))).toBe(false)
  })

  it('直线为假', () => {
    // 两个端点表达不了一块面积。
    expect(isComposeClosedCurve(createComposeLineCurve({ x: 0, y: 0 }, { x: 90, y: 60 }))).toBe(false)
  })
})
