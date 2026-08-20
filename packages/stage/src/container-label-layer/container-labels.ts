import {
  getComposeFrame,
  getComposeHierarchy,
  getComposeLock,
  getComposeVisibility,
  isComposeGroupEntity,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
  type ComposeSize,
} from '@compose-ui/core'
import { getEntityWorldBounds, worldToScreen, type StageViewport } from '@compose-ui/stage-engine'

/**
 * 一个顶层容器在屏幕空间的标题标签几何。
 *
 * @remarks
 * 坐标已经是屏幕像素，标签本身不参与视口缩放：字号恒定是这个标签存在的意义——缩到很小时
 * 它仍然是唯一能读出「这是哪个容器」的东西。
 * @internal
 */
export interface ComposeContainerLabel {
  readonly entityId: string
  readonly name: string
  /** 标签左边缘的屏幕 x，与容器左边缘对齐。 */
  readonly x: number
  /** 标签基线所在行的屏幕 y，即容器上边缘之上一行。 */
  readonly y: number
  /** 标签最大宽度；超出部分由渲染层省略。 */
  readonly maxWidth: number
  /** 容器是否锁定；锁定容器的标签只显示名字，不再是选中或重命名入口。 */
  readonly locked: boolean
  /**
   * 该容器是不是一个场景（根 Frame）。
   *
   * @remarks
   * 只有场景标签承载播放与激活标记；普通容器标签保持原样，以免给每个容器都挂上两个按钮。
   */
  readonly scene: boolean
  /**
   * 场景的创作尺寸；不是 Frame 时为 `null`。
   *
   * @remarks
   * 取自 `Frame.size` 而不是求解出的 AABB：`Frame.size` 是尺寸的唯一事实来源，AABB 在
   * 场景被旋转时会变大，标签上就会显示一个用户从没输入过的数字。
   */
  readonly size: ComposeSize | null
}

/**
 * 低于该 zoom 时标签不再渲染。
 *
 * @remarks
 * 缩得很远时画布上会同时出现几十个容器，标签比容器本身还大，反而盖住了要看的整体结构。
 */
const MIN_LABEL_ZOOM = 0.15

/** 标签行与容器上边缘之间的屏幕间距。 */
const LABEL_GAP = 4

/** 标签行高，用于把标签放到容器上方而不是压在边框上。 */
const LABEL_LINE_HEIGHT = 14

/**
 * 计算需要渲染标题标签的顶层容器。
 *
 * @remarks
 * 只取 `rootIds` 的直接成员——v7 下即各块场景。场景内的容器已经是嵌套层，与 Figma/Rive
 * 一致不带标签，否则一个多层结构会在左上角堆出多行互相遮挡的文字。可见性、宿主隐藏集与
 * 低缩放阈值都在这里一次筛掉，渲染层只负责摆放。
 * @internal
 */
export function resolveComposeContainerLabels(
  document: ComposeDocument,
  layoutSnapshot: ComposeLayoutSnapshot,
  viewport: StageViewport,
  hiddenEntityIds?: ReadonlySet<string>,
): readonly ComposeContainerLabel[] {
  if (viewport.zoom < MIN_LABEL_ZOOM) return []
  const labels: ComposeContainerLabel[] = []
  for (const entityId of document.rootIds) {
    const entity = document.entities[entityId]
    if (!entity) continue
    if (!getComposeHierarchy(entity)) continue
    // Group 是结构包装而不是容器，标签只属于真正框住一片区域的容器。
    if (isComposeGroupEntity(entity)) continue
    if (!getComposeVisibility(entity).visible) continue
    if (hiddenEntityIds?.has(entityId)) continue
    const bounds = getEntityWorldBounds(document, layoutSnapshot, entityId)
    const topLeft = worldToScreen({ x: bounds.x, y: bounds.y }, viewport)
    labels.push({
      entityId,
      name: entity.name,
      x: topLeft.x,
      y: topLeft.y - LABEL_GAP - LABEL_LINE_HEIGHT,
      // 旋转容器用的是 AABB 宽度，标签因此可能比容器视觉边略宽；这比让标签跟着旋转更可读。
      maxWidth: Math.max(bounds.width * viewport.zoom, LABEL_LINE_HEIGHT),
      locked: getComposeLock(entity).locked,
      // 迭代范围就是 rootIds：v7 下这些直接成员全部是场景。
      scene: true,
      size: getComposeFrame(entity)?.size ?? null,
    })
  }
  return labels
}
