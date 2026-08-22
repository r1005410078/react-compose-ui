import {
  composeCanvasPan,
  composeCanvasScreenToWorld,
  composeCanvasWorldToScreen,
  composeCanvasZoomAt,
  type ComposeCanvasPoint,
  type ComposeCanvasViewport,
} from '@compose-ui/core'

/**
 * CAD 画布视口。
 *
 * @remarks
 * 与页面画布共用 `core` 的视口模型：世界↔屏幕换算、平移与绕锚点缩放都是同一份代数，两个
 * 画布只在缩放区间上不同——页面画布有确定尺寸，无限图纸既要看总图也要看一个端子。
 *
 * @public
 */
export type CadViewport = ComposeCanvasViewport

/** 一个点。 @public */
export type CadCanvasPoint = ComposeCanvasPoint

/** 缩放下限与上限；超出这个范围的图面在屏幕上不再可读。 @public */
export const CAD_ZOOM_RANGE = { min: 0.02, max: 256 } as const

/** 初始视口：世界原点落在画布左上角，1 世界单位 = 1 像素。 @public */
export const CAD_INITIAL_VIEWPORT: CadViewport = { offset: { x: 0, y: 0 }, zoom: 1 }

/** 世界坐标 → 屏幕坐标。 @public */
export const cadWorldToScreen = composeCanvasWorldToScreen

/** 屏幕坐标 → 世界坐标。 @public */
export const cadScreenToWorld = composeCanvasScreenToWorld

/** 按屏幕位移平移视口。 @public */
export const cadPanViewport = composeCanvasPan

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
  return composeCanvasZoomAt(viewport, anchor, viewport.zoom * factor, CAD_ZOOM_RANGE)
}
