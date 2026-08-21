import { worldToScreen } from '@compose-ui/stage-engine'
import type { StageOverlayContext } from '../overlay-types'

/** 画布辅助线：跨整个视口的水平/垂直参考线，可被拖动或拖回标尺删除。 */
export function CanvasGuidesLayer({ canvasGuides, viewport, onInteraction }: StageOverlayContext) {  return (
    <>
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
    </>
  )
}
