import { worldToScreen } from '@compose-ui/stage-engine'
import type { StageOverlayContext } from '../overlay-types'
import type { StagePaintHandle } from '@compose-ui/stage-engine'

/** 渐变控制柄层：渐变轴连线与可拖动的端点、圆心、半径与色标。 */
export function PaintHandlesLayer({ paintHandles, viewport, onInteraction }: StageOverlayContext) {
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
    <>
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
    </>
  )
}
