import { describe, expect, it } from 'vitest'
import {
  composeHorizontalMirrorAxis,
  reflectComposeCurve,
  reflectComposePoint,
} from './curve-reflect'
import { composeArcEndpoints } from './curve-geometry'
import type { ComposeArcCurve, ComposeLineCurve, ComposePolylineCurve } from './curve'

/*
 * 判别性来自**斜轴**与**弧**两处：只用水平/竖直轴的用例，在一个把反射写成「取负」的实现上
 * 同样会绿；只反射圆心的弧实现会让弧翻到另一边而鼓的方向不变，那在半圆上看不出来。
 */
describe('OpenSpec: stage-engine / MIRROR 命令 / 点与曲线按轴反射', () => {
  it('反射是自己的逆：镜像两次回到原处', () => {
    const axis = { a: { x: 10, y: 4 }, b: { x: 90, y: 60 } }
    const point = { x: 33, y: 71 }
    const once = reflectComposePoint(point, axis)!
    const twice = reflectComposePoint(once, axis)!
    expect(twice.x).toBeCloseTo(point.x, 9)
    expect(twice.y).toBeCloseTo(point.y, 9)
  })

  it('轴上的点不动', () => {
    const axis = { a: { x: 10, y: 4 }, b: { x: 90, y: 60 } }
    const onAxis = { x: 50, y: 32 }
    const reflected = reflectComposePoint(onAxis, axis)!
    expect(reflected.x).toBeCloseTo(onAxis.x, 9)
    expect(reflected.y).toBeCloseTo(onAxis.y, 9)
  })

  it('退化成一个点的轴没有方向，返回 null', () => {
    const axis = { a: { x: 10, y: 10 }, b: { x: 10, y: 10 } }
    expect(reflectComposePoint({ x: 1, y: 2 }, axis)).toBeNull()
    expect(reflectComposeCurve(
      { kind: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
      axis,
    )).toBeNull()
  })

  it('竖直轴左右翻转，纵坐标不动', () => {
    const line: ComposeLineCurve = { kind: 'line', start: { x: 10, y: 20 }, end: { x: 40, y: 60 } }
    const mirrored = reflectComposeCurve(line, { a: { x: 25, y: 0 }, b: { x: 25, y: 1 } })
    expect(mirrored).toEqual({
      kind: 'line',
      start: { x: 40, y: 20 },
      end: { x: 10, y: 60 },
    })
  })

  it('水平中线轴上下翻转，顶点顺序不变', () => {
    const polyline: ComposePolylineCurve = {
      kind: 'polyline',
      vertices: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 50 }],
      closed: true,
      cornerRadius: 4,
    }
    const mirrored = reflectComposeCurve(polyline, composeHorizontalMirrorAxis(25))
    expect(mirrored).toEqual({
      kind: 'polyline',
      vertices: [{ x: 0, y: 50 }, { x: 20, y: 50 }, { x: 20, y: 0 }],
      closed: true,
      // 圆角是角上的一段定半径圆弧，镜像之后仍然是同一个半径。
      cornerRadius: 4,
    })
  })

  it('弧翻转扫掠的符号，两个端点互换位置', () => {
    // 第一象限的一段 90° 弧。
    const arc: ComposeArcCurve = {
      kind: 'arc',
      center: { x: 50, y: 50 },
      radius: 20,
      startAngle: 0,
      sweep: 90,
    }
    const axis = { a: { x: 50, y: 0 }, b: { x: 50, y: 1 } }
    const mirrored = reflectComposeCurve(arc, axis) as ComposeArcCurve
    expect(mirrored.center).toEqual({ x: 50, y: 50 })
    expect(mirrored.radius).toBe(20)
    // 反射改变定向：顺时针的弧镜像之后是逆时针的。
    expect(mirrored.sweep).toBe(-90)

    // 端点必须落在原端点的镜像上——只反射圆心的实现在这一条上失败。
    const [start, end] = composeArcEndpoints(arc)
    const [mirroredStart, mirroredEnd] = composeArcEndpoints(mirrored)
    expect(mirroredStart.x).toBeCloseTo(reflectComposePoint(start, axis)!.x, 6)
    expect(mirroredStart.y).toBeCloseTo(reflectComposePoint(start, axis)!.y, 6)
    expect(mirroredEnd.x).toBeCloseTo(reflectComposePoint(end, axis)!.x, 6)
    expect(mirroredEnd.y).toBeCloseTo(reflectComposePoint(end, axis)!.y, 6)
  })

  it('斜轴上的弧同样端点对得上', () => {
    const arc: ComposeArcCurve = {
      kind: 'arc',
      center: { x: 30, y: 40 },
      radius: 25,
      startAngle: 200,
      sweep: 140,
    }
    const axis = { a: { x: 0, y: 0 }, b: { x: 60, y: 30 } }
    const mirrored = reflectComposeCurve(arc, axis) as ComposeArcCurve
    const [start, end] = composeArcEndpoints(arc)
    const [mirroredStart, mirroredEnd] = composeArcEndpoints(mirrored)
    expect(mirroredStart.x).toBeCloseTo(reflectComposePoint(start, axis)!.x, 4)
    expect(mirroredStart.y).toBeCloseTo(reflectComposePoint(start, axis)!.y, 4)
    expect(mirroredEnd.x).toBeCloseTo(reflectComposePoint(end, axis)!.x, 4)
    expect(mirroredEnd.y).toBeCloseTo(reflectComposePoint(end, axis)!.y, 4)
  })
})
