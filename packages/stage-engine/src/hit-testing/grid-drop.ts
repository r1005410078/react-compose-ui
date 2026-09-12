/**
 * 网格容器的落点解算。
 *
 * @remarks
 * 与 Flow 重排是姐妹判定：那边回答「插到第几个」，这边回答「落在哪一格」。两者都是纯函数，
 * 只读索引与文档。
 *
 * 格与像素之间的换算一律走 core 的 `projectComposeGridCell` / `composeGridCellAtPoint`，
 * 本模块只负责把 Stage 的世界坐标换算成容器**内容盒**局部坐标——各自算一遍列宽的症状是
 * 「画出来的格线与卡片落的位置对不上」。
 * @packageDocumentation
 */

import {
  composeGridCellAtPoint,
  getComposeGridItem,
  getComposeHierarchy,
  getComposeLayout,
  isComposeGridLayout,
  projectComposeGridCell,
  resolveComposeAppearance,
  solveComposeGrid,
  type ComposeEntity,
  type ComposeGridCell,
  type ComposeGridLayout,
  type ComposeGridMetrics,
} from '@compose-ui/core'
import { applyMatrix, invertMatrix, type StagePoint, type StageRect } from '../geometry'
import type { StageSceneIndex } from './scene-index'

/** 网格容器在 Stage 上的度量与坐标原点。 @public */
export interface StageGridContext {
  readonly container: ComposeEntity
  readonly layout: ComposeGridLayout
  readonly metrics: ComposeGridMetrics
  /**
   * 内容盒左上角在容器**盒局部**坐标里的位置。
   *
   * @remarks
   * 等于边框宽加内边距。Yoga 的绝对定位子级以内边距盒为原点，因此这里与 Layout Runtime 的
   * `applyGridLayouts` 必须用同一套换算，否则拖动落点会整体偏掉一个内边距。
   */
  readonly contentOrigin: StagePoint
}

/**
 * 读出一个 Entity 作为网格容器的上下文。
 *
 * @returns 不是网格容器、缺 Hierarchy 或还没有布局结果时为 `null`。
 * @public
 */
export function resolveStageGridContext(
  index: StageSceneIndex,
  containerId: string,
): StageGridContext | null {
  const container = index.document.entities[containerId]
  if (!container) return null
  const layout = getComposeLayout(container)
  if (!isComposeGridLayout(layout)) return null
  if (!getComposeHierarchy(container)) return null
  const box = index.layoutSnapshot.boxes[containerId]
  if (!box) return null
  const border = resolveComposeAppearance(container).borderWidth
  const contentWidth = Math.max(
    0,
    box.width - border * 2 - layout.padding.left - layout.padding.right,
  )
  return {
    container,
    layout,
    metrics: {
      columns: layout.columns,
      rowHeight: layout.rowHeight,
      rowGap: layout.rowGap,
      columnGap: layout.columnGap,
      contentWidth,
    },
    contentOrigin: {
      x: border + layout.padding.left,
      y: border + layout.padding.top,
    },
  }
}

/** 把世界坐标换算成网格内容盒的局部坐标。 @public */
export function worldToStageGridContent(
  index: StageSceneIndex,
  containerId: string,
  context: StageGridContext,
  worldPoint: StagePoint,
): StagePoint | null {
  const matrix = index.getWorldMatrix(containerId)
  if (!matrix) return null
  const local = applyMatrix(invertMatrix(matrix), worldPoint)
  return {
    x: local.x - context.contentOrigin.x,
    y: local.y - context.contentOrigin.y,
  }
}

/**
 * 解算一次网格落点。
 *
 * @remarks
 * 落点取**被拖盒的左上角**所在的格，而不是指针所在的格：用户抓住卡片中间拖时，指针与卡片
 * 左上角差着一个抓取偏移，按指针算会让卡片整体偏移那么多格。没有盒可用时（例如从物料面板
 * 拖入，此刻还没有几何）退回指针。
 *
 * 列钳制到 `[0, columns - w]`——允许越界会产出一个永远解算不出来的坐标。
 *
 * @public
 */
export function resolveStageGridCell(input: {
  readonly index: StageSceneIndex
  readonly containerId: string
  readonly context: StageGridContext
  readonly worldPoint: StagePoint
  readonly draggedBounds?: StageRect
  /** 被拖对象的列跨度，用于钳制落点；省略时按 1 格。 */
  readonly span?: number
}): { readonly x: number; readonly y: number } | null {
  const { index, containerId, context, worldPoint, draggedBounds, span = 1 } = input
  const anchor = draggedBounds
    ? { x: draggedBounds.x, y: draggedBounds.y }
    : worldPoint
  const local = worldToStageGridContent(index, containerId, context, anchor)
  if (!local) return null
  const cell = composeGridCellAtPoint(local, context.metrics)
  const columns = context.layout.columns
  const width = Math.min(Math.max(1, span), columns)
  return {
    x: Math.min(Math.max(0, cell.x), Math.max(0, columns - width)),
    y: cell.y,
  }
}

/**
 * 收集容器里参与网格求解的格矩形。
 *
 * @remarks
 * `override` 用于预览与提交：把被拖的那一个换成它的新格坐标，其余原样，再交给同一个求解器。
 * **推挤结果必须来自 core 的那一个求解器**，本包不另算一遍——各算一遍的症状是「拖动时看到
 * 的让位与松手后的结果不一样」，而那种偏差只在特定布局下出现。
 *
 * @public
 */
export function collectStageGridCells(
  index: StageSceneIndex,
  containerId: string,
  override?: ComposeGridCell,
): readonly ComposeGridCell[] {
  const container = index.document.entities[containerId]
  const hierarchy = container ? getComposeHierarchy(container) : null
  if (!hierarchy) return []
  const cells: ComposeGridCell[] = []
  hierarchy.childIds.forEach((childId) => {
    if (override && childId === override.id) {
      cells.push(override)
      return
    }
    const item = getComposeGridItem(index.document.entities[childId])
    if (item) cells.push({ id: childId, x: item.x, y: item.y, w: item.w, h: item.h })
  })
  // 被拖的对象可能还不是这个容器的子级（跨容器拖入），此时同样要参与求解。
  if (override && !hierarchy.childIds.includes(override.id)) cells.push(override)
  return cells
}

/** 用统一的求解器解出容器在某个覆盖之下的最终格局。 @public */
export function solveStageGrid(
  index: StageSceneIndex,
  containerId: string,
  context: StageGridContext,
  override?: ComposeGridCell,
): readonly ComposeGridCell[] {
  return solveComposeGrid(collectStageGridCells(index, containerId, override), {
    columns: context.layout.columns,
    float: context.layout.float,
    anchorId: override?.id,
  })
}

/**
 * 把一个格矩形换算成世界矩形。
 *
 * @remarks
 * 占位影子与网格缩放的吸附后包围盒读的是**同一个**换算：各算一遍的症状是「影子画在这儿、
 * 松手却落在那儿」，而那种偏差只在特定列宽下现形。
 *
 * @public
 */
export function projectStageGridCellToWorld(
  index: StageSceneIndex,
  containerId: string,
  context: StageGridContext,
  cell: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
): StageRect | null {
  const matrix = index.getWorldMatrix(containerId)
  if (!matrix) return null
  const rect = projectComposeGridCell(cell, context.metrics)
  const topLeft = applyMatrix(matrix, {
    x: context.contentOrigin.x + rect.x,
    y: context.contentOrigin.y + rect.y,
  })
  const bottomRight = applyMatrix(matrix, {
    x: context.contentOrigin.x + rect.x + rect.width,
    y: context.contentOrigin.y + rect.y + rect.height,
  })
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  }
}
