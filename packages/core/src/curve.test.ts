import { describe, expect, it } from 'vitest'
import {
  COMPOSE_CURVE_MIN_EXTENT,
  composeCurveBounds,
  createComposeLineCurve,
  distanceToComposeCurve,
  getComposeCurve,
  isValidComposeCurve,
  normalizeComposeCurveGeometry,
  translateComposeCurve,
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
})
