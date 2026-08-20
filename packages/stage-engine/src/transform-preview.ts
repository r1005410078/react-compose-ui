import {
  getComposeLayoutItem,
  getComposeTransform,
  resolveComposeGeometryConstraints,
} from '@compose-ui/core'
import {
  applyMatrix,
  decomposeMatrix,
  invertMatrix,
  multiplyMatrices,
  type ResizeHandle,
  type StageMatrix,
  type StageRect,
  type StageTransform,
} from './geometry'
import type { StageSceneIndex } from './scene-index'

/*
 * 变换预览的几何计算：把一次手势的世界变换换算成每个目标 Entity 的局部盒。
 *
 * 与 `transform-planning.ts` 的分工——这里算「手势进行中长什么样」，那里算「松手要提交
 * 什么命令」。两者都是纯函数，都不碰会话与快照。
 */

export function matrixBounds(matrix: StageMatrix, width: number, height: number): StageRect {
  const points = [
    applyMatrix(matrix, { x: 0, y: 0 }),
    applyMatrix(matrix, { x: width, y: 0 }),
    applyMatrix(matrix, { x: width, y: height }),
    applyMatrix(matrix, { x: 0, y: height }),
  ]
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  }
}
/** 手势必须冻结 pointerdown 对应 Snapshot 的已求解 box，不能回读 LayoutItem fallback。 */
export function resolvedSpatialTransform(index: StageSceneIndex, entityId: string): StageTransform | null {
  const entity = index.document.entities[entityId]
  const box = index.layoutSnapshot.boxes[entityId]
  if (!entity || !box) return null
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: getComposeTransform(entity).rotation,
  }
}
export function targetTransform(
  index: StageSceneIndex,
  entityId: string,
  targetWorld: StageMatrix,
  width: number,
  height: number,
) {
  const parentId = index.getParentId(entityId)
  const parentWorld = parentId ? index.getWorldMatrix(parentId) : null
  const local = parentWorld
    ? multiplyMatrices(invertMatrix(parentWorld), targetWorld)
    : targetWorld
  return decomposeMatrix(local, width, height)
}
export function transformedSelection(
  index: StageSceneIndex,
  ids: readonly string[],
  worldTransform: StageMatrix,
  resize?: { readonly scaleX: number; readonly scaleY: number },
  keepsHugHeight?: (entityId: string) => boolean,
  handle?: ResizeHandle,
) {
  const updates: Record<string, StageTransform> = {}
  ids.forEach((id) => {
    const entity = index.document.entities[id]
    const entityWorld = index.getWorldMatrix(id)
    if (!entity || !entityWorld) return
    const transform = resolvedSpatialTransform(index, id)
    if (!transform) return
    const candidate = targetTransform(
      index,
      id,
      multiplyMatrices(worldTransform, entityWorld),
      transform.width * (resize?.scaleX ?? 1),
      transform.height * (resize?.scaleY ?? 1),
    )
    if (!resize) {
      updates[id] = candidate
      return
    }
    const constraints = resolveComposeGeometryConstraints(entity)
    const layoutItem = getComposeLayoutItem(entity)
    const minimum = {
      width: layoutItem.width.min ?? 0,
      height: layoutItem.height.min ?? 0,
    }
    const maximum = {
      width: layoutItem.width.max ?? undefined,
      height: layoutItem.height.max ?? undefined,
    }
    const clamp = (value: number, minimum: number, max: number | undefined) =>
      Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(minimum, value))
    if (constraints.resize === 'preserve-aspect') {
      const widthScale = candidate.width / transform.width
      const heightScale = candidate.height / transform.height
      let scale = Math.abs(widthScale - 1) >= Math.abs(heightScale - 1)
        ? widthScale
        : heightScale
      const minScale = Math.max(
        minimum.width / transform.width,
        minimum.height / transform.height,
      )
      const maxScale = maximum.width !== undefined || maximum.height !== undefined
        ? Math.min(
            (maximum.width ?? Number.POSITIVE_INFINITY) / transform.width,
            (maximum.height ?? Number.POSITIVE_INFINITY) / transform.height,
          )
        : Number.POSITIVE_INFINITY
      scale = Math.min(maxScale, Math.max(minScale, scale))
      updates[id] = {
        ...candidate,
        width: transform.width * scale,
        height: transform.height * scale,
      }
      return
    }
    // 内容随宽度重排的 Entity（文字换行）默认保留 Hug 高度：拖窄后重新换行会长高，若把
    // 高度一并写死，长出来的部分会被自己的框裁掉。以下两种意图明确要固定高度时放开：
    // 1. 顶部/底部纯高度手柄（n/s）——与 Figma Auto Height 拖高度手柄一致；
    // 2. 角手柄把框往外拉高（candidate 高于当前解析高度）——选区只显示四角时，用户只能靠
    //    角点加高，必须让拖高生效；收窄/压矮仍走 Hug，避免裁切。
    //
    // 保留 Hug 时必须回 authored 的 `layoutItem.height.value` 而不是解析出的
    // `transform.height`：文档层按 authored 值判断「高度变没变」，而 Hug 实体的 authored
    // 值只是回退尺寸，与测量出的实际高度并不相等——回解析值会被判成「改了高度」，照样钉成 Fixed。
    const draggingHeightOnlyHandle = handle === 'n' || handle === 's'
    // 略大于亚像素抖动，避免角点几乎水平拖时误钉高度。
    const expandingHeight = candidate.height > transform.height + 0.5
    const preserveHugHeight =
      layoutItem.height.mode === 'hug' &&
      keepsHugHeight?.(id) === true &&
      !draggingHeightOnlyHandle &&
      !expandingHeight
    updates[id] = {
      ...candidate,
      width: constraints.resize === 'vertical'
        ? transform.width
        : clamp(candidate.width, minimum.width, maximum.width),
      height: preserveHugHeight
        ? layoutItem.height.value
        : constraints.resize === 'horizontal'
          ? transform.height
          : clamp(candidate.height, minimum.height, maximum.height),
    }
  })
  return updates
}
export function transformedResizeSelection(
  index: StageSceneIndex,
  ids: readonly string[],
  worldTransform: StageMatrix,
  resize: { readonly scaleX: number; readonly scaleY: number },
  keepsHugHeight?: (entityId: string) => boolean,
  handle?: ResizeHandle,
) {
  return transformedSelection(
    index,
    index.topLevelSelection(ids),
    worldTransform,
    resize,
    keepsHugHeight,
    handle,
  )
}
