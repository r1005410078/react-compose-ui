import {
  composeArcEndpoints,
  composeArcMidpoint,
  flattenComposeArc,
  getComposeCurve,
  isComposeFullCircle,
  projectComposeCurveToBox,
  translateComposeCurve,
} from '@compose-ui/core'
import type { ComposeArcCurve, ComposeCurve, ComposeDocument, ComposePosition } from '@compose-ui/core'
import { applyMatrix, invertMatrix } from '../geometry'
import type { StagePoint } from '../geometry'
import type { StageSceneIndex } from '../hit-testing'

/**
 * 一个可拖的夹点。
 *
 * @remarks
 * `id` 对 Stage 与交互内核都是不透明字符串，原样回传；只有本模块解释它对应哪个自由度。
 * @public
 */
export interface StageCurveGrip {
  readonly id: string
  /** 世界坐标。 */
  readonly point: StagePoint
}

/** 弧夹点的稳定 id。 */
const ARC_CENTER = 'center'
const ARC_MID = 'mid'
const START = 'start'
const END = 'end'

/**
 * 直线中点的平移夹点 id。
 *
 * @remarks
 * 刻意**不**叫 `mid`：那个词在弧上表示「改半径」。两个含义不同的自由度共用一个 id 时，
 * 按 id 查表的调用方（导线那张「哪个夹点承载绑定」的表就是）必须先拿到 kind 才读得出来，
 * 而它们手上只有 id。
 */
const MOVE = 'move'

/** 多段线顶点 id 的前缀；下标即顺序。 */
const VERTEX_PREFIX = 'v'

const TO_DEGREES = 180 / Math.PI

/** `ComposePosition` 带 JSON 索引签名，接口类型的点要经字面量才能赋进去。 */
const position = (point: StagePoint): ComposePosition => ({ x: point.x, y: point.y })

function angleOf(center: StagePoint, point: StagePoint) {
  return Math.atan2(point.y - center.y, point.x - center.x) * TO_DEGREES
}

/**
 * 把差角归一化到与既有扫掠角同号的区间。
 *
 * @remarks
 * 恰好归一化到 0 时取整圈：用户把终点拖回起点，看得见的结果是整圆，而空弧什么都画不出来。
 */
function normalizeSweep(delta: number, sign: number) {
  const raw = ((delta % 360) + 360) % 360
  if (sign >= 0) return raw === 0 ? 360 : raw
  return raw === 0 ? -360 : raw - 360
}

/**
 * 盒局部几何的夹点。
 *
 * @remarks
 * **与特征点捕捉的候选刻意不同**：特征点是捕捉目标（含弧的象限点与各段中点），夹点是可拖的
 * 把手。象限点不是弧的自由度，出在这里会变成能拖却拖不动任何东西的假手柄。
 */
function localGrips(curve: ComposeCurve): readonly StageCurveGrip[] {
  if (curve.kind === 'line') {
    // 中点夹点表达的是「按中点捕捉着移动」，而不是盒拖动的第二个入口：盒拖动走
    // `snapTranslation`，吸的是其他 Entity 的包围盒参考线且逐轴独立；这里走落点解算，
    // 吸的是二维特征点，带 `port > endpoint > midpoint > center > quadrant` 的优先级与
    // 捕捉标记。多段线的段中点**留给顶点增删**，因此这里只有直线有。
    const mid = { x: (curve.start.x + curve.end.x) / 2, y: (curve.start.y + curve.end.y) / 2 }
    return [
      { id: START, point: curve.start },
      { id: MOVE, point: mid },
      { id: END, point: curve.end },
    ]
  }
  if (curve.kind === 'polyline') {
    return curve.vertices.map((point, index) => ({ id: `${VERTEX_PREFIX}${index}`, point }))
  }
  const center = { id: ARC_CENTER, point: curve.center }
  const mid = { id: ARC_MID, point: composeArcMidpoint(curve) }
  // 整圆的起点与终点落在同一个像素上，两个含义不同的夹点叠在那里时拖到哪个全凭渲染顺序；
  // 而「改整圆的起始角」在屏幕上根本看不见。
  if (isComposeFullCircle(curve)) return [center, mid]
  const [start, end] = composeArcEndpoints(curve)
  return [center, { id: START, point: start }, { id: END, point: end }, mid]
}

/** 盒局部几何的轮廓点；弧按弦高拍扁，多段线与直线本来就是折线。 */
function localOutline(curve: ComposeCurve): readonly StagePoint[] {
  if (curve.kind === 'line') return [curve.start, curve.end]
  if (curve.kind === 'polyline') {
    return curve.closed && curve.vertices.length > 0
      ? [...curve.vertices, curve.vertices[0]!]
      : curve.vertices
  }
  const segments = flattenComposeArc(curve)
  return segments.length === 0
    ? []
    : [segments[0]!.start, ...segments.map((segment) => segment.end)]
}

/**
 * 一个 Entity 画出来的那条曲线，已投影进盒坐标系。
 *
 * @remarks
 * 与命中、捕捉应用**同一个盒到几何的变换**（`projectComposeCurveToBox`）：各算一遍的话，
 * 盒被拉宽之后夹点会停在旧位置，而线已经画到别处去了。
 *
 * @returns 不是曲线或缺少布局盒时返回 `null`。
 * @public
 */
export function stageCurveBoxGeometry(
  document: ComposeDocument,
  index: StageSceneIndex,
  entityId: string,
): ComposeCurve | null {
  const entity = document.entities[entityId]
  const curve = entity ? getComposeCurve(entity) : null
  const box = index.layoutSnapshot.boxes[entityId]
  return curve && box ? projectComposeCurveToBox(curve, box) : null
}

/**
 * 派生一个 Entity 的世界坐标夹点。
 *
 * @param override - 盒局部几何的替代品；拖动期间传入预览几何，夹点因此跟手而文档不动。
 * @returns 不是曲线或缺少布局盒时返回空数组。
 * @public
 */
export function stageCurveGrips(
  document: ComposeDocument,
  index: StageSceneIndex,
  entityId: string,
  override?: ComposeCurve | null,
): readonly StageCurveGrip[] {
  const curve = override ?? stageCurveBoxGeometry(document, index, entityId)
  const matrix = index.getWorldMatrix(entityId)
  if (!curve || !matrix) return []
  return localGrips(curve).map(({ id, point }) => ({ id, point: applyMatrix(matrix, point) }))
}

/**
 * 派生一个 Entity 的世界坐标轮廓折线。
 *
 * @remarks
 * 拖动期间文档还没有变，画布上那条线仍停在原处；轮廓让用户看见**松手之后会是什么样子**。
 *
 * @param override - 同 {@link stageCurveGrips}。
 * @public
 */
export function stageCurveOutline(
  document: ComposeDocument,
  index: StageSceneIndex,
  entityId: string,
  override?: ComposeCurve | null,
): readonly StagePoint[] {
  const curve = override ?? stageCurveBoxGeometry(document, index, entityId)
  const matrix = index.getWorldMatrix(entityId)
  if (!curve || !matrix) return []
  return localOutline(curve).map((point) => applyMatrix(matrix, point))
}

/**
 * 把一个盒局部落点应用到某个夹点上。
 *
 * @remarks
 * 弧的每个夹点**只改一个自由度，另一端一动不动**：拖起点而终点跟着跑是最容易写出来也最难用
 * 的版本——用户拖的是这一端，另一端凭什么动。
 *
 * @returns 夹点 id 不属于这条曲线时返回 `null`，调用方据此放弃这次写入。
 * @public
 */
export function applyStageCurveGrip(
  curve: ComposeCurve,
  gripId: string,
  point: StagePoint,
): ComposeCurve | null {
  if (curve.kind === 'line') {
    if (gripId === START) return { ...curve, start: position(point) }
    if (gripId === END) return { ...curve, end: position(point) }
    if (gripId === MOVE) {
      // 位移按**中点**到落点算，因此落点被捕捉纠正过之后中点精确落在那个特征点上；
      // 两端同步平移，长度与方向一个都不动。
      return translateComposeCurve(
        curve,
        point.x - (curve.start.x + curve.end.x) / 2,
        point.y - (curve.start.y + curve.end.y) / 2,
      )
    }
    return null
  }
  if (curve.kind === 'polyline') {
    if (!gripId.startsWith(VERTEX_PREFIX)) return null
    const target = Number(gripId.slice(VERTEX_PREFIX.length))
    if (!Number.isInteger(target) || target < 0 || target >= curve.vertices.length) return null
    return {
      ...curve,
      vertices: curve.vertices.map(
        (vertex, index) => (index === target ? position(point) : vertex),
      ),
    }
  }
  return applyArcGrip(curve, gripId, point)
}

function applyArcGrip(
  curve: ComposeArcCurve,
  gripId: string,
  point: StagePoint,
): ComposeArcCurve | null {
  if (gripId === ARC_CENTER) return { ...curve, center: position(point) }
  if (gripId === ARC_MID) {
    const radius = Math.hypot(point.x - curve.center.x, point.y - curve.center.y)
    // 半径归零的弧画不出东西，也再没有夹点可以把它拉回来。
    return radius > 0 ? { ...curve, radius } : null
  }
  if (gripId === START) {
    const startAngle = angleOf(curve.center, point)
    // 终止角不变，因此终点一动不动；扫掠角跟着改。
    const sweep = normalizeSweep(curve.startAngle + curve.sweep - startAngle, curve.sweep)
    return { ...curve, startAngle, sweep }
  }
  if (gripId === END) {
    return {
      ...curve,
      sweep: normalizeSweep(angleOf(curve.center, point) - curve.startAngle, curve.sweep),
    }
  }
  return null
}

/**
 * 把世界落点换算进 Entity 的盒局部坐标。
 *
 * @remarks
 * 用**完整**的世界矩阵求逆，因此旋转过的曲线也落在正确的位置上。
 * @public
 */
export function stageCurveLocalPoint(
  index: StageSceneIndex,
  entityId: string,
  world: StagePoint,
): StagePoint | null {
  const matrix = index.getWorldMatrix(entityId)
  return matrix ? applyMatrix(invertMatrix(matrix), world) : null
}
