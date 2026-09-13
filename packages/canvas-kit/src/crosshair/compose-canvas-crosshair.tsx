import { useId } from 'react'
import type { ComposeCanvasCrosshair } from './crosshair-model'

/** {@link ComposeCanvasCrosshairLayer} 的属性。 @public */
export interface ComposeCanvasCrosshairLayerProps {
  /** {@link resolveComposeCanvasCrosshair} 的返回值；`null` 时不渲染。 */
  readonly crosshair: ComposeCanvasCrosshair | null
  /** 图面尺寸（CSS 像素）；十字线长度按较短边取百分比。 */
  readonly surfaceSize: { readonly width: number; readonly height: number }
  /**
   * `data-testid` 与线元素属性标记的前缀。
   *
   * @remarks
   * 与标尺一致：组件不规定自己在哪个画布里，标识由调用方给出。
   */
  readonly testIdPrefix: string
}

/** 两条轴的方向向量；引入 UCS 时改的是这里的来源，不是绘制。 */
const AXES = [{ x: 1, y: 0 }, { x: 0, y: 1 }] as const

/**
 * 渐隐的三个色标：**主体满不透明，只有末梢淡出**。
 *
 * @remarks
 * 曲线的形状是实机量出来的，不是拍脑袋给的。第一版取 `1 / 0.5@0.35 / 0.15`——从中心就开始
 * 衰减——在 512px 的臂上把整条线都压淡了：线的绝大部分落在 0.15~0.5 这一档，读起来比合并
 * 前的均匀实线还弱，而**渐变本身反倒看不出来**（两端都淡，没有对比）。用户的原话是「没有
 * 变化」，而那正是这条曲线的症状。
 *
 * 现在前 55% 保持满不透明：那一段是用户正在盯着的落点附近，可读性不让步；余下 45% 一路
 * 淡到 0.12，渐隐因此**既看得出来又不牺牲主体**。远端 MUST NOT 淡到 0——贯穿图面的臂长
 * 存在的理由是跨图对齐，远端看不见等于臂长白拉。
 */
const FADE_STOPS = [
  { offset: 0, opacity: 1 },
  { offset: 0.55, opacity: 1 },
  { offset: 1, opacity: 0.12 },
] as const

/**
 * 绘制十字光标的 SVG 组。
 *
 * @remarks
 * 返回一个 `<g>` 而不是独立的 overlay：两块画布都已经有自己的 SVG 图层，多一层要各自对齐
 * 定位与 `z-index`。摆在哪里由调用方决定，本组件只提供画布元素自身的样式——与标尺同一条判断。
 *
 * **十字线在拾取框处断开。**框覆盖的正是用户要看清的靶区，两条线直穿过去等于用光标盖住
 * 自己正对准的东西。
 *
 * 线按一对轴向量绘制而不是写死 `x1=0/x2=width`：AutoCAD 的十字线对齐的是 UCS 轴，转了 UCS
 * 就跟着转。现在没有 UCS，屏幕轴对齐是对的，但以后加进来时改的是向量来源而不是这里。
 *
 * **两种样式共用同一份几何**，只换画笔：
 * - `fade` 给每条臂一份 `userSpaceOnUse` 的线性渐变。按包围盒（`objectBoundingBox`）的渐变
 *   在高度为零的水平线上方向无定义，必须按用户空间给绝对起终点，因此四条臂各一份。渐变 id
 *   由 `useId` 生成：同一页面可以有多个画布，写死 id 会让一个画布的渐变指到另一个画布的
 *   `<defs>` 上。渐变描边写在 `style` 上而不是 `stroke` 属性上——样式表里既有的 `stroke`
 *   规则压过呈现属性，写属性会被覆盖成纯色。
 * - `halo` 在主线之下先画一条取画布底色的粗线。晕圈线**不带** `crosshair-line` 标记：它不是
 *   十字线，数十字线的一方仍该数到四条。
 *
 * @public
 */
export function ComposeCanvasCrosshairLayer({
  crosshair,
  surfaceSize,
  testIdPrefix,
}: ComposeCanvasCrosshairLayerProps) {
  const gradientId = useId()
  if (!crosshair) return null
  const { center, lines, box, boxRadius, size, style } = crosshair
  // 长度按视口较短边取百分比，与 AutoCAD 的 CURSORSIZE 同义；100 时贯穿整个图面。
  const reach = (Math.min(surfaceSize.width, surfaceSize.height) * size) / 100
  const gap = box ? boxRadius : 0
  const arms = AXES.flatMap((axis, index) => [-1, 1].map((direction) => ({
    key: `axis-${index}-${direction}`,
    x1: center.x + axis.x * gap * direction,
    y1: center.y + axis.y * gap * direction,
    x2: center.x + axis.x * reach * direction,
    y2: center.y + axis.y * reach * direction,
  })))
  const halo = style === 'halo'
  return (
    <g
      className="compose-canvas__crosshair"
      data-crosshair-style={style}
      data-testid={`${testIdPrefix}-crosshair`}
    >
      {lines && style === 'fade' ? (
        <defs>
          {arms.map((arm) => (
            <linearGradient
              key={arm.key}
              gradientUnits="userSpaceOnUse"
              id={`${gradientId}-${arm.key}`}
              x1={arm.x1}
              x2={arm.x2}
              y1={arm.y1}
              y2={arm.y2}
            >
              {FADE_STOPS.map((stop) => (
                <stop
                  key={stop.offset}
                  className="compose-canvas__crosshair-stop"
                  offset={stop.offset}
                  stopOpacity={stop.opacity}
                />
              ))}
            </linearGradient>
          ))}
        </defs>
      ) : null}
      {lines && halo ? arms.map((arm) => (
        <line
          key={`halo-${arm.key}`}
          {...{ [`data-${testIdPrefix}-crosshair-halo`]: '' }}
          className="compose-canvas__crosshair-halo"
          x1={arm.x1}
          x2={arm.x2}
          y1={arm.y1}
          y2={arm.y2}
        />
      )) : null}
      {box && halo ? (
        <rect
          className="compose-canvas__crosshair-halo"
          height={boxRadius * 2}
          width={boxRadius * 2}
          x={center.x - boxRadius}
          y={center.y - boxRadius}
        />
      ) : null}
      {lines ? arms.map((arm) => (
        <line
          key={arm.key}
          {...{ [`data-${testIdPrefix}-crosshair-line`]: '' }}
          style={style === 'fade' ? { stroke: `url(#${gradientId}-${arm.key})` } : undefined}
          x1={arm.x1}
          x2={arm.x2}
          y1={arm.y1}
          y2={arm.y2}
        />
      )) : null}
      {box ? (
        <rect
          {...{ [`data-${testIdPrefix}-crosshair-box`]: '' }}
          data-testid={`${testIdPrefix}-pickbox`}
          height={boxRadius * 2}
          width={boxRadius * 2}
          x={center.x - boxRadius}
          y={center.y - boxRadius}
        />
      ) : null}
    </g>
  )
}
