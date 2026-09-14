import { describe, expect, it } from 'vitest'
import { roundComposeGeometry } from './geometry-precision'
import {
  composeArcPointAt,
  composeArcToCubicShapes,
  composeCubicAsArc,
  composeCubicAsSegment,
  pointToComposeArcDistance,
  type ComposeArcShape,
  type ComposeCubicShape,
} from './curve-geometry'

const TO_RADIANS = Math.PI / 180

/**
 * 按坐标量化的规矩把一条三次段舍到两位小数。
 *
 * @remarks
 * 判别性全在这一步：不舍入的话识别是一道恒等式，任何实现都能绿。真实数据经
 * `normalizeComposeCurveGeometry` 写进文档时每个控制点都过 `roundComposeGeometry`，
 * 而浅弧的矢高只有几个量化步长——这正是「按拟合参数判等」会翻车、按轨迹判等才成立的地方。
 */
function quantize(cubic: ComposeCubicShape): ComposeCubicShape {
  const at = (point: { readonly x: number; readonly y: number }) => ({
    x: roundComposeGeometry(point.x),
    y: roundComposeGeometry(point.y),
  })
  return { start: at(cubic.start), c1: at(cubic.c1), c2: at(cubic.c2), end: at(cubic.end) }
}

describe('OpenSpec: compose-document / 三次贝塞尔能被识别回圆弧或直线 / 生成的弧段认回同一段弧', () => {
  // 圆心刻意取非整数：整点圆心会让舍入误差在两轴上对称抵消，掩盖真实的拟合偏差。
  const center = { x: 13.37, y: -42.5 }
  for (const radius of [2, 8.5, 60, 500]) {
    for (const sweep of [30, 47.3, 90, -30, -68.4, -90]) {
      it(`半径 ${radius}、扫掠 ${sweep}° 的弧舍入之后仍认得出，且轨迹处处吻合`, () => {
        const arc: ComposeArcShape = { center, radius, startAngle: 31, sweep }
        const shapes = composeArcToCubicShapes(arc)
        // 至多 90° 一段，因此这些弧各只有一段；多于一段说明夹具本身跑偏了。
        expect(shapes).toHaveLength(1)

        const recognized = composeCubicAsArc(quantize(shapes[0]!))
        expect(recognized).not.toBeNull()

        /*
         * 断言落在**轨迹**上：沿原弧均匀取样，每一点到认出来那段弧的距离都在容差内。
         * 刻意不断圆心与半径——浅弧的半径由矢高反解，量化能让它差出几成，而形状仍然吻合。
         */
        for (let i = 0; i <= 16; i += 1) {
          const point = composeArcPointAt(arc, arc.startAngle + (sweep * i) / 16)
          expect(pointToComposeArcDistance(recognized!, point)).toBeLessThanOrEqual(0.05)
        }
      })
    }
  }
})

describe('OpenSpec: compose-document / 三次贝塞尔能被识别回圆弧或直线 / 矢高只有几个量化步长的弧认成直线', () => {
  it('半径 2、扫掠 5° 的弧认成直线段，不认成弧', () => {
    const arc: ComposeArcShape = { center: { x: 0, y: 0 }, radius: 2, startAngle: 10, sweep: 5 }
    // 矢高 = r(1 − cos(Δ/2)) = 0.0019，不到量化步长 0.01 的五分之一：存下来它就是一条直线。
    expect(arc.radius * (1 - Math.cos((arc.sweep / 2) * TO_RADIANS))).toBeLessThan(0.002)

    const cubic = quantize(composeArcToCubicShapes(arc)[0]!)
    expect(composeCubicAsSegment(cubic)).not.toBeNull()

    /*
     * 刻意**不**断言 `composeCubicAsArc` 在这一档返回 null：它单独不是一个分类器。整条段只
     * 跨 0.17 个单位，过三个几乎共线的点定出来的圆虽然半径已经没有意义，轨迹却仍然落在容差
     * 内，于是它会认。挡住这一档的是**次序**——矢高越小，控制点离弦越近，因此同一个容差下
     * 直线那一问必然先命中。这条次序是 `composeCubicAsSegment` 文档里写明的契约。
     */
  })
})

describe('OpenSpec: compose-document / 三次贝塞尔能被识别回圆弧或直线 / 控制点落在弦上的段是直线', () => {
  it('控制点在弦的三分之一与三分之二处时给出这条弦，且不认成弧', () => {
    const cubic: ComposeCubicShape = {
      start: { x: 10, y: 20 },
      c1: { x: 40, y: 40 },
      c2: { x: 70, y: 60 },
      end: { x: 100, y: 80 },
    }
    expect(composeCubicAsSegment(cubic)).toEqual({ start: { x: 10, y: 20 }, end: { x: 100, y: 80 } })
    expect(composeCubicAsArc(cubic)).toBeNull()
  })

  it('控制点落在弦的延长线上时不是直线段——轨迹冲出了两个端点之外', () => {
    const cubic: ComposeCubicShape = {
      start: { x: 0, y: 0 },
      c1: { x: -60, y: 0 },
      c2: { x: 160, y: 0 },
      end: { x: 100, y: 0 },
    }
    expect(composeCubicAsSegment(cubic)).toBeNull()
  })
})

describe('OpenSpec: compose-document / 三次贝塞尔能被识别回圆弧或直线 / 自由贝塞尔不认', () => {
  it('两个控制点分在弦两侧的 S 形既不是弧也不是直线', () => {
    const cubic: ComposeCubicShape = {
      start: { x: 0, y: 0 },
      c1: { x: 0, y: 100 },
      c2: { x: 100, y: -100 },
      end: { x: 100, y: 0 },
    }
    expect(composeCubicAsArc(cubic)).toBeNull()
    expect(composeCubicAsSegment(cubic)).toBeNull()
  })

  it('把一段弧的控制点沿法向挪开远超容差之后不再认成弧', () => {
    const arc: ComposeArcShape = { center: { x: 0, y: 0 }, radius: 100, startAngle: 0, sweep: 90 }
    const base = composeArcToCubicShapes(arc)[0]!
    // 弦长 141，容差 max(0.05, 0.283) = 0.283；挪开 8 是它的近三十倍。
    const bent: ComposeCubicShape = { ...base, c1: { x: base.c1.x + 8, y: base.c1.y + 8 } }
    expect(composeCubicAsArc(bent)).toBeNull()
  })
})

describe('OpenSpec: compose-document / 三次贝塞尔能被识别回圆弧或直线 / 超过 90° 的段不认', () => {
  it('一段 120° 的弧凑成一条三次段时不认', () => {
    /*
     * 生成侧每段至多 90°，因此 120° 的单段没有来源——它要么来自别的工具，要么是巧合。
     * 夹具按同一个闭式解手工凑出来，免得 `composeArcToCubicShapes` 把它切成两段。
     */
    const radius = 100
    const sweep = 120
    const handle = (4 / 3) * Math.tan((sweep * TO_RADIANS) / 4) * radius
    const a = { x: 1, y: 0 }
    const b = { x: Math.cos(sweep * TO_RADIANS), y: Math.sin(sweep * TO_RADIANS) }
    const cubic: ComposeCubicShape = {
      start: { x: radius * a.x, y: radius * a.y },
      c1: { x: radius * a.x - handle * a.y, y: radius * a.y + handle * a.x },
      c2: { x: radius * b.x + handle * b.y, y: radius * b.y - handle * b.x },
      end: { x: radius * b.x, y: radius * b.y },
    }
    expect(composeCubicAsArc(cubic)).toBeNull()
  })
})
