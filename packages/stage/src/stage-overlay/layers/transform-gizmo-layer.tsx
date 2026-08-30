import {
  STAGE_GIZMO_ARROW_LENGTH,
  STAGE_GIZMO_ARROW_WIDTH,
  STAGE_GIZMO_CENTER_RADIUS,
  STAGE_GIZMO_MOVE_HIT_WIDTH,
  STAGE_GIZMO_RING_HIT_WIDTH,
  STAGE_GIZMO_SCALE_HIT_SIZE,
  STAGE_GIZMO_SCALE_SIZE,
  type StageTransformGizmoAxis,
} from '@compose-ui/stage-engine'
import type { StageOverlayContext } from '../overlay-types'

const RADIANS_PER_DEGREE = Math.PI / 180

/** 箭头尖的三角形，沿轴方向。 */
function arrowHead(axis: StageTransformGizmoAxis) {
  const radians = axis.degrees * RADIANS_PER_DEGREE
  // 屏幕 Y 轴向下，因此方向向量的 y 取负。
  const dir = { x: Math.cos(radians), y: -Math.sin(radians) }
  const normal = { x: -dir.y, y: dir.x }
  const base = {
    x: axis.tip.x - dir.x * STAGE_GIZMO_ARROW_LENGTH,
    y: axis.tip.y - dir.y * STAGE_GIZMO_ARROW_LENGTH,
  }
  const point = (sign: number) =>
    `${base.x + normal.x * STAGE_GIZMO_ARROW_WIDTH * sign},${base.y + normal.y * STAGE_GIZMO_ARROW_WIDTH * sign}`
  return `${axis.tip.x},${axis.tip.y} ${point(1)} ${point(-1)}`
}

/**
 * 变换指示器的**旋转环**层。
 *
 * @remarks
 * 单独一层，只为一件事：它 MUST 排在四角缩放手柄**之下**。角正是用户预期抓到缩放手柄的地方，
 * 而环是一条必然穿过某些尺寸的四角的宽带。SVG 里绘制顺序就是命中顺序，因此重叠归谁由层序
 * 回答——上一版靠「环半径必须比选区外接圆大一段留白」去躲开这次碰撞，那条不变量只在环恰好
 * 擦过四角时起作用、平时无从验证，而它的代价是环不能有固定大小。
 *
 * 环画得细，命中靠一条透明加宽的 stroke 承担——与曲线的命中层是同一个做法。
 */
export function TransformGizmoRingLayer({ gizmo, onInteraction }: StageOverlayContext) {
  if (!gizmo) return null
  return (
    <g className="compose-stage__gizmo" data-testid="stage-transform-gizmo-ring-layer">
      <circle
        className="compose-stage__gizmo-ring"
        cx={gizmo.center.x}
        cy={gizmo.center.y}
        data-testid="stage-gizmo-ring"
        r={gizmo.ringRadius}
      />
      <circle
        className="compose-stage__gizmo-ring-hit"
        cx={gizmo.center.x}
        cy={gizmo.center.y}
        data-testid="stage-gizmo-ring-hit"
        r={gizmo.ringRadius}
        strokeWidth={STAGE_GIZMO_RING_HIT_WIDTH * 2}
        onPointerDown={(event) => onInteraction({ kind: 'gizmo-handle', handle: 'rotate' }, event)}
      />
    </g>
  )
}

/**
 * 变换指示器的**轴与基点**层：两条轴（各一支平移箭头 + 一个缩放方块）与中心圆点。
 *
 * @remarks
 * **四种形状对应四种语义**：箭头沿轴平移、方块沿轴缩放、圆环只改角度、圆点只标明「绕这里
 * 转」。两个东西长得一样而按下去做的事不同，是最难自己发现的一类缺陷——这与夹点按角色分三种
 * 形状是同一条规则，因此形状先分开、颜色只作二次编码。
 *
 * 中心圆点 v1 **不可拖**：它标明基点，改基点仍走 Inspector 的九宫格——既有决策明写「UI 只给
 * 九个锚点，但文档字段是自由二维点」，画布上自由拖会绕过那条约束。Rive 的 Origin 同样只能从
 * Inspector 或 Freeze 改，不能在图面上拖。因此它 `pointer-events: none`。
 *
 * **看得见的与抓得住的必须是同一段**：平移的命中带覆盖画出来的那条轴线（最里面 24px 除外，
 * 那一段属于对象本体），缩放的命中区比画出来的方块大一圈。曾经命中只覆盖环外那 22px、方块只有
 * 画出来的 10px，于是环（整圈 20px 宽的带）成了唯一抓得住的把手——用户读出来是「只有旋转能用」。
 *
 * 覆盖层根是 `pointer-events: none`，因此每个可交互元素都在样式表里显式打开。漏掉那一行的
 * 症状极具欺骗性：点击穿透到场景节点，「沿轴拖」退化成自由拖动。
 */
export function TransformGizmoLayer({ gizmo, onInteraction }: StageOverlayContext) {
  if (!gizmo) return null
  return (
    <g className="compose-stage__gizmo" data-testid="stage-transform-gizmo">
      {gizmo.axes.map((axis) => (
        <g
          className={`compose-stage__gizmo-axis compose-stage__gizmo-axis--${axis.axis}`}
          key={axis.axis}
        >
          <line
            className="compose-stage__gizmo-axis-line"
            x1={gizmo.center.x}
            x2={axis.tip.x}
            y1={gizmo.center.y}
            y2={axis.tip.y}
          />
          <polygon
            className="compose-stage__gizmo-axis-arrow"
            data-testid={`stage-gizmo-tip-${axis.axis}`}
            points={arrowHead(axis)}
          />
          <line
            className="compose-stage__gizmo-move-hit"
            data-testid={`stage-gizmo-move-${axis.axis}`}
            strokeWidth={STAGE_GIZMO_MOVE_HIT_WIDTH}
            x1={axis.moveHitStart.x}
            x2={axis.tip.x}
            y1={axis.moveHitStart.y}
            y2={axis.tip.y}
            onPointerDown={(event) => onInteraction(
              { kind: 'gizmo-handle', handle: axis.axis === 'x' ? 'move-x' : 'move-y' },
              event,
            )}
          />
          <rect
            className="compose-stage__gizmo-scale-handle"
            height={STAGE_GIZMO_SCALE_SIZE}
            width={STAGE_GIZMO_SCALE_SIZE}
            x={axis.scaleHandle.x - STAGE_GIZMO_SCALE_SIZE / 2}
            y={axis.scaleHandle.y - STAGE_GIZMO_SCALE_SIZE / 2}
          />
          {/* 命中区比画出来的方块大一圈，且排在平移命中带**之后**——两者在方块这一小块上重叠，
              后画的先收指针。 */}
          <rect
            className="compose-stage__gizmo-scale-hit"
            data-testid={`stage-gizmo-scale-${axis.axis}`}
            height={STAGE_GIZMO_SCALE_HIT_SIZE}
            width={STAGE_GIZMO_SCALE_HIT_SIZE}
            x={axis.scaleHandle.x - STAGE_GIZMO_SCALE_HIT_SIZE / 2}
            y={axis.scaleHandle.y - STAGE_GIZMO_SCALE_HIT_SIZE / 2}
            onPointerDown={(event) => onInteraction(
              { kind: 'gizmo-handle', handle: axis.axis === 'x' ? 'scale-x' : 'scale-y' },
              event,
            )}
          />
        </g>
      ))}
      <circle
        className="compose-stage__gizmo-center"
        cx={gizmo.center.x}
        cy={gizmo.center.y}
        data-testid="stage-gizmo-center"
        r={STAGE_GIZMO_CENTER_RADIUS}
      />
    </g>
  )
}
