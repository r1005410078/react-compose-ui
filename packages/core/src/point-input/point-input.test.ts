import { describe, expect, it } from 'vitest'
import { parseComposeCoordinate } from './coordinate'
import {
  applyComposeAngleConstraint,
  resolveComposePoint,
  type ComposePointContext,
} from './point-resolution'

function context(overrides: Partial<ComposePointContext> = {}): ComposePointContext {
  return { grid: { enabled: false, stepX: 10, stepY: 10 }, ...overrides }
}

describe('共享坐标语法', () => {
  it('三种写法', () => {
    expect(parseComposeCoordinate('100,50')).toEqual({ ok: true, point: { x: 100, y: 50 } })
    expect(parseComposeCoordinate('@10,20', { x: 1, y: 2 }))
      .toEqual({ ok: true, point: { x: 11, y: 22 } })
    const polar = parseComposeCoordinate('100<90', { x: 0, y: 0 })
    expect(polar.ok).toBe(true)
    // 屏幕 Y 轴向下，因此 90° 必须指向上方；少了那个负号所有极坐标都会上下翻转。
    if (polar.ok) expect(polar.point.y).toBeCloseTo(-100, 6)
  })

  it('缺少上一点时拒绝相对与极坐标', () => {
    expect(parseComposeCoordinate('@10,20')).toEqual({ ok: false, reason: 'missing-reference' })
    expect(parseComposeCoordinate('100<45')).toEqual({ ok: false, reason: 'missing-reference' })
  })

  it('非坐标文本给出可判别的失败原因', () => {
    expect(parseComposeCoordinate('CLOSE')).toEqual({ ok: false, reason: 'not-a-coordinate' })
  })
})

describe('共享点输入管线', () => {
  it('键入的坐标不被捕捉、正交或网格改写', () => {
    const resolved = resolveComposePoint({ x: 100, y: 50 }, 'typed', context({
      snapped: { x: 0, y: 0 },
      reference: { x: 0, y: 0 },
      angle: 'ortho',
      grid: { enabled: true, stepX: 10, stepY: 10 },
    }))
    expect(resolved).toEqual({ x: 100, y: 50 })
  })

  it('捕捉命中后不再经过网格与角度约束', () => {
    const resolved = resolveComposePoint({ x: 96, y: 48 }, 'pointer', context({
      snapped: { x: 103, y: 47 },
      reference: { x: 0, y: 0 },
      angle: 'ortho',
      grid: { enabled: true, stepX: 10, stepY: 10 },
    }))
    expect(resolved).toEqual({ x: 103, y: 47 })
  })

  it('指针取点依次经过网格与角度约束', () => {
    const resolved = resolveComposePoint({ x: 96, y: 12 }, 'pointer', context({
      reference: { x: 0, y: 0 },
      angle: 'ortho',
      grid: { enabled: true, stepX: 10, stepY: 10 },
    }))
    // 网格先取整，正交再把位移较小的 y 钳回参照点。
    expect(resolved).toEqual({ x: 100, y: 0 })
  })

  it('角度约束与网格都关闭时结果就是原始点', () => {
    expect(resolveComposePoint({ x: 96, y: 12 }, 'pointer', context())).toEqual({ x: 96, y: 12 })
  })

  describe('OpenSpec: compose-document / 角度约束排在网格之后', () => {
    it('参考点不在格点上时，被钉死的那个分量不再被网格取整', () => {
      const resolved = resolveComposePoint({ x: 96, y: 12 }, 'pointer', context({
        // 参考点落在格点之间：先正交后网格会把已经钉在 y=3 上的分量取整到 0，点因此
        // 离开正交线，而屏幕上只表现为「按着 F8 画出来的线还是斜的」。
        reference: { x: 0, y: 3 },
        angle: 'ortho',
        grid: { enabled: true, stepX: 10, stepY: 10 },
      }))
      expect(resolved).toEqual({ x: 100, y: 3 })
    })
  })

  describe('OpenSpec: compose-document / 极轴在容差内才吸', () => {
    const polarContext = (point: { x: number; y: number }) => resolveComposePoint(
      point,
      'pointer',
      context({
        reference: { x: 0, y: 0 },
        angle: 'polar',
        polar: { increment: 45, tolerance: 12 },
      }),
    )

    it('靠近 45° 射线时投影上去', () => {
      // (100, -96)：偏离 45° 射线约 2.8 个单位。
      const resolved = polarContext({ x: 100, y: -96 })
      expect(resolved.x).toBeCloseTo(98, 6)
      expect(resolved.y).toBeCloseTo(-98, 6)
    })

    it('离每一条射线都够不着时完全自由', () => {
      // 20° 方向，离 0° 与 45° 都远——这正是极轴敢默认开着的那一处。
      const point = { x: 200, y: -73 }
      expect(polarContext(point)).toEqual(point)
    })

    it('增量角 90 时 45° 方向不再被吸', () => {
      const resolved = resolveComposePoint({ x: 100, y: -100 }, 'pointer', context({
        reference: { x: 0, y: 0 },
        angle: 'polar',
        polar: { increment: 90, tolerance: 12 },
      }))
      expect(resolved).toEqual({ x: 100, y: -100 })
    })

    it('没有上一个点时不生效', () => {
      const resolved = resolveComposePoint({ x: 100, y: -96 }, 'pointer', context({
        angle: 'polar',
        polar: { increment: 45, tolerance: 12 },
      }))
      expect(resolved).toEqual({ x: 100, y: -96 })
    })

    it('落点与参考点重合时没有方向可言', () => {
      const resolved = resolveComposePoint({ x: 0, y: 0 }, 'pointer', context({
        reference: { x: 0, y: 0 },
        angle: 'polar',
        polar: { increment: 45, tolerance: 12 },
      }))
      expect(resolved).toEqual({ x: 0, y: 0 })
    })
  })

  describe('OpenSpec: compose-document / 命中的射线要上报', () => {
    it('呈现层与落点读同一份答案', () => {
      const hit = applyComposeAngleConstraint({ x: 100, y: -96 }, {
        reference: { x: 0, y: 0 },
        angle: 'polar',
        polar: { increment: 45, tolerance: 12 },
        grid: { enabled: false, stepX: 10, stepY: 10 },
      })
      expect(hit.ray).toBe(45)

      const miss = applyComposeAngleConstraint({ x: 200, y: -73 }, {
        reference: { x: 0, y: 0 },
        angle: 'polar',
        polar: { increment: 45, tolerance: 12 },
        grid: { enabled: false, stepX: 10, stepY: 10 },
      })
      expect(miss.ray).toBeNull()

      // 正交无条件投影，因此只要有参考点就总是命中。
      expect(applyComposeAngleConstraint({ x: 100, y: 12 }, {
        reference: { x: 0, y: 0 },
        angle: 'ortho',
        grid: { enabled: false, stepX: 10, stepY: 10 },
      }).ray).toBe(0)
      expect(applyComposeAngleConstraint({ x: 12, y: -100 }, {
        reference: { x: 0, y: 0 },
        angle: 'ortho',
        grid: { enabled: false, stepX: 10, stepY: 10 },
      }).ray).toBe(90)
    })
  })
})
