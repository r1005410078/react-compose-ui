import type { StagePoint } from '@compose-ui/stage-engine'
import type { StageFrameScreenBounds } from './stage-screen-geometry'

/** 世界原点图标的半边长；用于把 16×16 的图标中心对准原点。 */
const WORLD_ORIGIN_ICON_HALF_SIZE = 8

/** 世界底图的 props。 */
export interface StageWorldUnderlayProps {
  /** 各块场景的屏幕边界。 */
  readonly frameBounds: readonly StageFrameScreenBounds[]
  /** 世界原点的屏幕坐标。 */
  readonly worldOriginScreen: StagePoint
}

/**
 * 画在 Scene 之下的世界底图：场景区域锚点、原点轴线与原点图标。
 *
 * @remarks
 * 这一层**不为场景补画任何装饰**。场景与容器共用同一条呈现管线，背景、边框、圆角全部来自
 * Entity 自身的 `Appearance`；这里的矩形是透明的，只作为「可检查边界」的锚点供按 frameId
 * 定位。`pointerEvents` 必须关掉，否则它会吞掉绘制工具在场景区域内的按下。
 */
export function StageWorldUnderlay({
  frameBounds,
  worldOriginScreen,
}: StageWorldUnderlayProps) {
  return (
    <svg aria-hidden="true" className="compose-stage__world-overlay">
      {frameBounds.map((frame) => (
        <rect
          className="compose-stage__output-boundary"
          data-frame-id={frame.frameId}
          data-testid={`stage-frame-boundary-${frame.frameId}`}
          fill="transparent"
          height={frame.height}
          key={frame.frameId}
          style={{ pointerEvents: 'none' }}
          width={frame.width}
          x={frame.x}
          y={frame.y}
        />
      ))}
      <line
        className="compose-stage__axis is-x"
        data-testid="stage-origin-x"
        x1="0"
        x2="100%"
        y1={worldOriginScreen.y}
        y2={worldOriginScreen.y}
      />
      <line
        className="compose-stage__axis is-y"
        data-testid="stage-origin-y"
        x1={worldOriginScreen.x}
        x2={worldOriginScreen.x}
        y1="0"
        y2="100%"
      />
      <g
        aria-hidden="true"
        className="compose-stage__world-origin"
        data-testid="stage-world-origin"
        transform={`translate(${
          worldOriginScreen.x - WORLD_ORIGIN_ICON_HALF_SIZE
        } ${
          worldOriginScreen.y - WORLD_ORIGIN_ICON_HALF_SIZE
        })`}
      >
        <path
          d="M6 0v4.42A4 4 0 0 0 4.42 6H0v4h4.42A4 4 0 0 0 6 11.58V16h4v-4.42A4 4 0 0 0 11.58 10H16V6h-4.42A4 4 0 0 0 10 4.42V0Z"
          data-testid="stage-world-origin-silhouette"
          fill="#20252d"
          fillOpacity="0.9"
        />
        <path
          d="M7 1v3a4 4 0 0 1 2 0V1Zm1 4a3 3 0 0 0 0 6 3 3 0 0 0 0-6ZM1 7v2h3a4 4 0 0 1 0-2H1Zm11 0a4 4 0 0 1 0 2h3V7Zm-5 8h2v-3a4 4 0 0 1-2 0Z"
          data-testid="stage-world-origin-position"
          fill="#a4acb7"
          fillOpacity="0.88"
        />
      </g>
    </svg>
  )
}
