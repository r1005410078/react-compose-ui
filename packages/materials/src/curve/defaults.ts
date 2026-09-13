import { COMPOSE_DEFAULT_HATCH_COLOR } from '@compose-ui/core'
import type { ComposeAppearance, ComposeColor, ComposeCurve, JsonObject } from '@compose-ui/core'

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
 * 不为这个数在 `core` 立共享常量：全仓库只有这一处用它，为一个单点的值抽象收益是负的。
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
 * 矩形的默认几何：四顶点的闭合多段线。
 *
 * @remarks
 * 与 `RECTANGLE` 命令画出来的**是同一种东西**：矩形不另立 kind，四个角是直角这件事在用户
 * 拖动某个顶点之后就不再成立。因此从物料面板点出来的矩形与敲 `R` 画出来的逐字段相同——
 * 同一个词在这个产品里只指一件东西。
 *
 * @internal
 */
export function composeRectangleGeometry(
  size: { readonly width: number; readonly height: number },
): ComposeCurve {
  return {
    kind: 'polyline',
    vertices: [
      { x: 0, y: 0 },
      { x: size.width, y: 0 },
      { x: size.width, y: size.height },
      { x: 0, y: size.height },
    ],
    closed: true,
  }
}

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

/**
 * 导线的默认描边：一次回路的红色粗实线。
 *
 * @remarks
 * **红色不是装饰，它就是这个领域里导线的样子。**变电站监控画面的通行惯例是
 * 红 = 合闸/带电、绿 = 分闸/停电，而储能、光伏这类一次接线图画的是**正常运行**的系统——
 * 整条一次回路本来就是带电的，因此实机上通篇是红。默认画成红，与实施工程师画完之后想要的
 * 样子一致。
 *
 * **绿是错的答案**：它在一次图里表示分闸/停电，正好相反。（初版曾照抄 KiCad 的导线绿——那是
 * PCB 原理图的惯例，那张图上颜色是空闲的语义通道，而这里不是。）
 *
 * 颜色**仍然留给数据绑定**：`stroke` 是可绑定的 Renderer prop，项目要做拓扑着色（带电红、
 * 停电绿）时绑它即可。红只是「还没绑」这一档的取值，而它取的正是最常见的那一档。
 *
 * `#ff3b30` 而不是纯红 `#ff0000`：两者都是红，但纯红在深色画布上视觉上会「振」，而这个值在
 * 编辑画布（≈5.1:1）与浅底页面（≈3.6:1）上都过图形元素的 3:1 门槛——场景背景默认透明，导线
 * 是会被发布出去的真实像素。
 *
 * 线宽 2 是一次回路的粗实线，沿用电气制图的既有读图习惯（二次回路与标注细实线）。这与
 * {@link DEFAULT_CURVE_PROPS} 上「2 明显偏粗」那条注释不冲突：**那条的前提是所有线一起
 * 加粗**，而只有主回路粗、标注与辅助几何细，恰恰是那条观察想要的结果。
 *
 * @internal
 */
export const COMPOSE_WIRE_STROKE: ComposeColor = '#ff3b30'

/** 导线的默认线宽；节点直径由它推出，见 {@link composeJunctionSize}。 @internal */
export const COMPOSE_WIRE_STROKE_WIDTH = 2

export const DEFAULT_WIRE_PROPS: JsonObject = Object.freeze({
  ...DEFAULT_CURVE_PROPS,
  stroke: COMPOSE_WIRE_STROKE,
  strokeWidth: COMPOSE_WIRE_STROKE_WIDTH,
})

/** Arrow 的默认描边：终点箭头。 @internal */
export const DEFAULT_ARROW_PROPS: JsonObject = Object.freeze({
  ...DEFAULT_CURVE_PROPS,
  markerEnd: 'arrow',
})

/**
 * 节点的默认外观：**填实**。
 *
 * @remarks
 * 曲线默认空心，而节点是这条规则的例外——它就是图上那个实心圆点，空心的接头读作「两个同心
 * 的小圆圈」而不是「这里接上了」。填色取自接入时那条导线的 `stroke`，这里的红只是没有来源
 * 时的兜底。
 *
 * @internal
 */
export const DEFAULT_JUNCTION_APPEARANCE: ComposeAppearance = Object.freeze({
  ...DEFAULT_CURVE_APPEARANCE,
  backgroundPaint: { kind: 'solid', color: COMPOSE_WIRE_STROKE },
} satisfies ComposeAppearance)

/**
 * 填充的默认外观：有填色、没有边框。
 *
 * @remarks
 * 颜色取 core 的 {@link COMPOSE_DEFAULT_HATCH_COLOR}——`materials` 与 `stage` 之间没有依赖，
 * 各写一份必然漂移，与 `COMPOSE_CURVE_PICK_TOLERANCE` 下沉到 core 是同一条理由。
 *
 * 边框宽度 0：填充是**一块面**，而围出它的那些线还在图上原样画着。再给它一圈边框等于把同一条
 * 边界画两遍，而两遍的抗锯齿对不齐，看起来像描边毛了。
 *
 * @internal
 */
export const DEFAULT_HATCH_APPEARANCE: ComposeAppearance = Object.freeze({
  ...DEFAULT_CURVE_APPEARANCE,
  backgroundPaint: { kind: 'solid', color: COMPOSE_DEFAULT_HATCH_COLOR },
} satisfies ComposeAppearance)

/**
 * 填充的默认描边 Props：不画描边。
 *
 * @remarks
 * `stroke: 'transparent'` 而不是删掉这些 prop：Renderer 的 prop 契约是一份闭合清单，缺席会
 * 回退到 `DEFAULT_CURVE_PROPS` 的浅色描边，那正好是上面那条「同一条边界画两遍」。
 *
 * @internal
 */
export const DEFAULT_HATCH_PROPS: JsonObject = Object.freeze({
  ...DEFAULT_CURVE_PROPS,
  stroke: 'transparent',
  strokeWidth: 0,
})

/**
 * 节点的默认描边：与填色同色、宽度为 0。
 *
 * @remarks
 * 描边宽度取 0 而不是照抄导线的 2：接头的直径本来就是按线宽算出来的，再加一圈同样粗的描边会
 * 让它胖出一倍。颜色仍与填色一致，免得作者改了填色之后边上留一圈旧色。
 *
 * @internal
 */
export const DEFAULT_JUNCTION_PROPS: JsonObject = Object.freeze({
  ...DEFAULT_WIRE_PROPS,
  strokeWidth: 0,
})
