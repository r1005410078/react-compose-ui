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

/** 曲线的默认描边 Renderer Props。 @internal */
export const DEFAULT_CURVE_PROPS: JsonObject = Object.freeze({
  stroke: '#d8e2f1',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeDasharray: 'none',
})
