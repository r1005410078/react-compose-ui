import { worldToScreen } from '@compose-ui/stage-engine'
import type {
  ResizeHandle,
  StageEditablePath,
  StageGuide,
  StageInteractionHit,
  StageInteractionTool,
  StageDrawingPreview,
  StageDropIndicator,
  StageMarqueeMode,
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
  /**
   * 已下钻选中的实例内部实体矩形。
   *
   * @remarks
   * 内部实体不属于宿主文档，几何来自 DOM 测量。只画只读边框、不带任何手柄：实例内部的
   * 几何编辑要经由实例覆盖，尚未接线。
   */
  readonly instanceSelectionBounds?: StageRect | null
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
  /**
   * 拖拽落点的世界坐标指示。
   *
   * 存在时说明松手会改变结构：`reparent` 高亮目标容器，`reorder` 在插入位画一根落点线。
   * 被拖动目标自身的选中框与手柄呈现不受影响——两者是不同对象，不存在反馈叠加。
   */
  readonly dropIndicator: StageDropIndicator | null
  /**
   * Godot 旋转拉线预览（世界坐标）：选区中心 → 当前指针。
   *
   * @remarks
   * 仅在 `phase === 'rotate'` 时由 engine 提供；存在时 Overlay 画拉杆并跟随鼠标。
   * Shift 吸附时 pointer 已投影到 15° 射线，`angleDegrees` 为增量角。
   */
  readonly rotationPreview?: {
    readonly center: StagePoint
    readonly pointer: StagePoint
    readonly angleDegrees?: number
    readonly snapped?: boolean
  } | null
  /** 当前框选实际生效的判定；决定 marquee 边框是实线还是虚线。 */
  readonly marqueeHitTest: Exclude<StageMarqueeMode, 'directional'> | null
  readonly marqueeScreen: StageRect | null
  readonly snapGuides: readonly StageGuide[]
  readonly paintHandles: readonly StagePaintHandle[]
  readonly paintSample: StagePaintSamplePreview | null
  /** 宿主算好的世界坐标可编辑路径几何；null 时不渲染任何路径元素。 */
  readonly editablePath?: StageEditablePath | null
  /** 当前活动顶点：corner 顶点被激活时也显示切线手柄。 */
  readonly activePathVertexId?: string | null
  readonly onInteraction: (
    hit: StageInteractionHit,
    event: ReactPointerEvent<Element>,
  ) => void
}

const LINE_ENDPOINT_HANDLE_SIZE = 8
// 可见方块保持轻量，命中区独立放大，避免高分屏上必须像素级对准才能开始端点手势。
const LINE_ENDPOINT_HIT_RADIUS = 10
/** 四角缩放手柄边长（屏幕 px）；边方向只靠透明 hit，不渲染中点方块。 */
const CORNER_HANDLE_SIZE = 7

/** 路径顶点菱形的半对角线（屏幕 px）；与时间线关键帧菱形同形呼应。 */
const PATH_VERTEX_SIZE = 8
const PATH_TANGENT_HANDLE_RADIUS = 3.5

/**
 * 可编辑路径覆盖层：虚线轨迹、等时采样点、切线连杆与手柄、关键帧顶点菱形。
 *
 * @remarks
 * 渲染顺序即命中顺序：切线手柄最后渲染，重叠时 DOM 上层先接收指针，实现
 * "切线命中优先于顶点"；命中区用 `LINE_ENDPOINT_HIT_RADIUS` 独立放大。
 * 切线只在 `smooth` 顶点或当前活动顶点上显示，corner 顶点全亮会让路径变成一团线。
 */
function EditablePathLayer({
  activeVertexId,
  onInteraction,
  path,
  viewport,
}: {
  readonly path: StageEditablePath
  readonly activeVertexId: string | null
  readonly viewport: StageViewport
  readonly onInteraction: (
    hit: StageInteractionHit,
    event: ReactPointerEvent<Element>,
  ) => void
}) {
  const vertices = path.vertices.map((vertex) => ({
    id: vertex.id,
    mode: vertex.mode,
    screen: worldToScreen(vertex.point, viewport),
    inScreen: vertex.inTangent ? worldToScreen(vertex.inTangent, viewport) : null,
    outScreen: vertex.outTangent ? worldToScreen(vertex.outTangent, viewport) : null,
    showTangents: vertex.mode === 'smooth' || vertex.id === activeVertexId,
  }))
  const tangentHandles = vertices
    .filter((vertex) => vertex.showTangents)
    .flatMap((vertex) => [
      ...(vertex.inScreen ? [{ vertex, handle: 'tangent-in' as const, point: vertex.inScreen }] : []),
      ...(vertex.outScreen ? [{ vertex, handle: 'tangent-out' as const, point: vertex.outScreen }] : []),
    ])
  return (
    <g className="compose-stage__editable-path" data-testid="stage-editable-path">
      <polyline
        className="compose-stage__editable-path-line"
        data-testid="stage-editable-path-line"
        points={path.polyline
          .map((point) => worldToScreen(point, viewport))
          .map((point) => `${point.x},${point.y}`)
          .join(' ')}
      />
      {path.dots.map((dot, index) => {
        const point = worldToScreen(dot, viewport)
        return (
          <circle
            className="compose-stage__editable-path-dot"
            cx={point.x}
            cy={point.y}
            data-testid="stage-editable-path-dot"
            key={index}
            r={1.5}
          />
        )
      })}
      {tangentHandles.map(({ vertex, handle, point }) => (
        <line
          className="compose-stage__editable-path-tangent-link"
          key={`link:${vertex.id}:${handle}`}
          x1={vertex.screen.x}
          x2={point.x}
          y1={vertex.screen.y}
          y2={point.y}
        />
      ))}
      {vertices.map((vertex) => (
        <g key={`vertex:${vertex.id}`}>
          <rect
            className="compose-stage__editable-path-vertex"
            data-testid={`stage-path-vertex-${vertex.id}`}
            data-vertex-active={vertex.id === activeVertexId || undefined}
            data-vertex-mode={vertex.mode}
            height={PATH_VERTEX_SIZE}
            transform={`rotate(45 ${vertex.screen.x} ${vertex.screen.y})`}
            width={PATH_VERTEX_SIZE}
            x={vertex.screen.x - PATH_VERTEX_SIZE / 2}
            y={vertex.screen.y - PATH_VERTEX_SIZE / 2}
          />
          <circle
            className="compose-stage__editable-path-hit"
            cx={vertex.screen.x}
            cy={vertex.screen.y}
            data-testid={`stage-path-vertex-hit-${vertex.id}`}
            r={LINE_ENDPOINT_HIT_RADIUS}
            onPointerDown={(event) => onInteraction(
              { kind: 'path-handle', handle: 'vertex', vertexId: vertex.id },
              event,
            )}
          />
        </g>
      ))}
      {tangentHandles.map(({ vertex, handle, point }) => (
        <g key={`handle:${vertex.id}:${handle}`}>
          <circle
            className="compose-stage__editable-path-tangent"
            cx={point.x}
            cy={point.y}
            data-testid={`stage-path-tangent-${vertex.id}-${handle === 'tangent-in' ? 'in' : 'out'}`}
            r={PATH_TANGENT_HANDLE_RADIUS}
          />
          <circle
            className="compose-stage__editable-path-hit"
            cx={point.x}
            cy={point.y}
            r={LINE_ENDPOINT_HIT_RADIUS}
            onPointerDown={(event) => onInteraction(
              { kind: 'path-handle', handle, vertexId: vertex.id },
              event,
            )}
          />
        </g>
      ))}
    </g>
  )
}

function lineAngle(start: StagePoint, end: StagePoint) {
  return Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI
}

function lineEndpointCursor(start: StagePoint, end: StagePoint) {
  const angle = ((lineAngle(start, end) % 180) + 180) % 180
  if (angle < 22.5 || angle >= 157.5) return 'ew-resize'
  if (angle < 67.5) return 'nwse-resize'
  if (angle < 112.5) return 'ns-resize'
  return 'nesw-resize'
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
  let angle = lineAngle(start, end)
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

/**
 * Godot 风格旋转拉线：中心枢轴 + 指向指针的拉杆 + 末端圆点。
 *
 * @remarks
 * 拉线只在手势进行中绘制（`rotationPreview`）；空闲时最多只显示中心点，
 * 不依赖固定手柄位置——任意点按下即可开始旋转。
 */
function RotationRubberBand({
  centerX,
  centerY,
  pointerX,
  pointerY,
  active,
  angleDegrees = 0,
  snapped = false,
}: {
  readonly centerX: number
  readonly centerY: number
  readonly pointerX: number
  readonly pointerY: number
  readonly active: boolean
  readonly angleDegrees?: number
  readonly snapped?: boolean
}) {
  // 拉杆不画进枢轴圆心，避免压住中心标记。
  const dx = pointerX - centerX
  const dy = pointerY - centerY
  const length = Math.hypot(dx, dy)
  const unitX = length > 1 ? dx / length : 0
  const unitY = length > 1 ? dy / length : -1
  const stemStartX = centerX + unitX * 5
  const stemStartY = centerY + unitY * 5
  const tipInset = active ? 0 : 7
  const stemEndX = pointerX - unitX * tipInset
  const stemEndY = pointerY - unitY * tipInset
  // 角度标注放在拉线中点偏外，吸附态用更高对比。
  const labelX = (centerX + pointerX) / 2 - unitY * 14
  const labelY = (centerY + pointerY) / 2 + unitX * 14
  const angleLabel = `${Math.round(angleDegrees * 10) / 10}°`

  return (
    <g
      className={`compose-stage__rotation-gizmo${snapped ? ' is-snapped' : ''}`}
      data-testid="stage-rotation-gizmo"
    >
      {active ? (
        <line
          className="compose-stage__rotation-stem"
          x1={stemStartX}
          x2={stemEndX}
          y1={stemStartY}
          y2={stemEndY}
        />
      ) : null}
      {/* 中心枢轴：外环 + 实心点 */}
      <circle
        className="compose-stage__rotation-center-ring"
        cx={centerX}
        cy={centerY}
        data-testid="stage-rotation-center"
        r="4.5"
      />
      <circle
        className="compose-stage__rotation-center-dot"
        cx={centerX}
        cy={centerY}
        r="1.75"
      />
      {active ? (
        <circle
          className="compose-stage__handle compose-stage__rotation"
          cx={pointerX}
          cy={pointerY}
          data-testid="stage-rotation-handle"
          r="5.5"
        />
      ) : null}
      {active ? (
        <g
          className="compose-stage__rotation-angle"
          data-testid="stage-rotation-angle"
          transform={`translate(${labelX} ${labelY})`}
        >
          <rect height="18" rx="4" width={Math.max(36, angleLabel.length * 7 + 12)} x="-18" y="-9" />
          <text dominantBaseline="middle" textAnchor="middle" x="0" y="0">{angleLabel}</text>
        </g>
      ) : null}
    </g>
  )
}

/** 渲染 engine snapshot 的 SVG 编辑覆盖层，不持有手势状态。 */
export function StageOverlay({
  label,
  viewport,
  canvasGuides,
  screenBounds,
  instanceSelectionBounds,
  lineSelection = null,
  handlePoints,
  editableSelection,
  resizeHandles,
  visibleResizeHandles,
  rotatable,
  textEditing,
  tool,
  drawing,
  dropIndicator,
  rotationPreview = null,
  marqueeHitTest,
  marqueeScreen,
  paintHandles,
  paintSample,
  snapGuides,
  editablePath = null,
  activePathVertexId = null,
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
  const dropScreen = dropIndicator?.kind === 'reparent'
    ? {
        ...worldToScreen(dropIndicator.bounds, viewport),
        width: dropIndicator.bounds.width * viewport.zoom,
        height: dropIndicator.bounds.height * viewport.zoom,
      }
    : null
  const dropLine = dropIndicator?.kind === 'reorder'
    ? {
        start: worldToScreen(dropIndicator.start, viewport),
        end: worldToScreen(dropIndicator.end, viewport),
      }
    : null
  const drawingToolActive = tool.startsWith('draw-')
  const lineSelectionActive = Boolean(lineSelection) && !drawingToolActive
  const lineStartScreen = lineSelection ? worldToScreen(lineSelection.start, viewport) : null
  const lineEndScreen = lineSelection ? worldToScreen(lineSelection.end, viewport) : null
  const lineSelectionAngle = lineStartScreen && lineEndScreen
    ? lineAngle(lineStartScreen, lineEndScreen)
    : 0
  const lineSelectionCursor = lineStartScreen && lineEndScreen
    ? lineEndpointCursor(lineStartScreen, lineEndScreen)
    : 'default'
  const lineDimension = lineSelection && lineStartScreen && lineEndScreen
    ? lineDimensionLabel(lineSelection.start, lineSelection.end)
    : null
  const lineDimensionWidth = lineDimension
    ? Math.max(56, lineDimension.length * 7 + 16)
    : 0
  const lineDimensionPosition = lineStartScreen && lineEndScreen
    ? lineLabelPosition(lineStartScreen, lineEndScreen)
    : null
  const drawingStart = drawing ? worldToScreen(drawing.start, viewport) : null
  const drawingEnd = drawing ? worldToScreen(drawing.end, viewport) : null
  // Godot 拉线：手势中心/指针转屏幕；空闲时仅在选区中心画枢轴提示。
  const rotationPreviewScreen = rotationPreview
    ? {
        center: worldToScreen(rotationPreview.center, viewport),
        pointer: worldToScreen(rotationPreview.pointer, viewport),
        active: true as const,
      }
    : rotatable && tool === 'rotate' && !textEditing && screenBounds
      ? {
          center: {
            x: screenBounds.x + screenBounds.width / 2,
            y: screenBounds.y + screenBounds.height / 2,
          },
          pointer: {
            x: screenBounds.x + screenBounds.width / 2,
            y: screenBounds.y + screenBounds.height / 2,
          },
          active: false as const,
        }
      : rotatable && tool === 'rotate' && !textEditing && lineStartScreen && lineEndScreen
        ? {
            center: {
              x: (lineStartScreen.x + lineEndScreen.x) / 2,
              y: (lineStartScreen.y + lineEndScreen.y) / 2,
            },
            pointer: {
              x: (lineStartScreen.x + lineEndScreen.x) / 2,
              y: (lineStartScreen.y + lineEndScreen.y) / 2,
            },
            active: false as const,
          }
        : null
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
              <circle
                className="compose-stage__line-selection-hit"
                data-testid="stage-line-selection-start"
                cx={lineStartScreen.x}
                cy={lineStartScreen.y}
                r={LINE_ENDPOINT_HIT_RADIUS}
                style={{ cursor: lineSelectionCursor }}
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
                data-testid="stage-line-selection-start-handle"
                height={LINE_ENDPOINT_HANDLE_SIZE}
                transform={`rotate(${lineSelectionAngle} ${lineStartScreen.x} ${lineStartScreen.y})`}
                width={LINE_ENDPOINT_HANDLE_SIZE}
                x={lineStartScreen.x - LINE_ENDPOINT_HANDLE_SIZE / 2}
                y={lineStartScreen.y - LINE_ENDPOINT_HANDLE_SIZE / 2}
              />
              <circle
                className="compose-stage__line-selection-hit"
                data-testid="stage-line-selection-end"
                cx={lineEndScreen.x}
                cy={lineEndScreen.y}
                r={LINE_ENDPOINT_HIT_RADIUS}
                style={{ cursor: lineSelectionCursor }}
                onPointerDown={(event) => onInteraction({
                  kind: 'segment-endpoint',
                  entityId: lineSelection.entityId,
                  endpoint: 'end',
                  start: lineSelection.start,
                  end: lineSelection.end,
                }, event)}
              />
              <rect
                className="compose-stage__line-selection-handle"
                data-testid="stage-line-selection-end-handle"
                height={LINE_ENDPOINT_HANDLE_SIZE}
                transform={`rotate(${lineSelectionAngle} ${lineEndScreen.x} ${lineEndScreen.y})`}
                width={LINE_ENDPOINT_HANDLE_SIZE}
                x={lineEndScreen.x - LINE_ENDPOINT_HANDLE_SIZE / 2}
                y={lineEndScreen.y - LINE_ENDPOINT_HANDLE_SIZE / 2}
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
        </g>
      ) : instanceSelectionBounds ? (
        <rect
          className="compose-stage__selection compose-stage__selection--instance-inner"
          data-testid="stage-instance-selection-bounds"
          height={instanceSelectionBounds.height}
          width={instanceSelectionBounds.width}
          x={instanceSelectionBounds.x}
          y={instanceSelectionBounds.y}
        />
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
                height={CORNER_HANDLE_SIZE}
                key={handle}
                width={CORNER_HANDLE_SIZE}
                x={x - CORNER_HANDLE_SIZE / 2}
                y={y - CORNER_HANDLE_SIZE / 2}
                onPointerDown={(event) => onInteraction(
                  { kind: 'resize', handle },
                  event,
                )}
              />
            )) : null}
        </>
      ) : null}
      {/* 可编辑路径层：位于变换手柄之上——关键帧顶点常与对象角点重合，压在手柄之下
          将永远拖不动；吸附参考线等瞬时反馈仍渲染在其后（最上层）。 */}
      {editablePath ? (
        <EditablePathLayer
          activeVertexId={activePathVertexId}
          path={editablePath}
          viewport={viewport}
          onInteraction={onInteraction}
        />
      ) : null}
      {/* Godot 旋转：空闲只显示中心；按下后拉线跟随鼠标（rotationPreview）。 */}
      {rotationPreviewScreen ? (
        <RotationRubberBand
          active={rotationPreviewScreen.active}
          angleDegrees={rotationPreview?.angleDegrees ?? 0}
          centerX={rotationPreviewScreen.center.x}
          centerY={rotationPreviewScreen.center.y}
          pointerX={rotationPreviewScreen.pointer.x}
          pointerY={rotationPreviewScreen.pointer.y}
          snapped={rotationPreview?.snapped ?? false}
        />
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
          data-marquee-mode={marqueeHitTest ?? 'intersect'}
          data-testid="stage-marquee"
          height={marqueeScreen.height}
          width={marqueeScreen.width}
          x={marqueeScreen.x}
          y={marqueeScreen.y}
        />
      ) : null}
      {dropScreen ? (
        <rect
          className="compose-stage__drop-container"
          data-testid="stage-drop-container"
          height={dropScreen.height}
          width={dropScreen.width}
          x={dropScreen.x}
          y={dropScreen.y}
        />
      ) : null}
      {dropLine ? (
        <line
          className="compose-stage__drop-line"
          data-testid="stage-drop-line"
          x1={dropLine.start.x}
          x2={dropLine.end.x}
          y1={dropLine.start.y}
          y2={dropLine.end.y}
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
