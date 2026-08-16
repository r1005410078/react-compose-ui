import { describe, expect, it } from 'vitest'
import { sampleComposeMotionPath } from './animation-motion-path'
import type { ComposeAnimationTrack, ComposeKeyframe } from './animation-types'

function vectorTrack(keyframes: readonly Partial<ComposeKeyframe>[]): ComposeAnimationTrack {
  return {
    path: ['LayoutItem', 'offset'],
    valueKind: 'vector2',
    keyframes: keyframes.map((item, index) => ({
      id: `k${index}`,
      timeMs: item.timeMs ?? index * 100,
      value: item.value ?? { x: index * 100, y: 0 },
      interpolation: item.interpolation ?? { kind: 'linear' },
      ...(item.spatial ? { spatial: item.spatial } : {}),
    })) as ComposeKeyframe[],
  }
}

/**
 * 点到两端连线的有符号距离，用来判断路径是否弯曲以及往哪弯。
 *
 * 符号约定：水平弦时正值表示点在 +y 一侧，与直觉一致。
 */
function signedDistanceToChord(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  return ((point.y - start.y) * dx - (point.x - start.x) * dy) / Math.hypot(dx, dy)
}

describe('运动路径几何', () => {
  it('OpenSpec: scene-animation / 运动路径几何求值 / corner 顶点之间是直线', () => {
    const geometry = sampleComposeMotionPath(vectorTrack([
      { value: { x: 0, y: 0 } },
      { value: { x: 100, y: 0 } },
    ]))
    expect(geometry.vertices).toHaveLength(2)
    expect(geometry.vertices[0]?.mode).toBe('corner')
    expect(geometry.vertices[0]?.inTangent).toBeNull()
    expect(geometry.vertices[0]?.outTangent).toBeNull()
    expect(geometry.polyline).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }])
    // 线性插值的直线段上，等时采样点应当均匀分布。
    const gaps = geometry.dots.slice(1).map((dot, index) => dot.x - geometry.dots[index]!.x)
    gaps.forEach((gap) => expect(gap).toBeCloseTo(gaps[0]!, 6))
  })

  it('OpenSpec: scene-animation / 运动路径几何求值 / smooth 顶点产生弯曲路径', () => {
    const geometry = sampleComposeMotionPath(vectorTrack([
      {
        value: { x: 0, y: 0 },
        spatial: { mode: 'smooth', inX: 0, inY: 0, outX: 0, outY: -80 },
      },
      { value: { x: 100, y: 0 } },
    ]))
    expect(geometry.vertices[0]?.outTangent).toEqual({ x: 0, y: -80 })
    expect(geometry.polyline.length).toBeGreaterThan(2)
    const middle = geometry.polyline[Math.floor(geometry.polyline.length / 2)]!
    const start = { x: 0, y: 0 }
    const end = { x: 100, y: 0 }
    // 出向切线指向 -y，路径必须向同侧鼓出。
    expect(middle.y).toBeLessThan(0)
    expect(signedDistanceToChord(middle, start, end)).toBeLessThan(0)
  })

  it('OpenSpec: scene-animation / 运动路径几何求值 / 等时采样点疏密体现速度', () => {
    const geometry = sampleComposeMotionPath(vectorTrack([
      {
        value: { x: 0, y: 0 },
        interpolation: { kind: 'cubic', control: [0.42, 0, 0.58, 1] },
      },
      { value: { x: 300, y: 0 } },
    ]))
    const gaps = geometry.dots.slice(1).map((dot, index) => dot.x - geometry.dots[index]!.x)
    const head = gaps[0]!
    const middle = gaps[Math.floor(gaps.length / 2)]!
    const tail = gaps[gaps.length - 1]!
    // 缓入缓出：两端走得慢（间距小），中间走得快（间距大）。
    expect(middle).toBeGreaterThan(head * 2)
    expect(middle).toBeGreaterThan(tail * 2)
  })

  it('OpenSpec: scene-animation / 运动路径几何求值 / 退化输入', () => {
    expect(sampleComposeMotionPath(vectorTrack([])).vertices).toEqual([])
    const single = sampleComposeMotionPath(vectorTrack([{ value: { x: 5, y: 5 } }]))
    expect(single.vertices).toHaveLength(1)
    expect(single.polyline).toEqual([{ x: 5, y: 5 }])
    expect(single.dots).toEqual([{ x: 5, y: 5 }])
  })

  it('OpenSpec: scene-animation / 运动路径几何求值 / 非 vector2 轨道返回空几何', () => {
    const geometry = sampleComposeMotionPath({
      path: ['Appearance', 'opacity'],
      valueKind: 'number',
      keyframes: [
        { id: 'a', timeMs: 0, value: 0, interpolation: { kind: 'linear' } },
        { id: 'b', timeMs: 100, value: 1, interpolation: { kind: 'linear' } },
      ],
    })
    expect(geometry.vertices).toEqual([])
    expect(geometry.polyline).toEqual([])
  })
})
