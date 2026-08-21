import { worldToScreen } from '@compose-ui/stage-engine'
import { arrowHeadPath } from '../overlay-geometry'
import type { StageOverlayContext } from '../overlay-types'

/** 绘制预览层：拖拽中的图形轮廓与尺寸标注。 */
export function DrawingLayer({ drawing, viewport }: StageOverlayContext) {
  const drawingScreen = drawing
    ? {
        ...worldToScreen(drawing.bounds, viewport),
        width: drawing.bounds.width * viewport.zoom,
        height: drawing.bounds.height * viewport.zoom,
      }
    : null
  const drawingStart = drawing ? worldToScreen(drawing.start, viewport) : null
  const drawingEnd = drawing ? worldToScreen(drawing.end, viewport) : null
  // 文字只按点创建，预览框恒为按下点上的一个光标位大小。
  const drawingPreviewBounds = drawing?.tool === 'draw-text' && drawingScreen
    ? { ...drawingScreen, width: 28 * viewport.zoom, height: 16 * viewport.zoom }
    : drawingScreen
  // 文字不显示尺寸：它没有可拖出的尺寸，标注一个用户改不了的数字只会误导。
  const drawingDimensionLabel = drawing && drawingPreviewBounds && drawing.tool !== 'draw-text'
    ? drawing.tool === 'draw-line' || drawing.tool === 'draw-arrow'
      // 线条的真实几何来自两个端点，而不是落盘时为 LayoutItem 保留的最小 1px 尺寸。
      ? `${Math.round(Math.abs(drawing.end.x - drawing.start.x))} × ${Math.round(Math.abs(drawing.end.y - drawing.start.y))}`
      : `${Math.round(drawingPreviewBounds.width / viewport.zoom)} × ${Math.round(drawingPreviewBounds.height / viewport.zoom)}`
    : null
  const drawingDimensionWidth = drawingDimensionLabel
    ? Math.max(56, drawingDimensionLabel.length * 7 + 16)
    : 0
  return (
    <>
      {drawing && drawingPreviewBounds && drawingStart && drawingEnd ? (
        <g
          className={`compose-stage__drawing-preview is-${drawing.tool.replace('draw-', '')}`}
          data-drawing-tool={drawing.tool}
          data-testid="stage-drawing-preview"
        >
          {drawing.tool === 'draw-circle' ? (
            <ellipse
              cx={drawingPreviewBounds.x + drawingPreviewBounds.width / 2}
              cy={drawingPreviewBounds.y + drawingPreviewBounds.height / 2}
              rx={drawingPreviewBounds.width / 2}
              ry={drawingPreviewBounds.height / 2}
            />
          ) : drawing.tool === 'draw-line' || drawing.tool === 'draw-arrow' ? (
            <>
              <line x1={drawingStart.x} x2={drawingEnd.x} y1={drawingStart.y} y2={drawingEnd.y} />
              {drawing.tool === 'draw-arrow' ? (
                <path d={arrowHeadPath(drawingStart, drawingEnd) ?? undefined} />
              ) : null}
            </>
          ) : drawing.tool === 'draw-text' ? (
            /*
             * 文字预览只画一根与行高等高的光标：文字只按点创建、尺寸由内容决定，
             * 画一个框会暗示一块用户控制不了的区域；画占位文案则等于承诺一段并不会
             * 存在的内容，松手即消失。光标落在按下点，正是文本将要开始的位置。
             */
            <line
              className="compose-stage__drawing-preview-caret"
              data-testid="stage-drawing-preview-caret"
              x1={drawingPreviewBounds.x}
              x2={drawingPreviewBounds.x}
              y1={drawingPreviewBounds.y}
              y2={drawingPreviewBounds.y + drawingPreviewBounds.height}
            />
          ) : (
            <rect
              height={drawingPreviewBounds.height}
              width={drawingPreviewBounds.width}
              x={drawingPreviewBounds.x}
              y={drawingPreviewBounds.y}
            />
          )}
          {drawingDimensionLabel ? (
            <g
              className="compose-stage__drawing-dimensions"
              transform={`translate(${drawingPreviewBounds.x + drawingPreviewBounds.width / 2} ${drawingPreviewBounds.y + drawingPreviewBounds.height + 8})`}
            >
              <rect height="22" rx="3" width={drawingDimensionWidth} x={-drawingDimensionWidth / 2} y="0" />
              <text textAnchor="middle" x="0" y="15">{drawingDimensionLabel}</text>
            </g>
          ) : null}
        </g>
      ) : null}
    </>
  )
}
