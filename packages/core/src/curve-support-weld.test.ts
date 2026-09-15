/**
 * 重合边界的支撑归一。
 *
 * 夹具的数都出自量到的真实往返：两块填充共用的一段弧，圆心差到三个量化步长，而轨迹只差
 * 不到半个步长——因此这些用例刻意**按参数构造得很远、按轨迹构造得很近**，判据取错就红。
 */

import { describe, expect, it } from 'vitest'
import {
  buildGraph,
  composeOutlineSupport,
  piecePointAt,
  pieceSpan,
  weldComposeOutlineSupports,
} from './curve-arrangement'
import type { ComposeOutlinePiece } from './curve-geometry'

/** 文档精度的量化步长。 */
const QUANTUM = 0.01

const arc = (
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  sweep: number,
): ComposeOutlinePiece => ({ kind: 'arc', arc: { center: { x: cx, y: cy }, radius: r, startAngle, sweep } })

const segment = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): ComposeOutlinePiece => ({ kind: 'segment', segment: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } } })

describe('OpenSpec: compose-document / 重合的边界在建图之前归一到同一条支撑', () => {
  it('圆心差三个量化步长、轨迹只差半个步长的两条弧归到同一条支撑', () => {
    /*
     * 圆心沿这一段的角平分线（+x）挪 0.03、半径同步减 0.03：两条圆在这 60° 上的径向差是
     * `0.03 · (1 − cos Δ)`，最大 0.004——不到半个量化步长，而圆心差了三个。
     */
    const original = arc(0, 0, 100, -30, 60)
    const perturbed = arc(0.03, 0, 99.97, -30, 60)
    const welded = weldComposeOutlineSupports([original, perturbed], QUANTUM)
    expect(composeOutlineSupport(welded[0]!)).toEqual(composeOutlineSupport(welded[1]!))
  })

  it('轨迹差得开的两条弧各留各的支撑', () => {
    const inner = arc(0, 0, 100, -30, 60)
    const outer = arc(0, 0, 100.5, -30, 60)
    const welded = weldComposeOutlineSupports([inner, outer], QUANTUM)
    expect(composeOutlineSupport(welded[0]!)).not.toEqual(composeOutlineSupport(welded[1]!))
  })

  it('方向相反的两条共线线段归到同一条支撑', () => {
    const forward = segment(0, 10, 100, 10)
    const backward = segment(100, 10.004, 0, 10.004)
    const welded = weldComposeOutlineSupports([forward, backward], QUANTUM)
    expect(composeOutlineSupport(welded[0]!)).toEqual(composeOutlineSupport(welded[1]!))
  })

  it('差开半个量级的两条平行线各留各的支撑', () => {
    // 与上一条配对：少了它，「线段的支撑」只要恒返回同一个常量就能骗过上一条。
    const lower = segment(0, 10, 100, 10)
    const upper = segment(0, 10.5, 100, 10.5)
    const welded = weldComposeOutlineSupports([lower, upper], QUANTUM)
    expect(composeOutlineSupport(welded[0]!)).not.toEqual(composeOutlineSupport(welded[1]!))
  })

  it('规范支撑不随输入顺序变', () => {
    const a = arc(0, 0, 100, -30, 60)
    const b = arc(0.03, 0, 99.97, -30, 60)
    const forward = weldComposeOutlineSupports([a, b], QUANTUM).map(composeOutlineSupport)
    const backward = weldComposeOutlineSupports([b, a], QUANTUM).map(composeOutlineSupport)
    expect(forward[0]).toEqual(backward[0])
    expect(forward[1]).toEqual(backward[1])
  })

  it('量化步长为零时一条都不归一', () => {
    const a = arc(0, 0, 100, -30, 60)
    const b = arc(0.03, 0, 99.97, -30, 60)
    const welded = weldComposeOutlineSupports([a, b], 0)
    expect(composeOutlineSupport(welded[0]!)).not.toEqual(composeOutlineSupport(welded[1]!))
  })
})

describe('OpenSpec: compose-document / 平面图的节点合并容差不低于一个坐标量化步长', () => {
  /** 图里有没有两条中点靠得比一个量化步长还近的边——也就是没收掉的重复。 */
  const hasNearDuplicate = (graph: ReturnType<typeof buildGraph>) => {
    const mids = graph.subEdges.map((edge) => piecePointAt(edge.piece, pieceSpan(edge.piece) / 2))
    return mids.some((a, i) => mids.some((b, j) => j > i && Math.hypot(a.x - b.x, a.y - b.y) <= QUANTUM))
  }

  it('只抬节点容差收不掉重复的边，归一才收得掉', () => {
    /*
     * 判别性所在：这两条边在图上是同一段边界，差的只是一个量化步长。抬容差只改「节点算不算
     * 同一个」，两条边仍然各是一条；量过——单抬容差那一档，共用弧边界的两块面求并集仍然报
     * 求解退化。
     */
    const pieces = [arc(0, 0, 100, -30, 60), arc(0.03, 0, 99.97, -30, 60)]
    expect(hasNearDuplicate(buildGraph(pieces, QUANTUM, 0))).toBe(true)
    expect(hasNearDuplicate(buildGraph(pieces, QUANTUM, QUANTUM))).toBe(false)
  })

  it('零长的弧子边不进图', () => {
    // 整段跨度小于一个量化步长的弧：两个端点并成同一个节点，这条边没有朝向可读。
    const hair = arc(0, 0, 100, 0, 0.002)
    expect(buildGraph([hair], QUANTUM, QUANTUM).subEdges).toHaveLength(0)
  })
})
