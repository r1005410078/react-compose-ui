import {
  getComposeLayoutItem,
  getComposeVisibility,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import {
  getEntityWorldBounds,
  unionRects,
} from '@compose-ui/stage-engine'
import type { StageTransform } from '@compose-ui/stage-engine'

/** 按 Entity 分组的预览变换。 */
export type StageTransformMap = Readonly<Record<string, StageTransform>>

export function transformDocument(
  document: ComposeDocument,
  transforms: StageTransformMap,
): ComposeDocument {
  if (Object.keys(transforms).length === 0) return document
  const entities = { ...document.entities }
  for (const [id, transform] of Object.entries(transforms)) {
    const entity = entities[id]
    if (!entity) continue
    const item = getComposeLayoutItem(entity)
    entities[id] = {
      ...entity,
      components: {
        ...entity.components,
        /*
         * 展开原有 `Transform` 而不是整个换掉：整换会把 `pivot` 一起抹掉，预览于是绕盒中心
         * 转、提交按基点转——症状是拖动中的姿态与松手后不一致，对象在提交那一刻跳一下，
         * 位移量恰好是 `2·|基点偏移|·sin(θ/2)`，且只在非中心基点的对象上出现。
         */
        Transform: { ...entity.components.Transform, rotation: transform.rotation },
        LayoutItem: {
          ...item,
          offset: { x: transform.x, y: transform.y },
          width: { ...item.width, value: transform.width },
          height: { ...item.height, value: transform.height },
        },
      },
    }
  }
  return { ...document, entities }
}

export function transformLayoutSnapshot(
  snapshot: ComposeLayoutSnapshot,
  transforms: StageTransformMap,
): ComposeLayoutSnapshot {
  if (Object.keys(transforms).length === 0) return snapshot
  const boxes = { ...snapshot.boxes }
  Object.entries(transforms).forEach(([entityId, transform]) => {
    const box = boxes[entityId]
    if (!box) return
    boxes[entityId] = {
      ...box,
      x: transform.x,
      y: transform.y,
      width: transform.width,
      height: transform.height,
    }
  })
  return { ...snapshot, boxes }
}

export function bootstrapSelectionBounds(
  document: ComposeDocument,
  layoutSnapshot: ComposeLayoutSnapshot,
  ids: readonly string[],
) {
  return unionRects(ids
    .filter((id) => {
      const entity = document.entities[id]
      return entity ? getComposeVisibility(entity).visible : false
    })
    .map((id) => getEntityWorldBounds(document, layoutSnapshot, id)))
}
