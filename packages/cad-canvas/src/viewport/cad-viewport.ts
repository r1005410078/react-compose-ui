/**
 * CAD 画布视口。
 *
 * @remarks
 * `offset` 是**世界原点在屏幕上的位置**（CSS 像素），`zoom` 是每世界单位对应的屏幕像素数。
 * 记成这个方向而不是「视口左上角的世界坐标」，是因为缩放要绕光标进行：绕点缩放只需要保持
 * 该点的屏幕坐标不变，用前者是一步代数，用后者要先反解视口原点。
 *
 * @public
 */
export interface CadViewport {
  readonly offset: { readonly x: number; readonly y: number }
  readonly zoom: number
}

/** 一个点。 @public */
export interface CadCanvasPoint {
  readonly x: number
  readonly y: number
}

/** 缩放下限与上限；超出这个范围的图面在屏幕上不再可读。 @public */
export const CAD_ZOOM_RANGE = { min: 0.02, max: 256 } as const

/** 初始视口：世界原点落在画布左上角，1 世界单位 = 1 像素。 @public */
export const CAD_INITIAL_VIEWPORT: CadViewport = { offset: { x: 0, y: 0 }, zoom: 1 }

/** 世界坐标 → 屏幕坐标。 @public */
export function cadWorldToScreen(viewport: CadViewport, point: CadCanvasPoint): CadCanvasPoint {
  return {
    x: point.x * viewport.zoom + viewport.offset.x,
    y: point.y * viewport.zoom + viewport.offset.y,
  }
}

/** 屏幕坐标 → 世界坐标。 @public */
export function cadScreenToWorld(viewport: CadViewport, point: CadCanvasPoint): CadCanvasPoint {
  return {
    x: (point.x - viewport.offset.x) / viewport.zoom,
    y: (point.y - viewport.offset.y) / viewport.zoom,
  }
}

/** 按屏幕位移平移视口。 @public */
export function cadPanViewport(viewport: CadViewport, delta: CadCanvasPoint): CadViewport {
  return {
    ...viewport,
    offset: { x: viewport.offset.x + delta.x, y: viewport.offset.y + delta.y },
  }
}

/**
 * 绕一个屏幕锚点缩放。
 *
 * @param viewport - 当前视口。
 * @param factor - 缩放倍率；结果被钳制在 {@link CAD_ZOOM_RANGE} 内。
 * @param anchor - 缩放过程中屏幕坐标保持不变的点，通常是光标位置。
 * @returns 新视口；倍率被钳制时锚点仍然精确不动。
 * @public
 */
export function cadZoomViewport(
  viewport: CadViewport,
  factor: number,
  anchor: CadCanvasPoint,
): CadViewport {
  const zoom = Math.min(CAD_ZOOM_RANGE.max, Math.max(CAD_ZOOM_RANGE.min, viewport.zoom * factor))
  // 先按旧视口解出锚点的世界坐标，再让新 zoom 下的它落回同一个屏幕位置。钳制之后仍然成立，
  // 因为这里用的是**钳制后**的 zoom 反算 offset，而不是假设倍率一定被完整应用。
  const world = cadScreenToWorld(viewport, anchor)
  return {
    zoom,
    offset: { x: anchor.x - world.x * zoom, y: anchor.y - world.y * zoom },
  }
}
