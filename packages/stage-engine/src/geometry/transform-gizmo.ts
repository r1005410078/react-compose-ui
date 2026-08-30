import { worldToScreen, type StagePoint, type StageViewport } from './stage-geometry'

/*
 * 变换指示器的几何。
 *
 * 全部尺寸是**屏幕**尺寸，环半径在内：指示器是 chrome，不是画布上的内容。跟着画布缩放变粗
 * 变长会让它在放大时盖住半张图、缩小时小到点不中；跟着**选区大小**走则会让它随对象无限长大
 * ——一个 220×150 的盒子就把环推到 149、箭头推到 199，转过 90° 之后箭头落到图面之外。
 * 这与十字光标臂长、拾取框、夹点靶区是同一条既有约定。
 *
 * 一条轴上从内到外依次是：缩放方块 → 圆环 → 平移箭头。
 */

/**
 * 旋转圆环的半径（屏幕 px）。
 *
 * @remarks
 * 固定值，**不跟选区大小走**。推论是大对象上环会压在本体上：它是一条以环线为中心向两侧各
 * 展开 {@link STAGE_GIZMO_RING_HIT_WIDTH} 的命中带，落在带上的拖动是旋转而不是移动。这是
 * 屏幕恒定的代价，是接受而不是遗漏——躲开它的唯一办法是让环跟着选区走，而那样指示器就没有
 * 固定的大小了。带以外的对象本体照旧是移动，两条轴也仍然给出受约束的移动。
 *
 * 四角的缩放手柄不受影响：它们由**层序**压在环之上（环单独一层、排在手柄之下），而不是靠
 * 常量之间的大小关系躲开环。
 *
 * @public
 */
export const STAGE_GIZMO_RING_RADIUS = 80

/** 圆环命中带的半宽（屏幕 px）；环本身画得细，靶区要够抓。 @public */
export const STAGE_GIZMO_RING_HIT_WIDTH = 10

/**
 * 缩放方块中心到指示器中心的距离（屏幕 px）。
 *
 * @remarks
 * MUST 让开环的命中带内沿（`80 - 10 = 70`）加上方块的半边长：方块坐进带里的话，按下去开始
 * 的是旋转而不是缩放。52 + 5 = 57，净空 13px。
 *
 * @public
 */
export const STAGE_GIZMO_SCALE_DISTANCE = 52

/** 缩放方块的边长（屏幕 px）。 @public */
export const STAGE_GIZMO_SCALE_SIZE = 10

/**
 * 缩放方块的命中区边长（屏幕 px）。
 *
 * @remarks
 * 比画出来的方块大一圈：10px 的靶子偏两三个像素就落到对象本体上，于是变成一次自由拖动——
 * 用户看到对象跑了但没缩放，读出来是「缩放不行」。加宽命中区与环、与曲线的透明加宽 stroke
 * 是同一个既有做法。
 *
 * 它 MUST 仍然让开环的命中带内沿（`80 - 10 = 70`）：`52 + 11 = 63`，净空 7px。
 *
 * @public
 */
export const STAGE_GIZMO_SCALE_HIT_SIZE = 22

/**
 * 平移箭头命中带的宽度（屏幕 px）。
 *
 * @remarks
 * 命中区 MUST 覆盖**整条画出来的轴线**，从中心一直到箭头尖。曾经只覆盖环外那一段（理由是
 * 「整条线接管等于在对象上划出两条走廊」），代价是画出来 112px、抓得住 22px——用户按在看得见
 * 的线上却拖不动，读出来就是「x 轴不能移动」。**看得见的和抓得住的必须是同一段**；这条比走廊
 * 那条重要得多，而走廊本身与已经接受的「环压在本体上」是同一类取舍：本体上除这两条 20px 宽的
 * 带以外照旧是自由移动。
 *
 * @public
 */
export const STAGE_GIZMO_MOVE_HIT_WIDTH = 20

/**
 * 平移命中带的起点到中心的距离（屏幕 px）。
 *
 * @remarks
 * 只让开**最里面**这一小段，它属于对象本体：两条轴的命中带在中心交叉，一路盖到中心的话，
 * 「按住对象中间拖」——这块画布上最常用的一个手势，也是自动记录位置关键帧的主要入口——就变成
 * 了受轴约束的移动。中心那里还压着指示器的基点圆点与运动路径的关键帧顶点（靶区半径 8）。
 *
 * 24 之外的 88px 全部可抓，与画出来的线基本重合；用户按在线的中段一定拖得动，按在圆点上则
 * 仍然是自由移动，这与「圆点标的是这个对象」读起来是一致的。
 *
 * @public
 */
export const STAGE_GIZMO_MOVE_HIT_START = 24

/** 箭头尖到指示器中心的距离（屏幕 px）；MUST 大于环半径，箭头因此在环之外。 @public */
export const STAGE_GIZMO_AXIS_LENGTH = 112

/** 箭头三角形的长度（屏幕 px）。 @public */
export const STAGE_GIZMO_ARROW_LENGTH = 10

/** 箭头三角形的半宽（屏幕 px）。 @public */
export const STAGE_GIZMO_ARROW_WIDTH = 5

/** 中心圆点的半径（屏幕 px）。 @public */
export const STAGE_GIZMO_CENTER_RADIUS = 4

/** 指示器的一条轴。 @public */
export interface StageTransformGizmoAxis {
  readonly axis: 'x' | 'y'
  /** 方向角（度），与 `距离<角度` 坐标写法同一套约定：逆时针为正、屏幕 Y 向下。 */
  readonly degrees: number
  /** 缩放方块的中心，屏幕坐标。 */
  readonly scaleHandle: StagePoint
  /** 平移命中带的起点，屏幕坐标；最里面一小段留给对象本体。 */
  readonly moveHitStart: StagePoint
  /** 箭头尖，屏幕坐标。 */
  readonly tip: StagePoint
}

/** 一次指示器呈现所需的全部几何，均为屏幕坐标。 @public */
export interface StageTransformGizmoGeometry {
  readonly center: StagePoint
  readonly axes: readonly [StageTransformGizmoAxis, StageTransformGizmoAxis]
  readonly ringRadius: number
}

const RADIANS_PER_DEGREE = Math.PI / 180

/** 屏幕 Y 轴向下，因此方向向量的 y 取负——与 `angleDegrees` 是同一套约定的反向。 */
function along(origin: StagePoint, degrees: number, distance: number): StagePoint {
  const radians = degrees * RADIANS_PER_DEGREE
  return {
    x: origin.x + Math.cos(radians) * distance,
    y: origin.y - Math.sin(radians) * distance,
  }
}

/**
 * 求一次变换指示器的屏幕几何。
 *
 * @remarks
 * 纯函数：输入是中心的**世界**坐标、X 轴的方向角与当前视口，输出可以直接画。它不认识文档，
 * 也不知道这个中心是基点还是包围盒中心——那一步由 `resolveTransformGizmoTarget` 回答。
 *
 * Y 轴恒为 X 轴加 90°：两条轴始终正交，对象的非等比缩放不改变 `rotation`，因此不需要分别算。
 *
 * 除中心之外**不读任何与选区大小有关的东西**：指示器的尺寸是屏幕常量，见本文件头部。
 *
 * @param options.center - 指示器中心的世界坐标。
 * @param options.degrees - X 轴方向角；多选时传 0（轴对齐）。
 * @param options.viewport - 当前视口。
 * @public
 */
export function transformGizmoGeometry(options: {
  readonly center: StagePoint
  readonly degrees: number
  readonly viewport: StageViewport
}): StageTransformGizmoGeometry {
  const center = worldToScreen(options.center, options.viewport)
  const axis = (kind: 'x' | 'y', degrees: number): StageTransformGizmoAxis => ({
    axis: kind,
    degrees,
    scaleHandle: along(center, degrees, STAGE_GIZMO_SCALE_DISTANCE),
    moveHitStart: along(center, degrees, STAGE_GIZMO_MOVE_HIT_START),
    tip: along(center, degrees, STAGE_GIZMO_AXIS_LENGTH),
  })
  return {
    center,
    axes: [axis('x', options.degrees), axis('y', options.degrees + 90)],
    ringRadius: STAGE_GIZMO_RING_RADIUS,
  }
}

/**
 * 把一条轴的方向角归到最近的正方向缩放手柄。
 *
 * @remarks
 * 缩放走的是既有的 resize 会话，而它的把手是**世界轴对齐**的四个方向——非曲线 Entity 的旋转
 * 仍用 AABB，这是一处明写的既有欠账。归到最近的正方向让**拖动方向与箭头方向一致**：对象转过
 * 180° 时它的 +X 指向屏幕左，此时该拖的是 `w` 而不是 `e`。
 *
 * 未旋转时精确；旋转到 45° 附近时缩放轴与画出来的轴对不上，那是上面那条欠账的可见形态，
 * 不是本函数的近似造成的。
 *
 * @public
 */
export function gizmoScaleHandle(degrees: number): 'e' | 'n' | 'w' | 's' {
  const quadrant = ((Math.round(degrees / 90) % 4) + 4) % 4
  return (['e', 'n', 'w', 's'] as const)[quadrant]!
}
