/**
 * 无限画布的视口。
 *
 * @remarks
 * `offset` 是**世界原点在屏幕上的位置**（CSS 像素），`zoom` 是每世界单位对应的屏幕像素数。
 * 记成这个方向而不是「视口左上角的世界坐标」，是因为缩放要绕光标进行：绕点缩放只需要保持
 * 该点的屏幕坐标不变，用前者是一步代数，用后者要先反解视口原点。
 *
 * 各画布可以保留自己的视口类型，只在调用这里时适配——本模块不要求任何包改自己的形状。
 *
 * @public
 */
export interface ComposeCanvasViewport {
  readonly offset: ComposeCanvasPoint
  readonly zoom: number
}

/** 画布上的一个点。 @public */
export interface ComposeCanvasPoint {
  readonly x: number
  readonly y: number
}

/** 缩放的合法区间。 @public */
export interface ComposeZoomRange {
  readonly min: number
  readonly max: number
}

/** 世界坐标 → 屏幕坐标。 @public */
export function composeCanvasWorldToScreen(
  viewport: ComposeCanvasViewport,
  point: ComposeCanvasPoint,
): ComposeCanvasPoint {
  return {
    x: point.x * viewport.zoom + viewport.offset.x,
    y: point.y * viewport.zoom + viewport.offset.y,
  }
}

/** 屏幕坐标 → 世界坐标。 @public */
export function composeCanvasScreenToWorld(
  viewport: ComposeCanvasViewport,
  point: ComposeCanvasPoint,
): ComposeCanvasPoint {
  return {
    x: (point.x - viewport.offset.x) / viewport.zoom,
    y: (point.y - viewport.offset.y) / viewport.zoom,
  }
}

/** 按屏幕位移平移视口。 @public */
export function composeCanvasPan(
  viewport: ComposeCanvasViewport,
  delta: ComposeCanvasPoint,
): ComposeCanvasViewport {
  return {
    ...viewport,
    offset: { x: viewport.offset.x + delta.x, y: viewport.offset.y + delta.y },
  }
}

/**
 * 绕一个屏幕锚点缩放。
 *
 * @remarks
 * 先按旧视口解出锚点的世界坐标，再让新 zoom 下的它落回同一个屏幕位置。**钳制之后仍然成立**，
 * 因为反算 offset 用的是钳制后的 zoom，而不是假设倍率一定被完整应用。
 *
 * 缩放范围由调用方给出而不写死：页面画布有确定尺寸，无限图纸既要看总图也要看一个端子，
 * 两者的合理区间不同。
 *
 * @param anchor - 缩放过程中屏幕坐标保持不变的点，通常是光标位置。
 * @public
 */
export function composeCanvasZoomAt(
  viewport: ComposeCanvasViewport,
  anchor: ComposeCanvasPoint,
  requestedZoom: number,
  range: ComposeZoomRange,
): ComposeCanvasViewport {
  const zoom = Math.min(range.max, Math.max(range.min, requestedZoom))
  const world = composeCanvasScreenToWorld(viewport, anchor)
  return {
    zoom,
    offset: { x: anchor.x - world.x * zoom, y: anchor.y - world.y * zoom },
  }
}
