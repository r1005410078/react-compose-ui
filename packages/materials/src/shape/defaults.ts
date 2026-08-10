import type { ComposeAppearance, JsonObject } from '@compose-ui/core'

/** 绘图 Shape 的默认线条尺寸。 @internal */
export const DEFAULT_SHAPE_SIZE = Object.freeze({ width: 240, height: 140 })

/** 绘图 Shape 的默认透明外观，图形由 SVG stroke 自己绘制。 @internal */
export const DEFAULT_SHAPE_APPEARANCE: ComposeAppearance = Object.freeze({
  backgroundPaint: { kind: 'solid', color: 'transparent' },
  borderColor: 'transparent',
  borderWidth: 0,
  borderRadius: 0,
  opacity: 1,
  shadow: null,
} satisfies ComposeAppearance)

/** Line 的默认 Renderer Props。 @internal */
export const DEFAULT_LINE_PROPS: JsonObject = Object.freeze({
  kind: 'line',
  direction: { x: 1, y: 1 },
  stroke: '#d8e2f1',
  strokeWidth: 2,
  strokeLinecap: 'butt',
  strokeDasharray: 'none',
  markerStart: 'none',
  markerEnd: 'none',
})

/** Arrow 的默认 Renderer Props。 @internal */
export const DEFAULT_ARROW_PROPS: JsonObject = Object.freeze({
  kind: 'arrow',
  direction: { x: 1, y: 1 },
  stroke: '#d8e2f1',
  strokeWidth: 2,
  strokeLinecap: 'butt',
  strokeDasharray: 'none',
  markerStart: 'none',
  markerEnd: 'arrow',
})

/** Circle 的默认 Renderer Props。 @internal */
export const DEFAULT_CIRCLE_PROPS: JsonObject = Object.freeze({
  kind: 'circle',
  stroke: '#d8e2f1',
  strokeWidth: 2,
})
