import { worldToScreen } from '@compose-ui/stage-engine'
import {
  LINE_ENDPOINT_HIT_RADIUS,
  PATH_INSERT_LENGTH,
  PATH_INSERT_THICKNESS,
  PATH_TANGENT_HANDLE_RADIUS,
  PATH_VERTEX_SIZE,
} from '../overlay-geometry'
import type { StageEditablePath, StageInteractionHit, StageViewport } from '@compose-ui/stage-engine'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { StageOverlayContext } from '../overlay-types'

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
  hotVertexId,
  onInteraction,
  path,
  viewport,
}: {
  readonly path: StageEditablePath
  readonly activeVertexId: string | null
  readonly hotVertexId: string | null
  readonly viewport: StageViewport
  readonly onInteraction: (
    hit: StageInteractionHit,
    event: ReactPointerEvent<Element>,
  ) => void
}) {
  const vertices = path.vertices.map((vertex) => ({
    id: vertex.id,
    mode: vertex.mode,
    role: vertex.role ?? 'keyframe',
    angle: vertex.angle ?? 0,
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
        // 命中圆排在可见菱形**之前**：悬停态靠 `:hover +` 邻接选择器读它，纯 CSS 因此不必为
        // 一个视觉反馈引入每帧 `pointermove` 都要写的 React 状态。菱形是 `pointer-events:
        // none`，排在命中圆之后不改变**可命中元素**之间的先后，切线仍然优先于顶点。
        <g key={`vertex:${vertex.id}`}>
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
          {/*
            * 形状按角色分：既有自由度画方块，插入位置画一条沿段方向的条形。两个夹点长得
            * 一样而按下去做的事不同，是最难自己发现的一类缺陷。
            *
            * 菱形留给运动路径——它的理由是「与时间线关键帧同形」，而那条理由只在那里成立：
            * 那里的顶点**就是**关键帧，曲线的顶点不是。角色缺省即 `vertex`，因此宿主传入的
            * 运动路径一行不改地继续画菱形。
            */}
          <rect
            className="compose-stage__editable-path-vertex"
            data-testid={`stage-path-vertex-${vertex.id}`}
            data-vertex-active={vertex.id === activeVertexId || undefined}
            data-vertex-hot={vertex.id === hotVertexId || undefined}
            data-vertex-mode={vertex.mode}
            data-vertex-role={vertex.role}
            height={vertex.role === 'insert' ? PATH_INSERT_THICKNESS : PATH_VERTEX_SIZE}
            transform={`rotate(${
              vertex.role === 'insert' ? vertex.angle : vertex.role === 'keyframe' ? 45 : 0
            } ${vertex.screen.x} ${vertex.screen.y})`}
            width={vertex.role === 'insert' ? PATH_INSERT_LENGTH : PATH_VERTEX_SIZE}
            x={vertex.screen.x - (vertex.role === 'insert' ? PATH_INSERT_LENGTH : PATH_VERTEX_SIZE) / 2}
            y={vertex.screen.y - (vertex.role === 'insert' ? PATH_INSERT_THICKNESS : PATH_VERTEX_SIZE) / 2}
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

/**
 * 可编辑路径层。
 *
 * @remarks
 * 绘制顺序排在变换手柄**之上**：关键帧顶点常与对象角点重合，压在手柄之下将永远拖不动。
 * 吸附参考线等瞬时反馈仍渲染在其后（最上层）。
 */
export function EditablePathContribution({
  activePathVertexId = null,
  editablePath = null,
  hotPathVertexId = null,
  viewport,
  onInteraction,
}: StageOverlayContext) {
  if (!editablePath) return null
  return (
    <EditablePathLayer
      activeVertexId={activePathVertexId}
      hotVertexId={hotPathVertexId}
      path={editablePath}
      viewport={viewport}
      onInteraction={onInteraction}
    />
  )
}
