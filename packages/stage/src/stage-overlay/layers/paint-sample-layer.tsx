import { worldToScreen } from '@compose-ui/stage-engine'
import type { StageOverlayContext } from '../overlay-types'

/** 取色反馈层：指针处的采样色环。 */
export function PaintSampleLayer({ paintSample, viewport }: StageOverlayContext) {  return (
    <>
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
    </>
  )
}
