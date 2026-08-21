import { zoomViewportAt, type StageRect, type StageViewport } from '@compose-ui/stage-engine'

/** 适配后目标四周留出的余量比例；1 表示恰好铺满，取 0.85 让内容不贴边。 */
const FIT_VIEWPORT_MARGIN = 0.85
/** 适配缩放的下限与上限；与手势缩放共用同一段区间。 */
const MIN_FIT_ZOOM = 0.1
const MAX_FIT_ZOOM = 8
/** 一次「放大 / 缩小」的倍率。 */
export const STAGE_ZOOM_STEP = 1.2

/** 视口尺寸；只关心宽高，不关心 surface 在页面上的位置。 */
export interface StageSurfaceSize {
  readonly width: number
  readonly height: number
}

/**
 * 把目标矩形适配进 surface：等比缩放到刚好放下，并居中。
 *
 * @remarks
 * 键盘的「适配选择 / 适配容器」与右键菜单的「适配选择」调用的是同一份实现。这段求解此前
 * 在两处各写了一遍，连同三个魔法数——分叉只是时间问题。
 *
 * @returns 目标缺失或宽高非正时返回 null，表示不该改变视口。
 */
export function fitViewportTo(
  target: StageRect | null,
  surface: StageSurfaceSize,
): StageViewport | null {
  if (!target || target.width <= 0 || target.height <= 0) return null
  const zoom = Math.min(
    MAX_FIT_ZOOM,
    Math.max(
      MIN_FIT_ZOOM,
      Math.min(surface.width / target.width, surface.height / target.height)
      * FIT_VIEWPORT_MARGIN,
    ),
  )
  return {
    zoom,
    x: (surface.width - target.width * zoom) / 2 - target.x * zoom,
    y: (surface.height - target.height * zoom) / 2 - target.y * zoom,
  }
}

/** 一次离散缩放动作；`reset` 是回到 100% 而不是回到初始视口。 */
export type StageZoomIntent = 'in' | 'out' | 'reset'

/**
 * 以 surface 中心为锚点做一次离散缩放。
 *
 * @remarks
 * 锚点固定在中心而不是指针位置：键盘与菜单都没有可信的指针坐标，指针锚点缩放由滚轮承担。
 *
 * 接收意图而不是倍率，是为了让「放大乘、缩小除」写在同一处。若改成传倍率，缩小侧就得由
 * 调用方传 `1 / 步长`，浮点结果与除法并不逐位相同。
 */
export function zoomViewportByIntent(
  viewport: StageViewport,
  surface: StageSurfaceSize,
  intent: StageZoomIntent,
): StageViewport {
  const zoom = intent === 'reset'
    ? 1
    : intent === 'in' ? viewport.zoom * STAGE_ZOOM_STEP : viewport.zoom / STAGE_ZOOM_STEP
  return zoomViewportAt(viewport, { x: surface.width / 2, y: surface.height / 2 }, zoom)
}
