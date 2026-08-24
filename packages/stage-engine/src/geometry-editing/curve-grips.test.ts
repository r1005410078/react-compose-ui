import { describe, expect, it } from 'vitest'
import { COMPOSE_BUILTIN_COMPONENT_KEYS } from '@compose-ui/core'
import { createStageSceneIndex } from '../hit-testing'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { applyStageCurveGrip, stageCurveGrips } from './curve-grips'
import type { ComposeArcCurve, ComposeCurve, ComposeEntity } from '@compose-ui/core'

/** 几何是 100×50 的斜线，盒可以另给——夹点必须跟着**画出来的**那条线走。 */
function curveEntity(width: number, height: number): ComposeEntity {
  const base = entity('curve-a', { width, height })
  return {
    ...base,
    components: {
      ...base.components,
      [COMPOSE_BUILTIN_COMPONENT_KEYS.renderer]: { type: 'curve', props: {} },
      [COMPOSE_BUILTIN_COMPONENT_KEYS.curve]: {
        kind: 'line',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 50 },
      },
    },
  }
}

describe('stageCurveGrips', () => {
  it('夹点跟着盒的非等比缩放走', () => {
    const value = document([curveEntity(200, 50)])
    const index = createStageSceneIndex(value, layoutSnapshot(value))

    const grips = stageCurveGrips(value, index, 'curve-a')

    // 盒宽翻倍而高不变：终点的 x 跟着翻倍，y 不动——与命中、捕捉读的是同一个投影。
    expect(grips.map(({ id }) => id)).toEqual(['start', 'end'])
    expect(grips[1]!.point).toMatchObject({ x: 200, y: 50 })
  })

  it('不是曲线时没有夹点', () => {
    const value = document([entity('a')])
    const index = createStageSceneIndex(value, layoutSnapshot(value))

    expect(stageCurveGrips(value, index, 'a')).toEqual([])
  })
})

const arc: ComposeArcCurve = {
  kind: 'arc',
  center: { x: 0, y: 0 },
  radius: 100,
  startAngle: 0,
  sweep: 90,
}

describe('applyStageCurveGrip', () => {
  it('直线的两个端点各自可拖', () => {
    const line: ComposeCurve = { kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }
    expect(applyStageCurveGrip(line, 'end', { x: 100, y: 60 }))
      .toEqual({ kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 60 } })
    expect(applyStageCurveGrip(line, 'nope', { x: 0, y: 0 })).toBeNull()
  })

  it('多段线只替换被拖的那个顶点', () => {
    const polyline: ComposeCurve = {
      kind: 'polyline',
      vertices: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }],
      closed: false,
    }
    const next = applyStageCurveGrip(polyline, 'v1', { x: 70, y: 10 })
    expect(next).toEqual({ ...polyline, vertices: [{ x: 0, y: 0 }, { x: 70, y: 10 }, { x: 50, y: 50 }] })
    expect(applyStageCurveGrip(polyline, 'v3', { x: 0, y: 0 })).toBeNull()
  })

  it('拖弧的终点时圆心、半径与起始角都不动', () => {
    const next = applyStageCurveGrip(arc, 'end', { x: 0, y: -100 }) as ComposeArcCurve
    expect(next.center).toEqual(arc.center)
    expect(next.radius).toBe(arc.radius)
    expect(next.startAngle).toBe(arc.startAngle)
    // −90° 归一化到同号（正）的区间即 270。
    expect(next.sweep).toBe(270)
  })

  it('拖弧的起点时终点一动不动', () => {
    // 起点拖到 −90°，终止角仍是 90°，因此扫掠角变成 180。
    const next = applyStageCurveGrip(arc, 'start', { x: 0, y: -100 }) as ComposeArcCurve
    expect(next.startAngle).toBeCloseTo(-90)
    expect(next.sweep).toBeCloseTo(180)
  })

  it('终点拖回起点得到整圆而不是空弧', () => {
    const next = applyStageCurveGrip(arc, 'end', { x: 100, y: 0 }) as ComposeArcCurve
    expect(next.sweep).toBe(360)
    const reversed = applyStageCurveGrip({ ...arc, sweep: -90 }, 'end', { x: 100, y: 0 }) as ComposeArcCurve
    // 符号保持不变：拖动不该把一段逆时针的弧翻成顺时针。
    expect(reversed.sweep).toBe(-360)
  })

  it('中点只改半径，圆心与角度不动', () => {
    const next = applyStageCurveGrip(arc, 'mid', { x: 30, y: 30 }) as ComposeArcCurve
    expect(next.radius).toBeCloseTo(Math.hypot(30, 30))
    expect(next.startAngle).toBe(arc.startAngle)
    expect(next.sweep).toBe(arc.sweep)
    // 半径归零之后再没有夹点能把它拉回来，因此拒绝这次写入。
    expect(applyStageCurveGrip(arc, 'mid', { x: 0, y: 0 })).toBeNull()
  })

  it('圆心平移整条弧', () => {
    const next = applyStageCurveGrip(arc, 'center', { x: 20, y: 20 }) as ComposeArcCurve
    expect(next).toEqual({ ...arc, center: { x: 20, y: 20 } })
  })
})
