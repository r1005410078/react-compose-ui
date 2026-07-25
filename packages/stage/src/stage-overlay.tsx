import { worldToScreen } from '@compose-ui/stage-engine'
import type {
  ResizeHandle,
  StageGuide,
  StageInteractionHit,
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
  readonly marqueeScreen: StageRect | null
  readonly snapGuides: readonly StageGuide[]
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
  marqueeScreen,
  snapGuides,
  onInteraction,
}: StageOverlayProps) {
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
      {editableSelection && handlePoints ? (
        <>
          {(Object.entries(handlePoints) as [ResizeHandle, readonly [number, number]][])
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
          <circle
            className="compose-stage__handle compose-stage__rotation"
            cx={handlePoints.n[0]}
            cy={handlePoints.n[1] - 24}
            data-testid="stage-rotation-handle"
            r="5"
            onPointerDown={(event) => onInteraction({ kind: 'rotate' }, event)}
          />
        </>
      ) : null}
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
