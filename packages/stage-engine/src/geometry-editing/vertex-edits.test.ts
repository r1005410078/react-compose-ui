import { describe, expect, it } from 'vitest'
import { composeCubicPointAt, nearestComposeCubicT } from '@compose-ui/core'
import { deleteStageCurveVertex, insertStageCurveVertex } from './vertex-edits'
import type {
  ComposeArcCurve,
  ComposeLineCurve,
  ComposePathCurve,
  ComposePolylineCurve,
} from '@compose-ui/core'

const rectangle: ComposePolylineCurve = {
  kind: 'polyline',
  vertices: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 60 },
    { x: 0, y: 60 },
  ],
  closed: true,
}

const diagonal: ComposeLineCurve = {
  kind: 'line',
  start: { x: 0, y: 0 },
  end: { x: 100, y: 60 },
}

/** 一条两段的开放路径；中间那个顶点两侧各有一个控制点。 */
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

/*
 * 判别性来自**插在哪一段上**：只断言「顶点数加一」的用例，在一个永远往末尾追加的实现上同样
 * 会绿。因此每条都断新顶点落在它应该落的那个下标上。
 */
describe('OpenSpec: stage-engine / 几何编辑会话内插入与删除顶点 / 插入', () => {
  it('矩形的上边加点：五顶点，新点排在那条边的两个端点之间', () => {
    const result = insertStageCurveVertex(rectangle, { x: 40, y: 0 })
    expect(result.status).toBe('ok')
    const curve = result.status === 'ok' ? result.curve as ComposePolylineCurve : null
    expect(curve?.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 60 },
      { x: 0, y: 60 },
    ])
    expect(curve?.closed).toBe(true)
  })

  it('闭合多段线的收尾段加点：新点排在末尾，不排到开头', () => {
    // 左边那条边是收尾段（顶点 3 连回顶点 0），取模插在下标 0 会把它放到整条折线的开头。
    const result = insertStageCurveVertex(rectangle, { x: 0, y: 30 })
    const curve = result.status === 'ok' ? result.curve as ComposePolylineCurve : null
    expect(curve?.vertices[4]).toEqual({ x: 0, y: 30 })
    expect(curve?.vertices).toHaveLength(5)
  })

  it('直线上加点变三顶点折线，一次写入换掉 kind', () => {
    const result = insertStageCurveVertex(diagonal, { x: 50, y: 30 })
    const curve = result.status === 'ok' ? result.curve : null
    expect(curve?.kind).toBe('polyline')
    expect((curve as ComposePolylineCurve).vertices).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 30 },
      { x: 100, y: 60 },
    ])
    expect((curve as ComposePolylineCurve).closed).toBe(false)
  })

  it('贝塞尔段上加点：顶点数加一，形状逐点不变', () => {
    const clicked = { x: 25, y: 36 }
    const original = {
      start: { x: 0, y: 0 },
      c1: { x: 10, y: 40 },
      c2: { x: 40, y: 50 },
      end: { x: 50, y: 50 },
    }
    const result = insertStageCurveVertex(twoSegments, clicked)
    const curve = result.status === 'ok' ? result.curve as ComposePathCurve : null
    const segments = curve?.subpaths[0]?.segments
    expect(segments).toHaveLength(3)

    /*
     * 比的是**曲线上的点**而不是控制点：de Casteljau 分割改的正是控制点，而「逐像素不变」
     * 说的是曲线本身。两条新段各自铺满原段的一半参数域，因此可以逐点精确比对——拿两条拍平
     * 出来的折线互相比是量不了这件事的，分割之后细分边界挪了位置，残差就是拍平容差本身。
     */
    const t = nearestComposeCubicT(original, clicked)
    const first = { start: original.start, c1: segments![0]!.c1, c2: segments![0]!.c2, end: segments![0]!.to }
    const second = { start: segments![0]!.to, c1: segments![1]!.c1, c2: segments![1]!.c2, end: segments![1]!.to }
    for (let step = 0; step <= 20; step += 1) {
      const u = step / 20
      const head = composeCubicPointAt(original, u * t)
      expect(composeCubicPointAt(first, u).x).toBeCloseTo(head.x, 9)
      expect(composeCubicPointAt(first, u).y).toBeCloseTo(head.y, 9)
      const tail = composeCubicPointAt(original, t + u * (1 - t))
      expect(composeCubicPointAt(second, u).x).toBeCloseTo(tail.x, 9)
      expect(composeCubicPointAt(second, u).y).toBeCloseTo(tail.y, 9)
    }
    // 第二段的终点仍是原来那一段的终点：插点不动既有顶点。
    expect(segments![1]!.to).toEqual({ x: 50, y: 50 })
  })

  it('分割点落在双击的地方，而不是段的中点', () => {
    // 第一段靠近起点的 1/4 处，明显不是 t = 0.5。
    const quarter = composeCubicPointAt(
      { start: { x: 0, y: 0 }, c1: { x: 10, y: 40 }, c2: { x: 40, y: 50 }, end: { x: 50, y: 50 } },
      0.25,
    )
    const result = insertStageCurveVertex(twoSegments, quarter)
    const curve = result.status === 'ok' ? result.curve as ComposePathCurve : null
    const seam = curve?.subpaths[0]?.segments[0]?.to
    expect(seam?.x).toBeCloseTo(quarter.x, 2)
    expect(seam?.y).toBeCloseTo(quarter.y, 2)
  })

  it('弧不受理，并说出原因', () => {
    const arc: ComposeArcCurve = {
      kind: 'arc',
      center: { x: 50, y: 50 },
      radius: 40,
      startAngle: 0,
      sweep: 90,
    }
    expect(insertStageCurveVertex(arc, { x: 90, y: 50 }))
      .toEqual({ status: 'rejected', reason: 'arc' })
  })

  it('闭合子路径的收尾直段上不插点，并说出原因', () => {
    const closed: ComposePathCurve = {
      kind: 'path',
      subpaths: [{ ...twoSegments.subpaths[0]!, closed: true }],
    }
    // (100,0) 回到 (0,0) 的那条直线的中点；它是展开时补出来的，数据里没有这一段。
    expect(insertStageCurveVertex(closed, { x: 50, y: 0 }))
      .toEqual({ status: 'rejected', reason: 'path-seam' })
  })
})

/*
 * 判别性来自**下限**与**分派**两处：只断言「顶点数减一」的用例，在一个会把折线删到只剩一个
 * 点的实现上同样会绿；只断言顶点夹点的用例，在一个把段中点也当顶点删的实现上同样会绿。
 */
describe('OpenSpec: stage-engine / 几何编辑会话内插入与删除顶点 / 删除', () => {
  it('矩形删掉一个角：四顶点变三顶点', () => {
    const result = deleteStageCurveVertex(rectangle, 'v1')
    const curve = result.status === 'ok' ? result.curve as ComposePolylineCurve : null
    expect(curve?.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 60 },
      { x: 0, y: 60 },
    ])
  })

  it('两顶点的多段线拒绝再删，几何不变', () => {
    const twoPoint: ComposePolylineCurve = {
      kind: 'polyline',
      vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      closed: false,
    }
    expect(deleteStageCurveVertex(twoPoint, 'v0'))
      .toEqual({ status: 'rejected', reason: 'floor' })
  })

  it('两点直线的端点在下限上', () => {
    expect(deleteStageCurveVertex(diagonal, 'start'))
      .toEqual({ status: 'rejected', reason: 'floor' })
  })

  it('段中点、平移夹点与控制手柄都不是顶点', () => {
    expect(deleteStageCurveVertex(rectangle, 'm2'))
      .toEqual({ status: 'rejected', reason: 'unsupported' })
    expect(deleteStageCurveVertex(diagonal, 'move'))
      .toEqual({ status: 'rejected', reason: 'unsupported' })
    expect(deleteStageCurveVertex(twoSegments, 'p0v1o'))
      .toEqual({ status: 'rejected', reason: 'unsupported' })
  })

  it('弧不受理，并说出原因', () => {
    const arc: ComposeArcCurve = {
      kind: 'arc',
      center: { x: 50, y: 50 },
      radius: 40,
      startAngle: 0,
      sweep: 90,
    }
    expect(deleteStageCurveVertex(arc, 'mid'))
      .toEqual({ status: 'rejected', reason: 'arc' })
  })

  it('路径删掉中间顶点：前后两段并成一段，外侧的控制点各自留下', () => {
    const result = deleteStageCurveVertex(twoSegments, 'p0v1')
    const curve = result.status === 'ok' ? result.curve as ComposePathCurve : null
    expect(curve?.subpaths[0]?.segments).toEqual([
      { c1: { x: 10, y: 40 }, c2: { x: 90, y: 40 }, to: { x: 100, y: 0 } },
    ])
  })

  it('路径删掉起点：第二个点接任', () => {
    const result = deleteStageCurveVertex(twoSegments, 'p0v0')
    const curve = result.status === 'ok' ? result.curve as ComposePathCurve : null
    expect(curve?.subpaths[0]?.start).toEqual({ x: 50, y: 50 })
    expect(curve?.subpaths[0]?.segments).toHaveLength(1)
  })

  it('路径删到只剩两个顶点之后拒绝再删', () => {
    const single: ComposePathCurve = {
      kind: 'path',
      subpaths: [{
        start: { x: 0, y: 0 },
        segments: [{ c1: { x: 10, y: 40 }, c2: { x: 40, y: 50 }, to: { x: 50, y: 50 } }],
        closed: false,
      }],
    }
    expect(deleteStageCurveVertex(single, 'p0v1'))
      .toEqual({ status: 'rejected', reason: 'floor' })
  })
})
