import { describe, expect, it } from 'vitest'
import {
  createComposeLineCurve,
  normalizeComposeCurveGeometry,
  type ComposeEntity,
} from '@compose-ui/core'
import { isComposeEntityGeometryEditable } from './geometry-editable'

/** 一条普通直线；`extra` 用来补 `GeometryConstraints` 这类可选 Component。 */
function curveEntity(extra: Readonly<Record<string, object>> = {}): ComposeEntity {
  const next = normalizeComposeCurveGeometry(
    createComposeLineCurve({ x: 0, y: 0 }, { x: 100, y: 60 }),
  )
  return {
    id: 'curve-1',
    name: 'Curve',
    components: {
      Composition: { presetId: 'curve', baseComponentKeys: [], capabilityIds: [] },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: next.offset,
        width: { mode: 'fixed', value: next.size.width, min: 1, max: null },
        height: { mode: 'fixed', value: next.size.height, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Renderer: { type: 'curve', props: {} },
      Curve: next.curve,
      ...extra,
    },
  } as unknown as ComposeEntity
}

describe('OpenSpec: stage / 尺寸被锁死的曲线不进几何编辑会话', () => {
  it('resize 为 none 的曲线不可几何编辑', () => {
    // 顶点模式改的就是形状，而这条曲线的形状不是作者的意图。
    expect(isComposeEntityGeometryEditable(curveEntity({
      GeometryConstraints: { movable: true, resize: 'none', rotatable: false },
    }))).toBe(false)
  })

  it('不带约束的曲线照旧可以', () => {
    // 只断上一条时，「把所有曲线都挡在门外」同样绿。
    expect(isComposeEntityGeometryEditable(curveEntity())).toBe(true)
  })

  it('resize 的其他档位不受影响', () => {
    // 本变更只关掉 `none` 这一档：等比与单轴仍然改得了形状。
    expect(isComposeEntityGeometryEditable(curveEntity({
      GeometryConstraints: { movable: true, resize: 'preserve-aspect', rotatable: true },
    }))).toBe(true)
  })

  it('锁定与没有 Curve 照旧挡在门外', () => {
    expect(isComposeEntityGeometryEditable(curveEntity({ Lock: { locked: true } }))).toBe(false)
    const plain = curveEntity()
    const components = { ...plain.components } as Record<string, unknown>
    delete components.Curve
    expect(isComposeEntityGeometryEditable(
      { ...plain, components } as unknown as ComposeEntity,
    )).toBe(false)
    expect(isComposeEntityGeometryEditable(undefined)).toBe(false)
  })
})
