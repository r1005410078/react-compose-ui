import {
  describeComposePaint,
  resolveComposeAppearance,
  type ComposeEntity,
  type ComposePaint,
} from '@compose-ui/core'
import { useId } from 'react'
import type { CSSProperties } from 'react'

function stopsMarkup(stops: readonly { readonly color: string; readonly position: number }[]) {
  return stops.map((stop, index) => (
    <stop key={`${stop.position}-${index}`} offset={`${stop.position * 100}%`} stopColor={stop.color} />
  ))
}

function conicStops(stops: readonly { readonly color: string; readonly position: number }[]) {
  return stops.map((stop) => `${stop.color} ${stop.position * 100}%`).join(', ')
}

/** 结构化 Entity Paint 背景层的输入。 @public */
export interface ComposeEntityPaintLayerProps {
  /** 当前 Entity。 */
  readonly entity: ComposeEntity
  /** Stage preview 可以临时覆盖的 Paint；省略时解析正式 Appearance。 */
  readonly paint?: ComposePaint
  /**
   * 是否把该层作为编辑 Stage 的背景命中面。
   *
   * @defaultValue false
   * @remarks
   * 透明 Container 在视觉上没有可命中的像素；编辑 Stage 传入 `true` 后，空白组合区域
   * 仍可用于选择和拖动。Preview 保持 `false`，避免渲染层承载交互语义。
   */
  readonly interactive?: boolean
}

/**
 * 渲染 Entity 的结构化 Paint 背景层。
 *
 * @remarks
 * Stage 和 Preview 只能通过这一层解释 `Appearance.backgroundPaint`。线性/径向渐变使用
 * 受控 SVG，避免不同 CSS 实现对局部端点或椭圆半径的解释漂移；角向渐变则映射为原生
 * `conic-gradient`，并始终位于 Renderer 与子 Entity 之下。
 *
 * @public
 */
export function ComposeEntityPaintLayer({
  entity,
  paint,
  interactive = false,
}: ComposeEntityPaintLayerProps) {
  const resolvedPaint = paint ?? resolveComposeAppearance(entity).backgroundPaint
  const descriptor = describeComposePaint(resolvedPaint)
  const gradientId = `compose-paint-${useId().replace(/:/g, '')}`
  const style: CSSProperties = {
    position: 'absolute',
    inset: 0,
    // 透明容器没有浏览器命中区域；仅编辑 Stage 需要此层补足空白组合区域的 Pointer 命中。
    pointerEvents: interactive ? 'auto' : 'none',
    borderRadius: 'inherit',
  }

  if (descriptor.kind === 'solid') {
    return <div aria-hidden="true" data-compose-paint="solid" style={{ ...style, background: descriptor.color }} />
  }
  if (descriptor.kind === 'angular-gradient') {
    return (
      <div
        aria-hidden="true"
        data-compose-paint="angular-gradient"
        style={{
          ...style,
          background: `conic-gradient(from ${descriptor.angle}deg at ${descriptor.center.x * 100}% ${descriptor.center.y * 100}%, ${conicStops(descriptor.stops)})`,
        }}
      />
    )
  }
  if (descriptor.kind === 'linear-gradient') {
    return (
      <svg aria-hidden="true" data-compose-paint="linear-gradient" preserveAspectRatio="none" style={style} viewBox="0 0 1 1">
        <defs>
          <linearGradient id={gradientId} x1={descriptor.start.x} x2={descriptor.end.x} y1={descriptor.start.y} y2={descriptor.end.y}>
            {stopsMarkup(descriptor.stops)}
          </linearGradient>
        </defs>
        <rect fill={`url(#${gradientId})`} height="1" width="1" x="0" y="0" />
      </svg>
    )
  }
  const { center, radiusX, radiusY, stops } = descriptor
  return (
    <svg aria-hidden="true" data-compose-paint="radial-gradient" preserveAspectRatio="none" style={style} viewBox="0 0 1 1">
      <defs>
        <radialGradient
          cx={center.x}
          cy={center.y}
          gradientTransform={`translate(${center.x} ${center.y}) scale(${radiusX} ${radiusY}) translate(${-center.x} ${-center.y})`}
          id={gradientId}
          r="1"
        >
          {stopsMarkup(stops)}
        </radialGradient>
      </defs>
      <rect fill={`url(#${gradientId})`} height="1" width="1" x="0" y="0" />
    </svg>
  )
}
