import type { StagePoint } from '@compose-ui/stage-engine'
import type { StageFrameScreenBounds } from './stage-screen-geometry'

/** 世界原点图标的半边长；用于把 16×16 的图标中心对准原点。 */
const WORLD_ORIGIN_ICON_HALF_SIZE = 8

/**
 * 场景边界描边的宽度，单位是**屏幕** px。
 *
 * @remarks
 * 与样式表里的 `stroke-width` 是同一个数：这里用它把描边矩形整体外扩半个笔画宽，让笔画完全
 * 落在场景之外。两处对不上时症状是边界与场景之间露出一条缝或压掉半个像素的内容。
 */
const SCENE_OUTLINE_WIDTH = 1

/** 世界底图的 props。 */
export interface StageWorldUnderlayProps {
  /** 各块场景的屏幕边界。 */
  readonly frameBounds: readonly StageFrameScreenBounds[]
  /** 世界原点的屏幕坐标。 */
  readonly worldOriginScreen: StagePoint
}

/**
 * 画在 Scene 之下的世界底图：场景区域锚点、场景边界描边、原点轴线与原点图标。
 *
 * @remarks
 * 场景与容器共用同一条**内容**呈现管线：背景、圆角、阴影全部来自 Entity 自身的
 * `Appearance`，这一层不为场景补画任何内容装饰。
 *
 * **边界描边是例外，而且是必需的**：场景背景默认透明，用户也可以把它改成与工作区相同的
 * 颜色，此时场景在画布上除了标题标签之外没有任何边界——而"这块到哪里为止"正是用户判断
 * "我这一下点的是场景里面还是工作区空白"所需要的信息。它是 chrome：不写文档、不进布局求解
 * 的内容盒（那会把每个直接子级推离网格 1px）、不出现在预览与导出里。
 *
 * 锚点与描边**分成两个元素**：锚点的几何 MUST 与场景屏幕矩形逐像素相同（端到端用例拿它的
 * `boundingBox()` 当坐标基准），而描边会把包围盒撑大半个像素。描边整体外扩半个像素，使
 * 1px 的笔画完全落在场景之外——笔画跨在路径两侧，不外扩的话内侧那半像素会被场景自己的
 * 不透明背景盖掉，只剩半条线。
 *
 * `pointerEvents` 必须关掉，否则这一层会吞掉绘制工具在场景区域内的按下。
 */
export function StageWorldUnderlay({
  frameBounds,
  worldOriginScreen,
}: StageWorldUnderlayProps) {
  return (
    <svg aria-hidden="true" className="compose-stage__world-overlay">
      {frameBounds.map((frame) => (
        <g key={frame.frameId}>
          <rect
            className="compose-stage__output-boundary"
            data-frame-id={frame.frameId}
            data-testid={`stage-frame-boundary-${frame.frameId}`}
            fill="transparent"
            height={frame.height}
            style={{ pointerEvents: 'none' }}
            width={frame.width}
            x={frame.x}
            y={frame.y}
          />
          <rect
            className="compose-stage__scene-outline"
            data-testid={`stage-frame-outline-${frame.frameId}`}
            fill="none"
            height={frame.height + SCENE_OUTLINE_WIDTH}
            style={{ pointerEvents: 'none' }}
            width={frame.width + SCENE_OUTLINE_WIDTH}
            x={frame.x - SCENE_OUTLINE_WIDTH / 2}
            y={frame.y - SCENE_OUTLINE_WIDTH / 2}
          />
        </g>
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
