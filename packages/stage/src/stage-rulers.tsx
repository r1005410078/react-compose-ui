import type {
  StageRect,
  StageRulerTick,
} from '@compose-ui/stage-engine'
import type { PointerEvent as ReactPointerEvent } from 'react'

function formatDimension(value: number) {
  const rounded = Math.round(value * 100) / 100
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

interface StageRulersProps {
  readonly bounds: StageRect | null
  readonly screenBounds: StageRect | null
  readonly horizontalTicks: readonly StageRulerTick[]
  readonly verticalTicks: readonly StageRulerTick[]
  readonly labels: {
    readonly origin: string
    readonly horizontal: string
    readonly vertical: string
  }
  readonly onCornerPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onHorizontalPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onVerticalPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
}

/** 固定于 viewport 的标尺 chrome；只消费 engine 几何结果。 */
export function StageRulers({
  bounds,
  screenBounds,
  horizontalTicks,
  verticalTicks,
  labels,
  onCornerPointerDown,
  onHorizontalPointerDown,
  onVerticalPointerDown,
}: StageRulersProps) {
  return (
    <>
      <div
        aria-label={labels.origin}
        className="compose-stage__ruler-corner"
        data-testid="stage-ruler-corner"
        role="img"
        onPointerDown={onCornerPointerDown}
      >
        <span aria-hidden="true">＋</span>
      </div>
      <div
        aria-label={labels.horizontal}
        className="compose-stage__ruler is-horizontal"
        data-testid="stage-ruler-x"
        role="group"
        onPointerDown={onHorizontalPointerDown}
      >
        <svg aria-hidden="true">
          {horizontalTicks.map((tick) => (
            <g
              data-world-value={tick.value}
              key={tick.value}
              transform={`translate(${tick.screen} 0)`}
            >
              <line className={tick.major ? 'is-major' : ''} x1="0" x2="0" y1={tick.major ? 12 : 17} y2="24" />
              {tick.label ? <text x="3" y="10">{tick.label}</text> : null}
            </g>
          ))}
          {screenBounds && bounds ? (
            <g className="compose-stage__ruler-selection" data-testid="stage-ruler-selection-x">
              <line x1={screenBounds.x} x2={screenBounds.x + screenBounds.width} y1="21" y2="21" />
              <line x1={screenBounds.x} x2={screenBounds.x} y1="15" y2="24" />
              <line x1={screenBounds.x + screenBounds.width} x2={screenBounds.x + screenBounds.width} y1="15" y2="24" />
              <text x={screenBounds.x + screenBounds.width / 2} y="19" textAnchor="middle">
                {formatDimension(bounds.width)}
              </text>
            </g>
          ) : null}
        </svg>
      </div>
      <div
        aria-label={labels.vertical}
        className="compose-stage__ruler is-vertical"
        data-testid="stage-ruler-y"
        role="group"
        onPointerDown={onVerticalPointerDown}
      >
        <svg aria-hidden="true">
          {verticalTicks.map((tick) => (
            <g
              data-world-value={tick.value}
              key={tick.value}
              transform={`translate(0 ${tick.screen})`}
            >
              <line className={tick.major ? 'is-major' : ''} x1={tick.major ? 12 : 17} x2="24" y1="0" y2="0" />
              {tick.label ? (
                <text x="3" y="-3" transform="rotate(90)">
                  {tick.label}
                </text>
              ) : null}
            </g>
          ))}
          {screenBounds && bounds ? (
            <g className="compose-stage__ruler-selection" data-testid="stage-ruler-selection-y">
              <line x1="21" x2="21" y1={screenBounds.y} y2={screenBounds.y + screenBounds.height} />
              <line x1="15" x2="24" y1={screenBounds.y} y2={screenBounds.y} />
              <line x1="15" x2="24" y1={screenBounds.y + screenBounds.height} y2={screenBounds.y + screenBounds.height} />
              <text
                textAnchor="middle"
                transform={`translate(18 ${screenBounds.y + screenBounds.height / 2}) rotate(-90)`}
              >
                {formatDimension(bounds.height)}
              </text>
            </g>
          ) : null}
        </svg>
      </div>
    </>
  )
}
