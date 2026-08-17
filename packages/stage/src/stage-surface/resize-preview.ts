import {
  getComposeHierarchy,
  getComposeLayout,
  getComposeLayoutItem,
  type ComposeDocument,
} from '@compose-ui/core'

/**
 * 为 resize 手势构造实时布局求解用的瞬态文档。
 *
 * @remarks
 * 输入是已应用 previewTransforms 的预览文档（几何已写入 LayoutItem 的 offset 与轴 value）。
 * 两类目标需要实时求解：Flow 子级（尺寸变化推挤兄弟）与带子级的 Auto Layout 容器
 * （尺寸变化改变子级排布——fill 伸缩、wrap 换行）。两类目标的两轴都强制为 `fixed`：
 * 活动轴按规范「Fill resize preview 视为 Fixed」，非活动轴的 value 即求解尺寸、改写后
 * 视觉不变；Hug 轴若保持 hug 会在求解中触发重新测量并覆盖拖动尺寸。其余 Absolute 目标
 * 不影响任何排布，previewTransforms 的视觉覆盖已足够，不需要进入求解。
 *
 * @returns 求解用文档；没有影响排布的目标时返回 null，表示无需实时求解。
 * @internal
 */
export function buildResizePreviewSolveDocument(
  previewDocument: ComposeDocument,
  previewedIds: readonly string[],
): ComposeDocument | null {
  let hasReflowTarget = false
  const entities = { ...previewDocument.entities }
  for (const entityId of previewedIds) {
    const entity = entities[entityId]
    if (!entity) continue
    const item = getComposeLayoutItem(entity)
    const isFlowChild = item.positioning === 'flow'
    const isLayoutContainer = Boolean(getComposeLayout(entity))
      && (getComposeHierarchy(entity)?.childIds.length ?? 0) > 0
    if (!isFlowChild && !isLayoutContainer) continue
    hasReflowTarget = true
    entities[entityId] = {
      ...entity,
      components: {
        ...entity.components,
        LayoutItem: {
          ...item,
          width: { ...item.width, mode: 'fixed' },
          height: { ...item.height, mode: 'fixed' },
        },
      },
    }
  }
  return hasReflowTarget ? { ...previewDocument, entities } : null
}
