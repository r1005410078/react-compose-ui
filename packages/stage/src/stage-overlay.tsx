import { worldToScreen } from '@compose-ui/stage-engine'
import type {
  ResizeHandle,
  StageGuide,
  StageInteractionHit,
  StagePaintHandle,
  StagePaintSamplePreview,
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
  readonly handlePoints: Readonly<
    Record<ResizeHandle, readonly [number, number]>
  > | null
  readonly editableSelection: boolean
  readonly resizeHandles: readonly ResizeHandle[]
  readonly rotatable: boolean
  readonly marqueeScreen: StageRect | null
  readonly snapGuides: readonly StageGuide[]
  readonly paintHandles: readonly StagePaintHandle[]
  readonly paintSample: StagePaintSamplePreview | null
  readonly onInteraction: (
    hit: StageInteractionHit,
    event: ReactPointerEvent<Element>,
  ) => void
}

/** 渲染 engine snapshot 的 SVG 编辑覆盖层，不持有手势状态。 */
export function StageOverlay({
  label,
  viewport,
  canvasGuides,
  screenBounds,
  handlePoints,
  editableSelection,
  resizeHandles,
  rotatable,
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
      {screenBounds ? (
        <rect
          className="compose-stage__selection"
          data-testid="stage-selection-bounds"
          height={screenBounds.height}
          width={screenBounds.width}
          x={screenBounds.x}
          y={screenBounds.y}
        />
      ) : null}
      {editableSelection && handlePoints && paintHandles.length === 0 ? (
        <>
          {(Object.entries(handlePoints) as [ResizeHandle, readonly [number, number]][])
            .filter(([handle]) => resizeHandles.includes(handle))
            .map(([handle, [x, y]]) => (
              <rect
                className="compose-stage__handle"
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
            ))}
          {rotatable ? (
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
