import type { ComposeRendererProps } from '@compose-ui/component-registry'

type ShapeKind = 'line' | 'arrow' | 'circle'
type ShapeAxis = -1 | 0 | 1
type Marker = 'none' | 'arrow'
type StrokeLinecap = 'butt' | 'round' | 'square'

function shapeKind(value: unknown): ShapeKind {
  return value === 'arrow' || value === 'circle' ? value : 'line'
}

function direction(value: unknown): { readonly x: ShapeAxis; readonly y: ShapeAxis } {
  if (!value || typeof value !== 'object') return { x: 1, y: 1 }
  const candidate = value as { readonly x?: unknown; readonly y?: unknown }
  return {
    x: candidate.x === -1 || candidate.x === 0 ? candidate.x : 1,
    y: candidate.y === -1 || candidate.y === 0 ? candidate.y : 1,
  }
}

function endpoint(axis: ShapeAxis, edge: 'start' | 'end') {
  if (axis === 0) return '50%'
  if (edge === 'start') return axis < 0 ? '100%' : '0%'
  return axis < 0 ? '0%' : '100%'
}

function marker(value: unknown, fallback: Marker): Marker {
  return value === 'arrow' || value === 'none' ? value : fallback
}

function strokePattern(
  value: unknown,
  strokeWidth: number,
  strokeLinecap: StrokeLinecap,
): { readonly dasharray?: string; readonly linecap: StrokeLinecap } {
  if (value === '8 4') {
    return {
      dasharray: `${strokeWidth * 4} ${strokeWidth * 2}`,
      linecap: strokeLinecap,
    }
  }
  if (value === '1 4') {
    // 零长度 dash 配合 round cap 才是圆点；间距随线宽变化，避免粗线退化成密集短竖条。
    return {
      dasharray: `0 ${strokeWidth * 2}`,
      linecap: 'round',
    }
  }
  return { linecap: strokeLinecap }
}

/** Materials 内置 Line、Arrow 与 Circle 共用 SVG renderer。 @internal */
export function ShapeRenderer({ entity, mode, props }: ComposeRendererProps) {
  const kind = shapeKind(props.kind)
  const isInteractiveSegment = mode === 'editor' && kind !== 'circle'
  const axis = direction(props.direction)
  const start = { x: endpoint(axis.x, 'start'), y: endpoint(axis.y, 'start') }
  const end = { x: endpoint(axis.x, 'end'), y: endpoint(axis.y, 'end') }
  const stroke = typeof props.stroke === 'string' ? props.stroke : '#d8e2f1'
  const strokeWidth = typeof props.strokeWidth === 'number' && props.strokeWidth >= 0 ? props.strokeWidth : 2
  const strokeLinecap = props.strokeLinecap === 'round' || props.strokeLinecap === 'square'
    ? props.strokeLinecap
    : 'butt'
  const pattern = strokePattern(props.strokeDasharray, strokeWidth, strokeLinecap)
  const markerStart = marker(props.markerStart, 'none')
  // 旧 Arrow 文档没有 markerEnd，仍然以终点箭头渲染。
  const markerEnd = marker(props.markerEnd, kind === 'arrow' ? 'arrow' : 'none')
  const markerId = `compose-shape-arrow-${entity.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`

  return (
    <svg
      aria-label={kind === 'circle' ? 'Circle' : kind === 'arrow' ? 'Arrow' : 'Line'}
      className={`compose-material compose-material--shape${
        isInteractiveSegment ? ' compose-material--interactive-segment' : ''
      }`}
      data-testid={`compose-material-shape-${kind}`}
      fill="none"
      role="img"
    >
      {kind === 'circle' ? (
        <ellipse cx="50%" cy="50%" rx="50%" ry="50%" stroke={stroke} strokeWidth={strokeWidth} />
      ) : (
        <>
          {markerStart === 'arrow' || markerEnd === 'arrow' ? (
            <defs>
              <marker
                id={markerId}
                markerHeight="6"
                markerUnits="strokeWidth"
                markerWidth="6"
                orient="auto-start-reverse"
                refX="5"
                refY="3"
                viewBox="0 0 6 6"
              >
                <path d="M0,0 L6,3 L0,6 Z" fill={stroke} />
              </marker>
            </defs>
          ) : null}
          {isInteractiveSegment ? (
            <line
              className="compose-material__segment-hit"
              data-testid="compose-material-shape-hit"
              pointerEvents="stroke"
              stroke="transparent"
              strokeLinecap="round"
              strokeWidth={Math.max(12, strokeWidth * 2)}
              x1={start.x}
              x2={end.x}
              y1={start.y}
              y2={end.y}
            />
          ) : null}
          <line
            data-testid="compose-material-shape-stroke"
            markerEnd={markerEnd === 'arrow' ? `url(#${markerId})` : undefined}
            markerStart={markerStart === 'arrow' ? `url(#${markerId})` : undefined}
            stroke={stroke}
            strokeDasharray={pattern.dasharray}
            strokeLinecap={pattern.linecap}
            strokeWidth={strokeWidth}
            x1={start.x}
            x2={end.x}
            y1={start.y}
            y2={end.y}
          />
        </>
      )}
    </svg>
  )
}
