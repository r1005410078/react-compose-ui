import { worldToScreen } from '@compose-ui/stage-engine'
import type {
  ResizeHandle,
  StageGuide,
  StageInteractionHit,
  StageInteractionTool,
  StageDrawingPreview,
  StagePaintHandle,
  StagePaintSamplePreview,
  StagePoint,
  StagePreviewGuide,
  StageRect,
  StageViewport,
} from '@compose-ui/stage-engine'
import type { PointerEvent as ReactPointerEvent } from 'react'

interface StageOverlayProps {
  readonly label: string
  readonly viewport: StageViewport
  readonly canvasGuides: readonly StagePreviewGuide[]
  readonly screenBounds: StageRect | null
  /** 单选两点图形的精确世界端点；存在时替代通用矩形选区。 */
  readonly lineSelection?: {
    readonly entityId: string
    readonly start: StagePoint
    readonly end: StagePoint
  } | null
  readonly handlePoints: Readonly<
    Record<ResizeHandle, readonly [number, number]>
  > | null
  readonly editableSelection: boolean
  readonly resizeHandles: readonly ResizeHandle[]
  readonly visibleResizeHandles: readonly ResizeHandle[]
  readonly rotatable: boolean
  /**
   * 选区正处于画布内文字编辑会话。
   *
   * 此时不显示任何 Resize 或旋转手柄，只显示一个编辑边框以区别于普通选中态——编辑态下
   * 拖拽的语义是选择文本。该抑制与 TransformConstraints 的抑制是两条独立规则，叠加生效。
   */
  readonly textEditing: boolean
  readonly tool: StageInteractionTool
  readonly drawing: StageDrawingPreview | null
  readonly marqueeScreen: StageRect | null
  readonly snapGuides: readonly StageGuide[]
  readonly paintHandles: readonly StagePaintHandle[]
  readonly paintSample: StagePaintSamplePreview | null
  readonly onInteraction: (
    hit: StageInteractionHit,
    event: ReactPointerEvent<Element>,
  ) => void
}

function lineDimensionLabel(start: StagePoint, end: StagePoint) {
  const length = Math.hypot(end.x - start.x, end.y - start.y)
  const rounded = Math.round(length * 100) / 100
  return `${rounded} × 0`
}

function lineLabelPosition(start: StagePoint, end: StagePoint) {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const length = Math.hypot(deltaX, deltaY)
  let normal = length < 1
    ? { x: 0, y: 1 }
    : { x: -deltaY / length, y: deltaX / length }
  if (normal.y < 0) normal = { x: -normal.x, y: -normal.y }
  let angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI
  if (angle > 90 || angle < -90) angle += 180
  return {
    angle,
    x: (start.x + end.x) / 2 + normal.x * 17,
    y: (start.y + end.y) / 2 + normal.y * 17,
  }
}

function arrowHeadPath(start: { readonly x: number; readonly y: number }, end: { readonly x: number; readonly y: number }) {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const length = Math.hypot(deltaX, deltaY)
  if (length < 1) return null
  const directionX = deltaX / length
  const directionY = deltaY / length
  const perpendicularX = -directionY
  const perpendicularY = directionX
  const baseX = end.x - directionX * 10
  const baseY = end.y - directionY * 10
  return `M${end.x} ${end.y}L${baseX + perpendicularX * 5} ${baseY + perpendicularY * 5}L${baseX - perpendicularX * 5} ${baseY - perpendicularY * 5}Z`
}

/** 渲染 engine snapshot 的 SVG 编辑覆盖层，不持有手势状态。 */
export function StageOverlay({
  label,
  viewport,
  canvasGuides,
  screenBounds,
  lineSelection = null,
  handlePoints,
  editableSelection,
  resizeHandles,
  visibleResizeHandles,
  rotatable,
  textEditing,
  tool,
  drawing,
  marqueeScreen,
  paintHandles,
  paintSample,
  snapGuides,
  onInteraction,
}: StageOverlayProps) {
  const paintPoint = (kind: StagePaintHandle['kind']) => paintHandles.find((handle) => handle.kind === kind)?.point
  const linearStart = paintPoint('linear-start')
  const linearEnd = paintPoint('linear-end')
  const radialCenter = paintPoint('radial-center')
  const radialX = paintPoint('radial-radius-x')
  const radialY = paintPoint('radial-radius-y')
  const angularCenter = paintPoint('angular-center')
  const angularArm = paintPoint('angular-arm')
  // 0%/100% 色标会与线性端点重叠；先绘制色标，确保端点仍可拖动整条渐变轴。
  const visualPaintHandles = [...paintHandles].sort((left, right) =>
    Number(!left.kind.endsWith('stop')) - Number(!right.kind.endsWith('stop')))
  const drawingScreen = drawing
    ? {
        ...worldToScreen(drawing.bounds, viewport),
        width: drawing.bounds.width * viewport.zoom,
        height: drawing.bounds.height * viewport.zoom,
      }
    : null
  const drawingToolActive = tool.startsWith('draw-')
  const lineSelectionActive = Boolean(lineSelection) && !drawingToolActive
  const lineStartScreen = lineSelection ? worldToScreen(lineSelection.start, viewport) : null
  const lineEndScreen = lineSelection ? worldToScreen(lineSelection.end, viewport) : null
  const lineDimension = lineSelection && lineStartScreen && lineEndScreen
    ? lineDimensionLabel(lineSelection.start, lineSelection.end)
    : null
  const lineDimensionWidth = lineDimension
    ? Math.max(56, lineDimension.length * 7 + 16)
    : 0
  const lineDimensionPosition = lineStartScreen && lineEndScreen
    ? lineLabelPosition(lineStartScreen, lineEndScreen)
    : null
  const lineRotationPoint = lineStartScreen && lineEndScreen
    ? lineLabelPosition(lineStartScreen, lineEndScreen)
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
  // 编辑态下手柄一律不显示；这与 TransformConstraints 的抑制叠加，不互相覆盖。
  const resizeVisible = (tool === 'select' || tool === 'scale') && !textEditing
  // 边缘命中区两端各让出 8px 是为了不压住角手柄，但让位不能把命中区挤没：单行文字这种
  // 只有十几像素高的选区，固定让 16px 后 E/W 命中区高度会算成 0，边根本抓不住。按可用
  // 长度收缩让位，至少保留 8px 可抓长度。
  const edgeInset = (length: number) => Math.max(0, Math.min(8, (length - 8) / 2))
  const insetX = screenBounds ? edgeInset(screenBounds.width) : 0
  const insetY = screenBounds ? edgeInset(screenBounds.height) : 0
  const edgeHitRegions = screenBounds && resizeVisible && !lineSelectionActive ? [
    { handle: 'n' as const, x: screenBounds.x + insetX, y: screenBounds.y - 4, width: Math.max(0, screenBounds.width - insetX * 2), height: 8 },
    { handle: 's' as const, x: screenBounds.x + insetX, y: screenBounds.y + screenBounds.height - 4, width: Math.max(0, screenBounds.width - insetX * 2), height: 8 },
    { handle: 'w' as const, x: screenBounds.x - 4, y: screenBounds.y + insetY, width: 8, height: Math.max(0, screenBounds.height - insetY * 2) },
    { handle: 'e' as const, x: screenBounds.x + screenBounds.width - 4, y: screenBounds.y + insetY, width: 8, height: Math.max(0, screenBounds.height - insetY * 2) },
  ].filter(({ handle }) => resizeHandles.includes(handle)) : []
  return (
    <svg
      aria-label={label}
      className="compose-stage__overlay"
      role="img"
    >
      {canvasGuides.map((guide) => guide.axis === 'x' ? (
        <line
          className="compose-stage__canvas-guide"
          data-guide-id={guide.id}
          data-testid={`stage-canvas-guide-${guide.id}`}
          key={guide.id}
          x1={worldToScreen({ x: guide.position, y: 0 }, viewport).x}
          x2={worldToScreen({ x: guide.position, y: 0 }, viewport).x}
          y1="0"
          y2="100%"
          onPointerDown={(event) => onInteraction(
            { kind: 'guide', guideId: guide.id },
            event,
          )}
        />
      ) : (
        <line
          className="compose-stage__canvas-guide"
          data-guide-id={guide.id}
          data-testid={`stage-canvas-guide-${guide.id}`}
          key={guide.id}
          x1="0"
          x2="100%"
          y1={worldToScreen({ x: 0, y: guide.position }, viewport).y}
          y2={worldToScreen({ x: 0, y: guide.position }, viewport).y}
          onPointerDown={(event) => onInteraction(
            { kind: 'guide', guideId: guide.id },
            event,
          )}
        />
      ))}
      {lineSelectionActive && lineSelection && lineStartScreen && lineEndScreen ? (
        <g className="compose-stage__line-selection" data-testid="stage-line-selection">
          <line
            className="compose-stage__line-selection-axis"
            x1={lineStartScreen.x}
            x2={lineEndScreen.x}
            y1={lineStartScreen.y}
            y2={lineEndScreen.y}
          />
          {resizeVisible && editableSelection ? (
            <>
              <rect
                className="compose-stage__line-selection-handle"
                data-testid="stage-line-selection-start"
                height="8"
                width="8"
                x={lineStartScreen.x - 4}
                y={lineStartScreen.y - 4}
                onPointerDown={(event) => onInteraction({
                  kind: 'segment-endpoint',
                  entityId: lineSelection.entityId,
                  endpoint: 'start',
                  start: lineSelection.start,
                  end: lineSelection.end,
                }, event)}
              />
              <rect
                className="compose-stage__line-selection-handle"
                data-testid="stage-line-selection-end"
                height="8"
                width="8"
                x={lineEndScreen.x - 4}
                y={lineEndScreen.y - 4}
                onPointerDown={(event) => onInteraction({
                  kind: 'segment-endpoint',
                  entityId: lineSelection.entityId,
                  endpoint: 'end',
                  start: lineSelection.start,
                  end: lineSelection.end,
                }, event)}
              />
            </>
          ) : null}
          {lineDimension && lineDimensionPosition ? (
            <g
              className="compose-stage__line-selection-dimensions"
              data-testid="stage-line-selection-dimensions"
              transform={`translate(${lineDimensionPosition.x} ${lineDimensionPosition.y}) rotate(${lineDimensionPosition.angle})`}
            >
              <rect height="22" rx="4" width={lineDimensionWidth} x={-lineDimensionWidth / 2} y="-11" />
              <text dominantBaseline="middle" textAnchor="middle" x="0" y="0">{lineDimension}</text>
            </g>
          ) : null}
          {rotatable && tool === 'rotate' && !textEditing && lineRotationPoint ? (
            <circle
              className="compose-stage__handle compose-stage__rotation"
              cx={lineRotationPoint.x}
              cy={lineRotationPoint.y + 18}
              data-testid="stage-rotation-handle"
              r="5"
              onPointerDown={(event) => onInteraction({ kind: 'rotate' }, event)}
            />
          ) : null}
        </g>
      ) : screenBounds && !drawingToolActive ? (
        <rect
          className={`compose-stage__selection${textEditing ? ' is-text-editing' : ''}`}
          data-testid={textEditing ? 'stage-text-editing-bounds' : 'stage-selection-bounds'}
          height={screenBounds.height}
          width={screenBounds.width}
          x={screenBounds.x}
          y={screenBounds.y}
        />
      ) : null}
      {editableSelection && handlePoints && paintHandles.length === 0 && !lineSelectionActive ? (
        <>
          {resizeVisible ? edgeHitRegions.map(({ handle, ...rect }) => (
            <rect
              {...rect}
              className={`compose-stage__resize-hit compose-stage__resize-hit--${handle}`}
              data-testid={`stage-resize-edge-${handle}`}
              key={`edge:${handle}`}
              onPointerDown={(event) => onInteraction({ kind: 'resize', handle }, event)}
            />
          )) : null}
          {resizeVisible ? (Object.entries(handlePoints) as [ResizeHandle, readonly [number, number]][])
            .filter(([handle]) => visibleResizeHandles.includes(handle))
            .map(([handle, [x, y]]) => (
              <rect
                className={`compose-stage__handle compose-stage__handle--${handle}`}
                data-testid={`stage-resize-${handle}`}
                height="8"
                key={handle}
                width="8"
                x={x - 4}
                y={y - 4}
                onPointerDown={(event) => onInteraction(
                  { kind: 'resize', handle },
                  event,
                )}
              />
            )) : null}
          {rotatable && tool === 'rotate' && !textEditing ? (
            <circle
              className="compose-stage__handle compose-stage__rotation"
              cx={handlePoints.n[0]}
              cy={handlePoints.n[1] - 24}
              data-testid="stage-rotation-handle"
              r="5"
              onPointerDown={(event) => onInteraction({ kind: 'rotate' }, event)}
            />
          ) : null}
        </>
      ) : null}
      {editableSelection && screenBounds && tool === 'move' && !textEditing ? (
        <g
          className="compose-stage__move-gizmo"
          data-testid="stage-move-gizmo"
          transform={`translate(${screenBounds.x} ${screenBounds.y})`}
        >
          <path className="compose-stage__move-gizmo-origin" d="M-4 0h8M0-4v8" />
          <path
            className="compose-stage__move-gizmo-axis compose-stage__move-gizmo-axis--x"
            d="M4 0H68m0 0-9-6m9 6-9 6"
            data-testid="stage-move-axis-x"
            onPointerDown={(event) => onInteraction({ kind: 'move-axis', axis: 'x' }, event)}
          />
          <path
            className="compose-stage__move-gizmo-axis compose-stage__move-gizmo-axis--y"
            d="M0 4v64m0 0-6-9m6 9 6-9"
            data-testid="stage-move-axis-y"
            onPointerDown={(event) => onInteraction({ kind: 'move-axis', axis: 'y' }, event)}
          />
        </g>
      ) : null}
      {paintHandles.length > 0 ? (
        <g className="compose-stage__paint-handles" data-testid="stage-paint-handles">
          {linearStart && linearEnd ? (() => {
            const start = worldToScreen(linearStart, viewport)
            const end = worldToScreen(linearEnd, viewport)
            return <line className="compose-stage__paint-axis" x1={start.x} x2={end.x} y1={start.y} y2={end.y} />
          })() : null}
          {radialCenter && radialX ? (() => {
            const center = worldToScreen(radialCenter, viewport)
            const x = worldToScreen(radialX, viewport)
            const y = radialY ? worldToScreen(radialY, viewport) : undefined
            return <>
              <line className="compose-stage__paint-axis" x1={center.x} x2={x.x} y1={center.y} y2={x.y} />
              {y ? <line className="compose-stage__paint-axis" x1={center.x} x2={y.x} y1={center.y} y2={y.y} /> : null}
            </>
          })() : null}
          {angularCenter && angularArm ? (() => {
            const center = worldToScreen(angularCenter, viewport)
            const arm = worldToScreen(angularArm, viewport)
            return <line className="compose-stage__paint-axis" x1={center.x} x2={arm.x} y1={center.y} y2={arm.y} />
          })() : null}
          {visualPaintHandles.map((handle) => {
            const point = worldToScreen(handle.point, viewport)
            const stop = handle.kind.endsWith('stop')
            return stop ? (
              <circle
                className="compose-stage__paint-stop"
                cx={point.x}
                cy={point.y}
                data-testid={`stage-paint-${handle.kind}-${handle.stopId}`}
                key={`${handle.kind}:${handle.stopId}`}
                r="5"
                onPointerDown={(event) => onInteraction({ kind: 'paint-handle', handle: handle.kind, stopId: handle.stopId }, event)}
              />
            ) : (
              <rect
                className="compose-stage__paint-handle"
                data-testid={`stage-paint-${handle.kind}`}
                height="10"
                key={handle.kind}
                width="10"
                x={point.x - 5}
                y={point.y - 5}
                onPointerDown={(event) => onInteraction({ kind: 'paint-handle', handle: handle.kind }, event)}
              />
            )
          })}
        </g>
      ) : null}
      {paintSample ? (() => {
        const point = worldToScreen(paintSample.point, viewport)
        return (
          <g className="compose-stage__paint-sample" data-testid="stage-paint-sample">
            <path d={`M${point.x - 10} ${point.y}H${point.x + 10}M${point.x} ${point.y - 10}V${point.y + 10}`} />
            <circle cx={point.x} cy={point.y} r="4" />
            <g transform={`translate(${point.x + 12} ${point.y + 12})`}>
              <rect className="compose-stage__paint-sample-label" height="22" rx="4" width="104" />
              {paintSample.color ? <rect className="compose-stage__paint-sample-swatch" height="14" rx="2" width="14" x="4" y="4" style={{ fill: paintSample.color }} /> : null}
              <text x={paintSample.color ? 24 : 6} y="15">{paintSample.color ?? 'No Paint'}</text>
            </g>
          </g>
        )
      })() : null}
      {marqueeScreen ? (
        <rect
          className="compose-stage__marquee"
          data-testid="stage-marquee"
          height={marqueeScreen.height}
          width={marqueeScreen.width}
          x={marqueeScreen.x}
          y={marqueeScreen.y}
        />
      ) : null}
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
      {snapGuides.map((guide) => guide.axis === 'x' ? (
        <line
          className="compose-stage__guide"
          data-testid="stage-snap-guide-x"
          key={`x:${guide.value}`}
          x1={worldToScreen({ x: guide.value, y: 0 }, viewport).x}
          x2={worldToScreen({ x: guide.value, y: 0 }, viewport).x}
          y1="0"
          y2="100%"
        />
      ) : (
        <line
          className="compose-stage__guide"
          data-testid="stage-snap-guide-y"
          key={`y:${guide.value}`}
          x1="0"
          x2="100%"
          y1={worldToScreen({ x: 0, y: guide.value }, viewport).y}
          y2={worldToScreen({ x: 0, y: guide.value }, viewport).y}
        />
      ))}
    </svg>
  )
}
