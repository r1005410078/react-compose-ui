import {
  clampComposeCornerRadius,
  composeArcEndpoints,
  composeArcMidpoint,
  composePathCubics,
  flattenComposeCubic,
  composeCornerArcCenter,
  composeCornerRadiusAt,
  composePolylineCornerFrames,
  composePolylineOutline,
  flattenComposeArc,
  flattenComposeOutline,
  getComposeCurve,
  isComposeFullCircle,
  projectComposeCurveToBox,
  translateComposeCurve,
} from '@compose-ui/core'
import type {
  ComposeArcCurve,
  ComposeCubicSegment,
  ComposeCurve,
  ComposePathCurve,
  ComposeSubpath,
  ComposeDocument,
  ComposeLayoutSnapshot,
  ComposePolylineCurve,
  ComposePosition,
} from '@compose-ui/core'
import { applyMatrix, invertMatrix } from '../geometry'
import type { StageMatrix, StagePoint } from '../geometry'

/**
 * 派生曲线几何所需的最小场景来源。
 *
 * @remarks
 * 刻意**不要求整个 `StageSceneIndex`**（它结构上满足本接口）：手势预览期间选区 chrome 必须
 * 跟着对象一起走，而场景索引读的是已提交文档；为每一帧预览重建一份全场景索引是一次整棵树的
 * 遍历，而这里只需要目标那一个 Entity 的盒与世界矩阵。与 `StageTransformGizmoSource` 是同一
 * 条判断，也是同一个理由。
 *
 * 文档与索引**合成一个参数**而不是并列两个：并列时「一处传预览、另一处传已提交」是写得出来
 * 的，而那正是曾经的缺陷本身——选区盒跟着手势走，曲线的轮廓与圆角手柄还留在原来的位置。
 *
 * @public
 */
export interface StageCurveGeometrySource {
  /** 读 `Curve` Component 的文档；手势期传预览文档。 */
  readonly document: ComposeDocument
  /** 与 {@link StageCurveGeometrySource.document} 对应的布局快照。 */
  readonly layoutSnapshot: ComposeLayoutSnapshot
  /** 查询 Entity 完整世界矩阵；缺失 Entity 返回 null。 */
  getWorldMatrix(entityId: string): StageMatrix | null
}

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
  /**
   * 呈现角色。
   *
   * @remarks
   * `vertex` 移动一个点，`segment` 平移它所在的那一整段。两者长得一样而按下去做的事不同，
   * 是最难自己发现的一类缺陷，因此角色由派生这一侧给出，渲染层照它画形状即可，不必认识
   * 多段线。
   */
  readonly role: StageCurveGripRole
  /**
   * 方向角（度），只有 `segment` 才有。
   *
   * @remarks
   * 由这里给出而不是让渲染层从邻居推算：渲染层拿到的是一串**扁平的顶点**，它不知道谁和谁
   * 相邻，更不知道闭合多段线的收尾段接的是第一个顶点。
   *
   * 是**世界角度**，而 Stage 的视口只有平移与缩放、没有旋转，因此它等于屏幕角度。将来若给
   * 视口加了旋转，这里是会静默错位的地方之一。
   */
  readonly angle?: number
  /**
   * 这个顶点两侧的贝塞尔控制点，世界坐标；`null` 表示该侧没有。
   *
   * @remarks
   * 只有 `path` 的顶点有。它们**复用既有可编辑路径的切线手柄**——那条通道本来就画「一个小圆
   * 加一根连到顶点的杆」，并且只在活动顶点上显形，与「手柄只画正在被会话作用着的那个顶点的」
   * 逐字是同一件事。为控制点另造一套夹点等于把同一个东西画两遍。
   *
   * 一条导入来的路径有几十个顶点，手柄全画就是几十根杆糊在图形上；显形由呈现层按活动顶点
   * 决定，因此这里恒给出，不做筛选。
   */
  readonly inTangent?: StagePoint | null
  readonly outTangent?: StagePoint | null
}

/** 夹点的呈现角色。 @public */
export type StageCurveGripRole = 'vertex' | 'segment'

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

/**
 * 多段线段中点 id 的前缀；下标即**段**的顺序（第 i 段从顶点 i 连到顶点 i+1）。
 *
 * @remarks
 * 与顶点用不同前缀：求解要按 id 分派到两种完全不同的操作（移动一个既有顶点 / 平移一整段），
 * 而它手上只有 id。
 */
const SEGMENT_PREFIX = 'm'

/**
 * `path` 夹点的 id 形状。
 *
 * @remarks
 * 顶点是 `p{子路径}v{点}`，两侧的控制点是同一个 id **加一个后缀**（`i` 入向、`o` 出向）。
 * 后缀式而不是另起一套编号，是因为可编辑路径把切线手势报成「顶点 id + 哪一侧」，而求解手上
 * 只有一个 id：后缀让这个反查是一次字符串匹配，不需要第二张表。
 */
const PATH_VERTEX = /^p(\d+)v(\d+)$/
const PATH_TANGENT = /^p(\d+)v(\d+)([io])$/

/** 一条子路径上的顶点序列：起点加每段的终点。 */
function subpathPoints(subpath: ComposeSubpath): readonly ComposePosition[] {
  return [subpath.start, ...subpath.segments.map((segment) => segment.to)]
}

/** 解析 `path` 夹点 id 指向的顶点，以及它是不是某一侧的控制点。 */
function parsePathGripId(gripId: string): {
  readonly subpath: number
  readonly point: number
  readonly side: 'in' | 'out' | null
} | null {
  const vertex = PATH_VERTEX.exec(gripId)
  if (vertex) return { subpath: Number(vertex[1]), point: Number(vertex[2]), side: null }
  const tangent = PATH_TANGENT.exec(gripId)
  if (!tangent) return null
  return {
    subpath: Number(tangent[1]),
    point: Number(tangent[2]),
    side: tangent[3] === 'i' ? 'in' : 'out',
  }
}

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
  const vertex = (id: string, point: StagePoint): StageCurveGrip => ({ id, point, role: 'vertex' })
  if (curve.kind === 'path') return pathGrips(curve)
  if (curve.kind === 'line') {
    // 中点夹点表达的是「按中点捕捉着移动」，而不是盒拖动的第二个入口：盒拖动走
    // `snapTranslation`，吸的是其他 Entity 的包围盒参考线且逐轴独立；这里走落点解算，
    // 吸的是二维特征点，带 `port > endpoint > midpoint > center > quadrant` 的优先级与
    // 捕捉标记。两点直线只有一段，因此它与多段线的段中点是**同一句话**的退化情形。
    return [
      vertex(START, curve.start),
      segmentGrip(MOVE, curve.start, curve.end),
      vertex(END, curve.end),
    ]
  }
  if (curve.kind === 'polyline') {
    return [
      ...curve.vertices.map((point, index) => vertex(`${VERTEX_PREFIX}${index}`, point)),
      ...polylineSegments(curve.vertices, curve.closed).map(
        ({ start, end }, index) => segmentGrip(`${SEGMENT_PREFIX}${index}`, start, end),
      ),
    ]
  }
  const center = vertex(ARC_CENTER, curve.center)
  const mid = vertex(ARC_MID, composeArcMidpoint(curve))
  // 整圆的起点与终点落在同一个像素上，两个含义不同的夹点叠在那里时拖到哪个全凭渲染顺序；
  // 而「改整圆的起始角」在屏幕上根本看不见。
  if (isComposeFullCircle(curve)) return [center, mid]
  const [start, end] = composeArcEndpoints(curve)
  return [center, vertex(START, start), vertex(END, end), mid]
}

/** 一段的中点夹点：位置是中点，方向角是这一段的走向。 */
function segmentGrip(id: string, start: StagePoint, end: StagePoint): StageCurveGrip {
  return {
    id,
    point: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    role: 'segment',
    angle: Math.atan2(end.y - start.y, end.x - start.x) * TO_DEGREES,
  }
}

/**
 * `path` 的夹点：一个顶点一个方块，两侧的控制点挂在它身上。
 *
 * @remarks
 * 控制点走既有可编辑路径的切线通道，因此显形由呈现层按活动顶点决定——一条导入来的路径有几十
 * 个顶点，手柄全画就是几十根杆糊在图形上。
 *
 * **刻意不按悬停显形**：手柄画在离顶点一段距离的地方，鼠标从顶点移过去的路上就已经离开了
 * 顶点，手柄会在够到之前消失，那样它永远抓不住。活动顶点是既有会话本来就有的一档，且它是
 * 用户显式做出的选择。
 */
function pathGrips(curve: ComposePathCurve): readonly StageCurveGrip[] {
  return curve.subpaths.flatMap((subpath, subpathIndex) => (
    subpathPoints(subpath).map((point, index): StageCurveGrip => ({
      id: `p${subpathIndex}v${index}`,
      point,
      role: 'vertex',
      // 入向控制点在前一段的 `c2` 上，出向在这一段的 `c1` 上；开放子路径的首尾各只有一侧。
      inTangent: subpath.segments[index - 1]?.c2 ?? null,
      outTangent: subpath.segments[index]?.c1 ?? null,
    }))
  ))
}

/**
 * 多段线的段列表。
 *
 * @remarks
 * 闭合时**包含收尾那一段**（最后一个顶点连回第一个）：它在屏幕上与其他段没有任何区别，
 * 漏掉它会让一条闭合折线上恰好少一个可抓的位置，而用户看不出为什么。
 */
function polylineSegments(
  vertices: readonly { readonly x: number; readonly y: number }[],
  closed: boolean,
): readonly { readonly start: StagePoint; readonly end: StagePoint }[] {
  const segments: { readonly start: StagePoint; readonly end: StagePoint }[] = []
  for (let index = 0; index + 1 < vertices.length; index += 1) {
    segments.push({ start: vertices[index]!, end: vertices[index + 1]! })
  }
  const first = vertices[0]
  const last = vertices[vertices.length - 1]
  if (closed && first && last && vertices.length > 2) segments.push({ start: last, end: first })
  return segments
}

/** 盒局部几何的轮廓点；弧按弦高拍扁，多段线与直线本来就是折线。 */
function localOutline(curve: ComposeCurve): readonly StagePoint[] {
  if (curve.kind === 'line') return [curve.start, curve.end]
  if (curve.kind === 'path') {
    // 轮廓与命中、框选读的是**同一条**展开：各拍各的会让选中框贴不住画出来的形状。
    const segments = composePathCubics(curve).flatMap(flattenComposeCubic)
    const first = segments[0]
    return first ? [first.start, ...segments.map(({ end }) => end)] : []
  }
  if (curve.kind === 'polyline') {
    // 有圆角时轮廓必须跟着圆——它与渲染读的是同一列片段，各画各的会让选区框在角上露出
    // 一个尖，而形状本身是圆的。
    if (curve.cornerRadius) {
      const segments = flattenComposeOutline(composePolylineOutline(curve))
      const first = segments[0]
      if (first) return [first.start, ...segments.map(({ end }) => end)]
    }
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
  source: StageCurveGeometrySource,
  entityId: string,
): ComposeCurve | null {
  const entity = source.document.entities[entityId]
  const curve = entity ? getComposeCurve(entity) : null
  const box = source.layoutSnapshot.boxes[entityId]
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
  source: StageCurveGeometrySource,
  entityId: string,
  override?: ComposeCurve | null,
): readonly StageCurveGrip[] {
  const curve = override ?? stageCurveBoxGeometry(source, entityId)
  const matrix = source.getWorldMatrix(entityId)
  if (!curve || !matrix) return []
  return localGrips(curve).map((grip) => ({
    ...grip,
    point: applyMatrix(matrix, grip.point),
    // 切线端点与顶点走同一个矩阵：各变换各的会让杆在旋转过的曲线上指错方向。
    ...(grip.inTangent ? { inTangent: applyMatrix(matrix, grip.inTangent) } : null),
    ...(grip.outTangent ? { outTangent: applyMatrix(matrix, grip.outTangent) } : null),
  }))
}

/**
 * 端点夹点的**相邻顶点**，世界坐标。
 *
 * @remarks
 * 只对开放几何的两个端点有值：直线的 `start` 对 `end`、`end` 对 `start`，开放多段线的第一个
 * 顶点对第二个、最后一个对倒数第二个。其余夹点（内部顶点、段中点、弧、闭合多段线、`path`）
 * 一律 `null`——它们没有唯一的「上一点」可言。
 *
 * 它回答的是「拖这个端点时方向从哪里量」：画线时角度约束相对**上一点**生效，而端点在顶点
 * 模式里的上一点就是它相邻的那个顶点。从端点自己的原位置量，正交只能让它沿出发方向走。
 *
 * id 语法住在本模块，因此这个反查也住在这里：调用方手上只有 id，不该自己拆 `v{下标}`。
 *
 * @public
 */
export function stageCurveGripNeighbor(
  source: StageCurveGeometrySource,
  entityId: string,
  gripId: string,
): StagePoint | null {
  const curve = stageCurveBoxGeometry(source, entityId)
  const matrix = source.getWorldMatrix(entityId)
  if (!curve || !matrix) return null
  const local = localGripNeighbor(curve, gripId)
  return local ? applyMatrix(matrix, local) : null
}

/** 盒局部坐标里的相邻顶点；见 {@link stageCurveGripNeighbor}。 */
function localGripNeighbor(curve: ComposeCurve, gripId: string): StagePoint | null {
  if (curve.kind === 'line') {
    if (gripId === START) return curve.end
    if (gripId === END) return curve.start
    return null
  }
  if (curve.kind !== 'polyline' || curve.closed || !gripId.startsWith(VERTEX_PREFIX)) return null
  const index = Number(gripId.slice(VERTEX_PREFIX.length))
  const last = curve.vertices.length - 1
  if (!Number.isInteger(index) || last < 1) return null
  if (index === 0) return curve.vertices[1] ?? null
  if (index === last) return curve.vertices[last - 1] ?? null
  return null
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
  source: StageCurveGeometrySource,
  entityId: string,
  override?: ComposeCurve | null,
): readonly StagePoint[] {
  const curve = override ?? stageCurveBoxGeometry(source, entityId)
  const matrix = source.getWorldMatrix(entityId)
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
 * @param options - `breakSymmetry` 为真时，拖控制手柄只动被拖的那一个（`Alt`）。
 * @returns 夹点 id 不属于这条曲线时返回 `null`，调用方据此放弃这次写入。
 * @public
 */
export function applyStageCurveGrip(
  curve: ComposeCurve,
  gripId: string,
  point: StagePoint,
  options?: { readonly breakSymmetry?: boolean },
): ComposeCurve | null {
  if (curve.kind === 'path') {
    return applyPathGrip(curve, gripId, point, options?.breakSymmetry === true)
  }
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
    if (gripId.startsWith(SEGMENT_PREFIX)) {
      const index = Number(gripId.slice(SEGMENT_PREFIX.length))
      const segments = polylineSegments(curve.vertices, curve.closed)
      const segment = segments[index]
      if (!Number.isInteger(index) || !segment) return null
      /*
       * 平移**这一段**：两个端点同加一个位移，相邻段因为共用端点自动跟着伸缩，顶点数不变。
       *
       * 位移按**中点**到落点算，与直线的中点夹点一致：落点被捕捉纠正之后，段中点精确落在
       * 那个特征点上。按指针裸坐标算会让段中点停在离目标几个像素的地方，而用户瞄的正是
       * 那个点。
       */
      const deltaX = point.x - (segment.start.x + segment.end.x) / 2
      const deltaY = point.y - (segment.start.y + segment.end.y) / 2
      // 第 i 段的两个端点是 `i` 与 `(i + 1) % 顶点数`：取模只在闭合多段线的收尾段上起作用
      // （它接回第一个顶点），开放多段线的段下标最大只到 `顶点数 - 2`，取模不改变任何东西。
      const tail = (index + 1) % curve.vertices.length
      const moved = new Set([index, tail])
      return {
        ...curve,
        vertices: curve.vertices.map((vertex, at) => (moved.has(at)
          ? { x: vertex.x + deltaX, y: vertex.y + deltaY }
          : vertex)),
      }
    }
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

/**
 * 把落点应用到 `path` 的顶点或控制手柄上。
 *
 * @remarks
 * 拖**顶点**时两侧手柄跟着同一个位移走：手柄表达的是这个点两侧的切向，顶点搬家而切向留在
 * 原地会让曲线在松手的瞬间扭一下，而用户拖的是那个点。
 *
 * 拖**手柄**默认让对侧**共线且等长**（关于顶点作镜像），`breakSymmetry` 时只动被拖的那一个。
 * 平滑与尖角**不存标志位**：共不共线从控制点本身读得出来，存一位就是给同一份事实造第二个
 * 来源，而它在用户拖出共线的那一刻就失真了。
 *
 * 对侧只在**同一条子路径里相邻的两段之间**存在。闭合子路径的收尾直段是展开时补出来的、
 * 并不存在于数据里，因此接缝处没有对侧可镜像——那里的两个手柄各自独立。
 */
function applyPathGrip(
  curve: ComposePathCurve,
  gripId: string,
  point: StagePoint,
  breakSymmetry: boolean,
): ComposePathCurve | null {
  const parsed = parsePathGripId(gripId)
  if (!parsed) return null
  const subpath = curve.subpaths[parsed.subpath]
  if (!subpath) return null
  const points = subpathPoints(subpath)
  const anchor = points[parsed.point]
  if (!anchor) return null

  const withSegments = (segments: readonly ComposeCubicSegment[], start = subpath.start) => ({
    ...curve,
    subpaths: curve.subpaths.map((item, index) => (
      index === parsed.subpath ? { ...subpath, start, segments } : item
    )),
  })

  if (parsed.side === null) {
    const deltaX = point.x - anchor.x
    const deltaY = point.y - anchor.y
    const shift = (value: ComposePosition): ComposePosition => ({
      x: value.x + deltaX,
      y: value.y + deltaY,
    })
    const segments = subpath.segments.map((segment, at): ComposeCubicSegment => {
      // 出向控制点在第 `point` 段上，入向控制点与这个顶点本身在第 `point - 1` 段上。
      if (at === parsed.point) return { ...segment, c1: shift(segment.c1) }
      if (at === parsed.point - 1) {
        return { ...segment, c2: shift(segment.c2), to: position(point) }
      }
      return segment
    })
    return withSegments(segments, parsed.point === 0 ? position(point) : subpath.start)
  }

  // 入向控制点住在前一段的 `c2` 上，出向住在这一段的 `c1` 上；对侧就是另一个。
  const draggedIndex = parsed.side === 'in' ? parsed.point - 1 : parsed.point
  const oppositeIndex = parsed.side === 'in' ? parsed.point : parsed.point - 1
  if (!subpath.segments[draggedIndex]) return null
  // 对侧关于顶点作镜像：等长让「共线且等长」在两个分量上同时成立。
  const opposite: ComposePosition = { x: 2 * anchor.x - point.x, y: 2 * anchor.y - point.y }
  const segments = subpath.segments.map((segment, at): ComposeCubicSegment => {
    if (at === draggedIndex) {
      return parsed.side === 'in'
        ? { ...segment, c2: position(point) }
        : { ...segment, c1: position(point) }
    }
    if (breakSymmetry || at !== oppositeIndex) return segment
    return parsed.side === 'in' ? { ...segment, c1: opposite } : { ...segment, c2: opposite }
  })
  return withSegments(segments)
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
  source: StageCurveGeometrySource,
  entityId: string,
  world: StagePoint,
): StagePoint | null {
  const matrix = source.getWorldMatrix(entityId)
  return matrix ? applyMatrix(invertMatrix(matrix), world) : null
}

/**
 * 一个圆角手柄。
 *
 * @remarks
 * 手柄画在**角弧的圆心**上——沿两条边各进一个切线长，Figma 的圆角手柄就在那里。半径为 0 时
 * 圆心与顶点重合，那时由呈现层沿 {@link StageCurveCorner.inward} 让开一个固定的屏幕距离，
 * 否则尖角状态下手柄压在顶点上，谁也抓不住。
 *
 * @public
 */
export interface StageCurveCorner {
  /** 手柄属于哪个 Entity；覆盖层据此派发命中，省掉一层「这是谁的手柄」的旁路状态。 */
  readonly entityId: string
  /** 顶点下标；拖动时按它找回标架。 */
  readonly index: number
  /** 手柄落点，世界坐标。 */
  readonly point: StagePoint
  /** 角顶点，世界坐标；半径标注从圆心量到弧上，而弧的圆心就是 `point`。 */
  readonly vertex: StagePoint
  /** 角平分线方向上的一个世界点（离顶点一个单位），呈现层据此求屏幕方向。 */
  readonly inward: StagePoint
  /** 此刻画出来的半径，已按相邻边长钳制。 */
  readonly radius: number
}

/**
 * 派生一个 Entity 的圆角手柄。
 *
 * @remarks
 * 只有多段线有角。半径到顶时同一条边上的两个手柄会落在同一点——**那时全部不画**，交给呈现层
 * 按屏幕距离判断，因为「叠在一起」是一个屏幕问题而不是几何问题。
 *
 * @param override - 盒局部几何的替代品；拖动期间传入预览几何，手柄因此跟手而文档不动。
 * @public
 */
export function stageCurveCorners(
  source: StageCurveGeometrySource,
  entityId: string,
  override?: ComposeCurve | null,
): readonly StageCurveCorner[] {
  /*
   * 判据取**作者写下的那条曲线**而不是投影之后的：非等比缩放会把弧拍扁成多段线（见
   * `projectComposeCurveToBox`），照投影结果判断就会给一段圆弧发出一整串圆角手柄——而弧
   * 根本没有角。投影是给命中与渲染用的近似，不是这条曲线是什么的答案。
   *
   * `override` 是拖动期的预览几何，它本来就与作者的那条同 kind，因此直接问它。
   */
  const entity = source.document.entities[entityId]
  const authoredCurve = override ?? (entity ? getComposeCurve(entity) : null)
  if (authoredCurve?.kind !== 'polyline') return []
  const curve = override ?? stageCurveBoxGeometry(source, entityId)
  const matrix = source.getWorldMatrix(entityId)
  if (!curve || curve.kind !== 'polyline' || !matrix) return []
  const authored = curve.cornerRadius ?? 0
  return composePolylineCornerFrames(curve.vertices, curve.closed).map((frame) => {
    // 圆心按**钳制之后**的半径求：手柄要坐在真正画出来的那段弧的圆心上。用作者写下的那个
    // 数会让手柄在半径超过相邻边一半之后继续往外飘，而形状早就停在最大圆角上——屏幕上就是
    // 「手柄跟弧脱节了，再拖也不见形状变」。钳制不回写这条不变：写进文档的仍是作者的意图。
    const radius = clampComposeCornerRadius(frame, authored)
    return {
      entityId,
      index: frame.index,
      point: applyMatrix(matrix, composeCornerArcCenter(frame, radius)),
      vertex: applyMatrix(matrix, frame.vertex),
      inward: applyMatrix(matrix, {
        x: frame.vertex.x + frame.bisector.x,
        y: frame.vertex.y + frame.bisector.y,
      }),
      radius,
    }
  })
}

/**
 * 把一个盒局部落点解释成圆角半径，写回整条曲线。
 *
 * @remarks
 * **四个角联动一个值**：落在哪个角上只决定用哪个标架反解，写回去的是同一个 `cornerRadius`。
 *
 * 半径为 0 时**删掉这个字段**而不是写 0：协议里缺席与 0 是同一件事，留两种表示会让「有没有
 * 圆角」在两处读出不同答案，而校验只接受在场时是正数的那一种。
 *
 * @returns 不是多段线或那个下标上没有角时返回 `null`，调用方据此放弃这次写入。
 * @public
 */
export function applyStageCurveCorner(
  curve: ComposeCurve,
  cornerIndex: number,
  point: StagePoint,
): ComposeCurve | null {
  if (curve.kind !== 'polyline') return null
  const frame = composePolylineCornerFrames(curve.vertices, curve.closed)
    .find(({ index }) => index === cornerIndex)
  if (!frame) return null
  const radius = composeCornerRadiusAt(frame, point)
  const next: ComposePolylineCurve = { ...curve, cornerRadius: radius }
  if (!(radius > 0)) {
    const { cornerRadius, ...sharp } = next
    void cornerRadius
    return sharp as ComposePolylineCurve
  }
  return next
}
