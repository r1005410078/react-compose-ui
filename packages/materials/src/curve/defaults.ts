import type { ComposeAppearance, ComposeCurve, JsonObject } from '@compose-ui/core'

/** 曲线默认尺寸，同时决定默认几何的两个端点。 @internal */
export const DEFAULT_CURVE_SIZE = Object.freeze({ width: 240, height: 140 })

/**
 * 默认几何是一条斜线而不是水平线。
 *
 * @remarks
 * 水平线的紧包围盒是退化的（高被钳到最小值），让它成为首次体验会掩盖盒与几何的关系；斜线
 * 还让「点包围盒空角不选中」在手动验证时立刻可感。
 *
 * @internal
 */
export const DEFAULT_CURVE_GEOMETRY: ComposeCurve = Object.freeze({
  kind: 'line',
  start: { x: 0, y: 0 },
  end: { x: DEFAULT_CURVE_SIZE.width, y: DEFAULT_CURVE_SIZE.height },
} satisfies ComposeCurve)

/** 曲线的默认透明外观；线条由 SVG stroke 自己绘制。 @internal */
export const DEFAULT_CURVE_APPEARANCE: ComposeAppearance = Object.freeze({
  backgroundPaint: { kind: 'solid', color: 'transparent' },
  borderColor: 'transparent',
  borderWidth: 0,
  borderRadius: 0,
  opacity: 1,
  shadow: null,
} satisfies ComposeAppearance)

/**
 * 曲线的默认描边 Renderer Props。
 *
 * @remarks
 * 线宽 1 是**发丝线**，与 CAD 画布的 `CAD_DEFAULT_STROKE_WIDTH` 同值，也是 AutoCAD 出厂时
 * 屏幕上的样子——默认 lineweight 是 0.25mm，而模型空间默认不显示 lineweight，于是所有线都按
 * 一个像素画。曾经写的 2 在图面上明显偏粗：接线图靠**线的走向**而不是线的分量传达信息，
 * 加粗只会让密集区糊成一片。
 *
 * 不为这个数在 `core` 立共享常量：`cad` 那一份按路线图步骤 7 要随 `CadDocument` 一起删除，
 * 为一个即将只剩一处的值提前抽象，收益是负的。
 *
 * @internal
 */
export const DEFAULT_CURVE_PROPS: JsonObject = Object.freeze({
  stroke: '#d8e2f1',
  strokeWidth: 1,
  strokeLinecap: 'round',
  strokeDasharray: 'none',
  markerStart: 'none',
  markerEnd: 'none',
})

/**
 * 圆的默认几何：扫掠 360 的弧。
 *
 * @remarks
 * 不另立圆或椭圆类型——**椭圆是非正方盒里的整圆**：`viewBox` 等于紧包围盒（一个正方形），
 * 盒是 240×140 时 `preserveAspectRatio="none"` 就把它拉成椭圆，命中侧的投影也已经跟着走。
 * 新类型要能带来别的类型带不来的性质，而椭圆带不来。
 *
 * @internal
 */
export const DEFAULT_CIRCLE_GEOMETRY: ComposeCurve = Object.freeze({
  kind: 'arc',
  center: { x: 50, y: 50 },
  radius: 50,
  startAngle: 0,
  sweep: 360,
} satisfies ComposeCurve)

/** Arrow 的默认描边：终点箭头。 @internal */
export const DEFAULT_ARROW_PROPS: JsonObject = Object.freeze({
  ...DEFAULT_CURVE_PROPS,
  markerEnd: 'arrow',
})
