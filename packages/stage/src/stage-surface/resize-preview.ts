import { getComposeLayoutItem, type ComposeDocument } from '@compose-ui/core'

/**
 * 为 resize 手势构造实时布局求解用的瞬态文档。
 *
 * @remarks
 * 输入是已应用 previewTransforms 的预览文档（几何已写入 LayoutItem 的 offset 与轴 value）。
 * 这里把被拖动 Flow 目标的两轴强制为 `fixed`：活动轴按规范「Fill resize preview 视为
 * Fixed」，非活动轴的 value 即求解尺寸、改写后视觉不变；Hug 轴若保持 hug 会在求解中
 * 触发重新测量并覆盖拖动尺寸。Absolute 目标不参与兄弟排布，previewTransforms 的视觉
 * 覆盖已足够，不需要进入求解。
 *
 * @returns 求解用文档；没有 Flow 目标参与时返回 null，表示无需实时求解。
 * @internal
 */
export function buildResizePreviewSolveDocument(
  previewDocument: ComposeDocument,
  previewedIds: readonly string[],
): ComposeDocument | null {
  let hasFlowTarget = false
  const entities = { ...previewDocument.entities }
  for (const entityId of previewedIds) {
    const entity = entities[entityId]
    if (!entity) continue
    const item = getComposeLayoutItem(entity)
    if (item.positioning !== 'flow') continue
    hasFlowTarget = true
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
  return hasFlowTarget ? { ...previewDocument, entities } : null
}
