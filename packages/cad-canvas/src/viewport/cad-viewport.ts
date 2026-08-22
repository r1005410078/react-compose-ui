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

/** 取景时四周留出的边距比例；一点留白让内容不贴着标尺。 */
const FIT_PADDING = 0.08

/**
 * 求把一块世界矩形取到图面上的视口。
 *
 * @remarks
 * 纯函数，与页面画布的取景是同一种「会话级取景」——它不写进文档。缩放取两轴中较小的那个，
 * 因此内容整体可见而不是某一轴被裁掉。
 *
 * 内容跨度为零（例如只有一个点）时保持当前缩放，只把它移到图面中心：按跨度算缩放会得到
 * 无穷大。
 *
 * @param bounds - 要取景的世界矩形。
 * @param size - 图面尺寸（CSS 像素）。
 * @param current - 当前视口；跨度为零时沿用它的缩放。
 * @returns 新视口；图面尺寸还没量到时返回 `null`。
 * @public
 */
export function cadFitViewport(
  bounds: { readonly minX: number, readonly minY: number, readonly maxX: number, readonly maxY: number },
  size: { readonly width: number, readonly height: number },
  current: CadViewport,
): CadViewport | null {
  if (!(size.width > 0) || !(size.height > 0)) return null
  const spanX = bounds.maxX - bounds.minX
  const spanY = bounds.maxY - bounds.minY
  const usableWidth = size.width * (1 - FIT_PADDING * 2)
  const usableHeight = size.height * (1 - FIT_PADDING * 2)
  const zoom = spanX > 0 || spanY > 0
    ? Math.min(
      CAD_ZOOM_RANGE.max,
      Math.max(
        CAD_ZOOM_RANGE.min,
        Math.min(
          spanX > 0 ? usableWidth / spanX : Number.POSITIVE_INFINITY,
          spanY > 0 ? usableHeight / spanY : Number.POSITIVE_INFINITY,
        ),
      ),
    )
    : current.zoom
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  return {
    zoom,
    offset: {
      x: size.width / 2 - centerX * zoom,
      y: size.height / 2 - centerY * zoom,
    },
  }
}
