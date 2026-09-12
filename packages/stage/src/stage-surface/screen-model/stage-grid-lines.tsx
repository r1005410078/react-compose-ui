/**
 * 网格容器的格线：列带与行线。
 *
 * @remarks
 * 画在 **Scene 之下**而不是覆盖层里：它是底纹不是标注，压在卡片上会让每张卡上横着几条线。
 * 与场景边界描边同属世界底图那一层。
 *
 * 格线的几何与 Layout Runtime 的预解算必须出自**同一个换算入口**（`resolveStageGridContext`
 * 加 `projectComposeGridCell`），否则同一个格坐标会在格线与卡片上差开一段，而这种偏差只在
 * 特定列数与容器宽度下出现、极难复现。
 * @packageDocumentation
 */

import {
  composeGridColumnWidth,
  composeGridContentHeight,
  getComposeGridItem,
  getComposeHierarchy,
} from '@compose-ui/core'
import {
  resolveStageGridContext,
  worldToScreen,
  type StageSceneIndex,
  type StageViewport,
} from '@compose-ui/stage-engine'

/** 一块网格容器要画的格线，全部是屏幕坐标。 @public */
export interface StageGridLines {
  readonly containerId: string
  /** 每一列的色带。 */
  readonly columns: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[]
  /** 行与行之间的分隔线。 */
  readonly rows: readonly { readonly x1: number; readonly x2: number; readonly y: number }[]
}

/**
 * 至少画这么多行。
 *
 * @remarks
 * 网格向下是无限的，但一块空板子上画零条线等于没画。取 4 是「一屏能看见的最少几行」，
 * 与卡片行数取大者——用户往下拖时格线要先于卡片到达那里，否则落点处没有任何参照。
 */
const MIN_VISIBLE_ROWS = 4

/**
 * 解出一块网格容器的格线屏幕几何。
 *
 * @returns 不是网格容器、还没有布局结果或列宽为零时为 `null`。
 * @public
 */
export function resolveStageGridLines(
  index: StageSceneIndex,
  containerId: string,
  viewport: StageViewport,
): StageGridLines | null {
  const context = resolveStageGridContext(index, containerId)
  const containerWorld = index.getWorldBounds(containerId)
  if (!context || !containerWorld) return null
  const columnWidth = composeGridColumnWidth(context.metrics)
  if (columnWidth <= 0) return null

  const container = index.document.entities[containerId]
  const hierarchy = container ? getComposeHierarchy(container) : null
  const cells = (hierarchy?.childIds ?? []).flatMap((childId) => {
    const item = getComposeGridItem(index.document.entities[childId])
    return item ? [{ id: childId, x: item.x, y: item.y, w: item.w, h: item.h }] : []
  })
  const contentHeight = composeGridContentHeight(cells, context.metrics)
  const rowStep = context.metrics.rowHeight + context.metrics.rowGap
  const rows = Math.max(
    MIN_VISIBLE_ROWS,
    rowStep > 0 ? Math.ceil((contentHeight + context.metrics.rowGap) / rowStep) : 0,
  )
  const height = rows * rowStep - context.metrics.rowGap

  const originWorld = {
    x: containerWorld.x + context.contentOrigin.x,
    y: containerWorld.y + context.contentOrigin.y,
  }
  const origin = worldToScreen(originWorld, viewport)
  const zoom = viewport.zoom
  const columnStep = columnWidth + context.metrics.columnGap

  return {
    containerId,
    columns: Array.from({ length: context.metrics.columns }, (_unused, column) => ({
      x: origin.x + column * columnStep * zoom,
      y: origin.y,
      width: columnWidth * zoom,
      height: height * zoom,
    })),
    // 行线画在每一行的**顶边**，第 0 行那条与内容盒顶边重合因此跳过——它与容器内边距重叠，
    // 画出来是一条贴着边的重线。
    rows: Array.from({ length: Math.max(0, rows - 1) }, (_unused, row) => ({
      x1: origin.x,
      x2: origin.x + (context.metrics.columns * columnStep - context.metrics.columnGap) * zoom,
      y: origin.y + (row + 1) * rowStep * zoom,
    })),
  }
}

/** 渲染一组网格容器的格线。 @public */
export function StageGridLinesLayer({ lines }: { readonly lines: readonly StageGridLines[] }) {
  return (
    <>
      {lines.map((grid) => (
        <g
          data-testid={`stage-grid-lines-${grid.containerId}`}
          key={grid.containerId}
          style={{ pointerEvents: 'none' }}
        >
          {grid.columns.map((band, column) => (
            <rect
              className="compose-stage__grid-column"
              height={band.height}
              key={column}
              width={band.width}
              x={band.x}
              y={band.y}
            />
          ))}
          {grid.rows.map((line, row) => (
            <line
              className="compose-stage__grid-row"
              key={row}
              x1={line.x1}
              x2={line.x2}
              y1={line.y}
              y2={line.y}
            />
          ))}
        </g>
      ))}
    </>
  )
}
