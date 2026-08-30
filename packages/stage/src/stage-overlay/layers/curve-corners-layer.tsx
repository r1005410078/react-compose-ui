import { worldToScreen } from '@compose-ui/stage-engine'
import type { StagePoint } from '@compose-ui/stage-engine'
import type { StageOverlayContext } from '../overlay-types'

/**
 * 可见圆的半径（屏幕像素）。
 *
 * @remarks
 * 比顶点方块（8px）小一档：它是**附属于那个角**的调节点，不是又一个顶点。命中区不跟着缩，
 * 可见记号比靶区小是这块画布的既有做法。
 */
const HANDLE_RADIUS = 3.2

/** 命中圆的半径；与夹点同量级，手感一致。 */
const HANDLE_HIT_RADIUS = 9

/**
 * 半径为 0 时沿角平分线让开的屏幕距离。
 *
 * @remarks
 * 尖角时圆心与顶点重合，不让开的话手柄压在顶点上——那正是缩放手柄与顶点夹点所在的位置。
 * 这个下限对**很小但非零**的半径同样生效：那时手柄比真正的圆心更靠内一点，代价是几个像素
 * 的不精确，换来的是它一直抓得住。反解读的是指针落点而不是手柄画在哪，因此拖动仍然精确。
 */
const ZERO_RADIUS_INSET = 14

/**
 * 两个手柄之间至少要有的屏幕距离；靠得更近的那个**不画**。
 *
 * @remarks
 * 半径到顶时同一条边上的两个手柄落在同一点，两个叠在一起读不出是两个东西。做法是**抽稀**
 * 而不是整片隐藏——与网格投影间距不足时的判断同一条：拥挤的那一档恰恰是用户想动这个控件的
 * 那一档，全部收走等于「圆角一拖到顶就再也调不回来」，而画布上没有任何别的入口。四个手柄
 * 写的是同一个 `cornerRadius`，因此留下哪一个都给出相同的结果，抽稀不损失任何能力。
 */
const MIN_HANDLE_GAP = 12

/** 屏幕空间的单位向量；零向量退化成朝下，只可能出现在退化几何上。 */
function screenDirection(from: StagePoint, to: StagePoint) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  return length === 0 ? { x: 0, y: 1 } : { x: dx / length, y: dy / length }
}

/**
 * 圆角手柄层。
 *
 * @remarks
 * **选中即出**，与 Figma 一致：改圆角是最常做的调整之一，要求先进一个模式等于把它藏起来。
 *
 * 手柄画在**角弧的圆心**上——沿两条边各进一个切线长。这个位置不是随便选的：顶点到圆心的
 * 位移投影到角平分线上再乘半角正弦就是半径，因此拖动这件事本身就是在量它。
 *
 * 哪些角有手柄由宿主算好（`stageCurveCorners`）：本层不认识文档，也不知道「什么算曲线」。
 */
export function CurveCornersLayer({
  curveCorners,
  curveCornerPreview,
  viewport,
  onInteraction,
}: StageOverlayContext) {
  const corners = curveCorners ?? []
  /*
   * 拖动期间画一遍**圆角之后**的轮廓：文档要到松手那一刻才变，而矩形选中时画的是普通包围盒
   * ——盒不会跟着圆，用户看不见自己正在拖出什么。它由本层画而不是交给选区层，因为它是这次
   * 手势的反馈而不是选区的一部分：包围盒与八个手柄照旧在场，不该因为拖了一下圆角就消失。
   */
  const preview = curveCornerPreview && curveCornerPreview.length > 1
    ? curveCornerPreview
      .map((point) => worldToScreen(point, viewport))
      .map((point) => `${point.x},${point.y}`)
      .join(' ')
    : null

  // 预览与手柄各自独立成立：预览是**这次手势**的反馈，手柄拥挤与否与它无关。曾经它写在
  // 拥挤判断之后，于是半径拖到顶的那一刻预览连同手柄一起消失——而那正是用户在看结果的时候。
  if (corners.length === 0 && preview === null) return null

  const placed = corners.map((corner) => {
    const vertex = worldToScreen(corner.vertex, viewport)
    const center = worldToScreen(corner.point, viewport)
    const direction = screenDirection(vertex, worldToScreen(corner.inward, viewport))
    const distance = Math.max(Math.hypot(center.x - vertex.x, center.y - vertex.y), ZERO_RADIUS_INSET)
    return {
      corner,
      point: { x: vertex.x + direction.x * distance, y: vertex.y + direction.y * distance },
    }
  })

  // 抽稀：与已经留下的每一个都拉开 MIN_HANDLE_GAP 才画。贪心一遍即可——顺序是角的顺序，
  // 而抽稀只需要「屏幕上不出现两个叠在一起的记号」，不需要最优解。
  const visible: typeof placed = []
  for (const candidate of placed) {
    const crowded = visible.some(({ point }) => Math.hypot(
      point.x - candidate.point.x,
      point.y - candidate.point.y,
    ) < MIN_HANDLE_GAP)
    if (!crowded) visible.push(candidate)
  }

  return (
    <>
      {preview ? (
        <polyline
          className="compose-stage__selection-outline"
          data-testid="stage-curve-corner-preview"
          points={preview}
        />
      ) : null}
      {visible.map(({ corner, point }) => (
        <g key={`${corner.entityId}:${corner.index}`}>
          <circle
            className="compose-stage__curve-corner-hit"
            cx={point.x}
            cy={point.y}
            data-testid={`stage-curve-corner-hit-${corner.index}`}
            r={HANDLE_HIT_RADIUS}
            onPointerDown={(event) => onInteraction(
              { kind: 'curve-corner', entityId: corner.entityId, cornerIndex: corner.index },
              event,
            )}
          />
          <circle
            className="compose-stage__curve-corner-halo"
            cx={point.x}
            cy={point.y}
            r={HANDLE_RADIUS}
          />
          <circle
            className="compose-stage__curve-corner"
            cx={point.x}
            cy={point.y}
            data-testid={`stage-curve-corner-${corner.index}`}
            r={HANDLE_RADIUS}
          />
        </g>
      ))}
    </>
  )
}
