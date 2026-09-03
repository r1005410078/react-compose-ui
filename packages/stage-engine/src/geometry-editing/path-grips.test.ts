import { describe, expect, it } from 'vitest'
import { COMPOSE_BUILTIN_COMPONENT_KEYS } from '@compose-ui/core'
import { createStageSceneIndex } from '../hit-testing'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { applyStageCurveGrip, stageCurveGrips } from './curve-grips'
import type { ComposeEntity, ComposePathCurve } from '@compose-ui/core'

/**
 * 一条两段的开放路径：三个顶点 `(0,0) → (50,50) → (100,0)`，中间那个点两侧各有一个手柄。
 * 盒与紧包围盒等大，因此投影是恒等的，断言读到的就是几何本身。
 */
const twoSegments: ComposePathCurve = {
  kind: 'path',
  subpaths: [{
    start: { x: 0, y: 0 },
    segments: [
      { c1: { x: 10, y: 40 }, c2: { x: 40, y: 50 }, to: { x: 50, y: 50 } },
      { c1: { x: 60, y: 50 }, c2: { x: 90, y: 40 }, to: { x: 100, y: 0 } },
    ],
    closed: false,
  }],
}

function pathDocument(
  curve: ComposePathCurve = twoSegments,
  box: { readonly width: number; readonly height: number } = { width: 100, height: 50 },
) {
  const base = entity('curve-a', box)
  const target: ComposeEntity = {
    ...base,
    components: {
      ...base.components,
      [COMPOSE_BUILTIN_COMPONENT_KEYS.renderer]: { type: 'curve', props: {} },
      [COMPOSE_BUILTIN_COMPONENT_KEYS.curve]: curve as never,
    },
  }
  const value = document([target])
  return createStageSceneIndex(value, layoutSnapshot(value))
}

describe('OpenSpec: stage-engine / path 曲线的顶点与控制手柄 / 派生', () => {
  it('一个顶点一个方块，控制点挂在它身上', () => {
    const grips = stageCurveGrips(pathDocument(), 'curve-a')
    expect(grips.map(({ id }) => id)).toEqual(['p0v0', 'p0v1', 'p0v2'])
    expect(grips.every(({ role }) => role === 'vertex')).toBe(true)
  })

  it('中间顶点两侧各有一个控制点', () => {
    const middle = stageCurveGrips(pathDocument(), 'curve-a')[1]!
    // 入向住在前一段的 `c2` 上，出向住在这一段的 `c1` 上。
    expect(middle.inTangent).toEqual({ x: 40, y: 50 })
    expect(middle.outTangent).toEqual({ x: 60, y: 50 })
  })

  it('开放路径的首尾各只有一侧控制点', () => {
    const grips = stageCurveGrips(pathDocument(), 'curve-a')
    expect(grips[0]!.inTangent).toBeNull()
    expect(grips[0]!.outTangent).toEqual({ x: 10, y: 40 })
    expect(grips[2]!.outTangent).toBeNull()
    expect(grips[2]!.inTangent).toEqual({ x: 90, y: 40 })
  })

  it('控制点与顶点走同一个矩阵——否则杆在变形的盒里指错方向', () => {
    // 盒宽翻倍：顶点与控制点的 x 一起翻倍，y 都不动。
    const wide = pathDocument(twoSegments, { width: 200, height: 50 })
    const middle = stageCurveGrips(wide, 'curve-a')[1]!
    expect(middle.point).toMatchObject({ x: 100, y: 50 })
    expect(middle.inTangent).toMatchObject({ x: 80, y: 50 })
    expect(middle.outTangent).toMatchObject({ x: 120, y: 50 })
  })
})

describe('OpenSpec: stage-engine / path 曲线的顶点与控制手柄 / 求解', () => {
  it('拖顶点时两侧手柄跟着同一个位移走', () => {
    const next = applyStageCurveGrip(twoSegments, 'p0v1', { x: 60, y: 60 }) as ComposePathCurve
    const [first, second] = next.subpaths[0]!.segments
    expect(first!.to).toEqual({ x: 60, y: 60 })
    // 位移是 (+10, +10)：入向与出向手柄各自加同一个量，切向因此原样保留。
    expect(first!.c2).toEqual({ x: 50, y: 60 })
    expect(second!.c1).toEqual({ x: 70, y: 60 })
    // 不相邻的控制点一个字节都没动。
    expect(first!.c1).toEqual({ x: 10, y: 40 })
  })

  it('拖控制点默认让对侧共线且等长', () => {
    const next = applyStageCurveGrip(twoSegments, 'p0v1o', { x: 70, y: 30 }) as ComposePathCurve
    const [first, second] = next.subpaths[0]!.segments
    expect(second!.c1).toEqual({ x: 70, y: 30 })
    // 顶点是 (50,50)，对侧关于它作镜像：(2×50 − 70, 2×50 − 30)。
    expect(first!.c2).toEqual({ x: 30, y: 70 })
  })

  it('breakSymmetry 时只动被拖的那一个', () => {
    const next = applyStageCurveGrip(
      twoSegments,
      'p0v1o',
      { x: 70, y: 30 },
      { breakSymmetry: true },
    ) as ComposePathCurve
    const [first, second] = next.subpaths[0]!.segments
    expect(second!.c1).toEqual({ x: 70, y: 30 })
    expect(first!.c2).toEqual({ x: 40, y: 50 })
  })

  it('没有对侧时（开放路径的首顶点）镜像不写出任何东西', () => {
    const next = applyStageCurveGrip(twoSegments, 'p0v0o', { x: 5, y: 20 }) as ComposePathCurve
    const [first, second] = next.subpaths[0]!.segments
    expect(first!.c1).toEqual({ x: 5, y: 20 })
    expect(second!.c1).toEqual({ x: 60, y: 50 })
  })

  it('拖首顶点时改的是子路径起点', () => {
    const next = applyStageCurveGrip(twoSegments, 'p0v0', { x: -10, y: 10 }) as ComposePathCurve
    expect(next.subpaths[0]!.start).toEqual({ x: -10, y: 10 })
    // 出向手柄跟着同一个位移：(-10, +10)。
    expect(next.subpaths[0]!.segments[0]!.c1).toEqual({ x: 0, y: 50 })
  })

  it('文档里不写平滑或尖角——共线与否从控制点本身读得出来', () => {
    const next = applyStageCurveGrip(twoSegments, 'p0v1o', { x: 70, y: 30 }) as ComposePathCurve
    const subpath = next.subpaths[0]! as unknown as Record<string, unknown>
    expect(Object.keys(subpath).sort()).toEqual(['closed', 'segments', 'start'])
    const segment = next.subpaths[0]!.segments[0]! as unknown as Record<string, unknown>
    expect(Object.keys(segment).sort()).toEqual(['c1', 'c2', 'to'])
  })

  it('不属于这条曲线的夹点 id 返回 null', () => {
    expect(applyStageCurveGrip(twoSegments, 'p9v0', { x: 0, y: 0 })).toBeNull()
    expect(applyStageCurveGrip(twoSegments, 'p0v0i', { x: 0, y: 0 })).toBeNull()
    expect(applyStageCurveGrip(twoSegments, 'start', { x: 0, y: 0 })).toBeNull()
  })
})
