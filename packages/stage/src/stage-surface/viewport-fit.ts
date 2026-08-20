import type { StageRect, StageViewport } from '@compose-ui/stage-engine'

/**
 * 适配后允许的缩放区间。
 *
 * @remarks
 * 与 Stage 其他缩放入口共用同一组上下限：适配是"换一个视口"，不是"换一套缩放规则"。
 */
const MIN_FIT_ZOOM = 0.1
const MAX_FIT_ZOOM = 8

/**
 * 适配后目标矩形占据可视区域的比例。
 *
 * @remarks
 * 留出 15% 是为了让场景标题标签、变换手柄和吸附参考线有落脚处——正好贴满边缘时，
 * 标签会被挤出可视区，用户反而看不出适配到了哪一块。
 */
const FIT_PADDING_RATIO = 0.85

/** 可视区域尺寸；标尺与滚动条不计入。 @internal */
export interface StageSurfaceSize {
  readonly width: number
  readonly height: number
}

/**
 * 计算把目标世界矩形整体放进可视区域并居中的视口。
 *
 * @remarks
 * 纯几何：键盘的「适配选择/适配容器」、场景尺寸提交后的适配与首次进入的激活场景适配
 * 共用同一实现，否则三条路径会各自漂移出不同的留白和缩放钳制。
 *
 * @param target - 目标世界矩形；`null` 或宽高非正表示没有可适配的东西。
 * @param surface - 当前可视区域尺寸。
 * @returns 适配后的视口；目标无效或可视区域尚未测量时返回 `null`，调用方据此不发出视口变化。
 * @internal
 */
export function fitViewportToRect(
  target: StageRect | null,
  surface: StageSurfaceSize,
): StageViewport | null {
  if (!target || target.width <= 0 || target.height <= 0) return null
  if (surface.width <= 0 || surface.height <= 0) return null
  const zoom = Math.min(
    MAX_FIT_ZOOM,
    Math.max(
      MIN_FIT_ZOOM,
      Math.min(surface.width / target.width, surface.height / target.height) * FIT_PADDING_RATIO,
    ),
  )
  return {
    zoom,
    x: (surface.width - target.width * zoom) / 2 - target.x * zoom,
    y: (surface.height - target.height * zoom) / 2 - target.y * zoom,
  }
}
