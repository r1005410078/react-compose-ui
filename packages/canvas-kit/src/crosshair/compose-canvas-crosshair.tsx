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
 * @public
 */
export function ComposeCanvasCrosshairLayer({
  crosshair,
  surfaceSize,
  testIdPrefix,
}: ComposeCanvasCrosshairLayerProps) {
  if (!crosshair) return null
  const { center, lines, box, boxRadius, size } = crosshair
  // 长度按视口较短边取百分比，与 AutoCAD 的 CURSORSIZE 同义；100 时贯穿整个图面。
  const reach = (Math.min(surfaceSize.width, surfaceSize.height) * size) / 100
  const gap = box ? boxRadius : 0
  return (
    <g className="compose-canvas__crosshair" data-testid={`${testIdPrefix}-crosshair`}>
      {lines ? AXES.flatMap((axis, index) => [-1, 1].map((direction) => (
        <line
          key={`axis-${index}-${direction}`}
          {...{ [`data-${testIdPrefix}-crosshair-line`]: '' }}
          x1={center.x + axis.x * gap * direction}
          x2={center.x + axis.x * reach * direction}
          y1={center.y + axis.y * gap * direction}
          y2={center.y + axis.y * reach * direction}
        />
      ))) : null}
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
