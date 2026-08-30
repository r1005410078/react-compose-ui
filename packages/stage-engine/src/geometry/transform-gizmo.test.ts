import { describe, expect, it } from 'vitest'
import {
  gizmoScaleHandle,
  STAGE_GIZMO_MOVE_HIT_WIDTH,
  STAGE_GIZMO_AXIS_LENGTH,
  STAGE_GIZMO_ARROW_WIDTH,
  STAGE_GIZMO_RING_HIT_WIDTH,
  STAGE_GIZMO_RING_RADIUS,
  STAGE_GIZMO_SCALE_DISTANCE,
  STAGE_GIZMO_SCALE_HIT_SIZE,
  STAGE_GIZMO_SCALE_SIZE,
  transformGizmoGeometry,
} from './transform-gizmo'

const center = { x: 100, y: 100 }
const viewport = { x: 0, y: 0, zoom: 1 }

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

describe('OpenSpec: stage / Rive 式变换指示器 / 把手几何', () => {
  it('轴对齐时 X 向右、Y 向上', () => {
    // 屏幕 Y 轴向下，因此「向上」是 y 变小——与 `距离<角度` 是同一套约定。
    const gizmo = transformGizmoGeometry({ center, degrees: 0, viewport })

    expect(gizmo.axes[0]).toMatchObject({ axis: 'x', degrees: 0 })
    expect(gizmo.axes[0].tip.x).toBeCloseTo(100 + STAGE_GIZMO_AXIS_LENGTH)
    expect(gizmo.axes[0].tip.y).toBeCloseTo(100)
    expect(gizmo.axes[1]).toMatchObject({ axis: 'y', degrees: 90 })
    expect(gizmo.axes[1].tip.x).toBeCloseTo(100)
    expect(gizmo.axes[1].tip.y).toBeCloseTo(100 - STAGE_GIZMO_AXIS_LENGTH)
  })

  it('轴跟着对象的旋转转，两条始终正交', () => {
    const gizmo = transformGizmoGeometry({ center, degrees: 30, viewport })

    expect(gizmo.axes[0].degrees).toBe(30)
    expect(gizmo.axes[1].degrees).toBe(120)
    expect(gizmo.axes[0].scaleHandle.x)
      .toBeCloseTo(100 + Math.cos(Math.PI / 6) * STAGE_GIZMO_SCALE_DISTANCE)
    expect(gizmo.axes[0].scaleHandle.y).toBeCloseTo(100 - STAGE_GIZMO_SCALE_DISTANCE / 2)
  })

  it('方块在环内、箭头在环外', () => {
    /*
     * 次序是「方块 → 环 → 箭头」：方块坐进环的命中带里的话按下去开始的是旋转。**判据取
     * 命中区而不是画出来的方块**——真正决定「按下去是哪一个」的是靶区。
     */
    const gizmo = transformGizmoGeometry({ center, degrees: 0, viewport })

    expect(distance(gizmo.center, gizmo.axes[0].scaleHandle) + STAGE_GIZMO_SCALE_HIT_SIZE / 2)
      .toBeLessThan(gizmo.ringRadius - STAGE_GIZMO_RING_HIT_WIDTH)
    expect(STAGE_GIZMO_AXIS_LENGTH).toBeGreaterThan(gizmo.ringRadius)
  })

  it('靶区不小于画出来的把手', () => {
    /*
     * 这条钉的是上一版真实踩到的缺陷：画出来 112px 的箭头只有最外面 22px 能抓、方块只有画出来
     * 的 10px，于是圆环（整圈 20px 宽的带）成了唯一抓得住的把手，用户读出来是「只有旋转能用」。
     * 断言只能落在**常量关系**上——点每个元素几何中心的用例永远打得中，对这个缺陷全绿。
     */
    expect(STAGE_GIZMO_SCALE_HIT_SIZE).toBeGreaterThan(STAGE_GIZMO_SCALE_SIZE)
    expect(STAGE_GIZMO_MOVE_HIT_WIDTH).toBeGreaterThanOrEqual(STAGE_GIZMO_ARROW_WIDTH * 2)
  })

  it('环的半径是屏幕常量，与选区大小无关', () => {
    /*
     * 跟着选区走的代价是指示器随对象无限长大：220×150 的盒子就把环推到 149、箭头推到 199，
     * 转过 90° 之后箭头落到图面之外。因此改成固定值，代价是大对象上环会压在本体上——那是
     * 接受的取舍，不是遗漏。
     */
    const gizmo = transformGizmoGeometry({ center, degrees: 0, viewport })

    expect(gizmo.ringRadius).toBe(STAGE_GIZMO_RING_RADIUS)
  })

  it('把手到中心的距离屏幕恒定，不跟画布缩放变长', () => {
    /*
     * 指示器是 chrome 不是画布上的内容：跟着缩放变粗变长会让它在放大时盖住半张图、缩小时小到
     * 点不中。判别性必须落在**到中心的距离**上——中心本身会跟着视口挪，只断绝对坐标读不出这件事。
     */
    for (const zoom of [0.25, 1, 4]) {
      const gizmo = transformGizmoGeometry({ center, degrees: 0, viewport: { x: 0, y: 0, zoom } })
      expect(distance(gizmo.center, gizmo.axes[0].tip)).toBeCloseTo(STAGE_GIZMO_AXIS_LENGTH)
      expect(distance(gizmo.center, gizmo.axes[0].scaleHandle))
        .toBeCloseTo(STAGE_GIZMO_SCALE_DISTANCE)
      expect(gizmo.ringRadius).toBe(STAGE_GIZMO_RING_RADIUS)
    }
  })

  it('缩放手柄按轴当前指向的方向归一', () => {
    /*
     * 拖动方向必须与画出来的箭头一致：对象转过 180° 时它的 +X 指向屏幕左，此时该拖的是 `w`。
     * 归到最近的正方向而不是直接用 `e`——后者会让「往箭头方向拖」把对象缩小。
     */
    expect(gizmoScaleHandle(0)).toBe('e')
    expect(gizmoScaleHandle(90)).toBe('n')
    expect(gizmoScaleHandle(180)).toBe('w')
    expect(gizmoScaleHandle(270)).toBe('s')
    expect(gizmoScaleHandle(-90)).toBe('s')
    expect(gizmoScaleHandle(170)).toBe('w')
  })
})
