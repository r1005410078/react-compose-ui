import {
  composePolylineSegments,
  nearestComposeCubicT,
  pointToComposeSegmentDistance,
  splitComposeCubic,
} from '@compose-ui/core'
import type {
  ComposeCubicSegment,
  ComposeCubicShape,
  ComposeCurve,
  ComposePathCurve,
  ComposePolylineCurve,
  ComposePosition,
  ComposeSubpath,
} from '@compose-ui/core'
import type { StagePoint } from '../geometry'

/**
 * 一次顶点增删被拒绝的原因。
 *
 * @remarks
 * 是**原因码而不是文案**：本包不认识 locale，落地的那句话由宿主给出。它必须说得出来而不是
 * 静默不动——「敲了没反应」与敲错在屏幕上无法区分，这与命令的 `rejected` 是同一条判断。
 *
 * - `arc`：弧没有顶点。
 * - `floor`：删到只剩一个顶点，一条什么都画不出来的轮廓。
 * - `path-seam`：落点最近的是闭合子路径的**收尾直段**，而那一段是展开时补出来的、并不存在
 *   于数据里。把它落成真实的段会让子路径的末点与起点重合，凭空多出一个重合的顶点——那正是
 *   `closed` 用布尔而不是重复首尾顶点表达的理由。
 * - `unsupported`：这个夹点不是顶点（段中点、直线的平移夹点、控制手柄）。
 *
 * @public
 */
export type StageVertexEditRejection = 'arc' | 'floor' | 'path-seam' | 'unsupported'

/**
 * 一次顶点增删的结果。
 *
 * @remarks
 * 成功时带**新的几何**而不是就地改写：曲线几何的写入只有 `entity.curve.set` 一个漏斗，
 * 而这里是纯函数。
 *
 * @public
 */
export type StageVertexEdit =
  | { readonly status: 'ok'; readonly curve: ComposeCurve }
  | { readonly status: 'rejected'; readonly reason: StageVertexEditRejection }

const ok = (curve: ComposeCurve): StageVertexEdit => ({ status: 'ok', curve })
const rejected = (reason: StageVertexEditRejection): StageVertexEdit => (
  { status: 'rejected', reason }
)

/** `ComposePosition` 带 JSON 索引签名，接口类型的点要经字面量才能赋进去。 */
const position = (point: { readonly x: number; readonly y: number }): ComposePosition => (
  { x: point.x, y: point.y }
)

/** 顶点数下限：一条什么都画不出来的轮廓不是一条轮廓。 */
const MIN_VERTICES = 2

/** 一条子路径上的顶点序列：起点加每段的终点。 */
function subpathPoints(subpath: ComposeSubpath): readonly ComposePosition[] {
  return [subpath.start, ...subpath.segments.map((segment) => segment.to)]
}

/** 一条子路径展开成的**显式**三次贝塞尔段；收尾直段不在里面。 */
function explicitCubics(subpath: ComposeSubpath): readonly ComposeCubicShape[] {
  const points = subpathPoints(subpath)
  return subpath.segments.map((segment, index) => ({
    start: points[index]!,
    c1: segment.c1,
    c2: segment.c2,
    end: segment.to,
  }))
}

/**
 * 在落点处插入一个顶点。
 *
 * @remarks
 * 落点是**盒局部坐标**，且调用方必须已经让它走完落点解算——吸附、特征点捕捉与动态输入因此
 * 全部照旧，这里不再解算第二遍。
 *
 * 段由**落点到它的距离**选出而不是由夹点 id 指定：双击落在段上的任何位置都该在那里插点，
 * 而段中点夹点只覆盖其中一个像素。
 *
 * @public
 */
export function insertStageCurveVertex(curve: ComposeCurve, point: StagePoint): StageVertexEdit {
  if (curve.kind === 'arc') return rejected('arc')
  if (curve.kind === 'line') {
    /*
     * 一条直线加一个中间点**就是**三顶点折线，因此 kind 在同一条写入里换掉。另立一种
     * 「带中间点的直线」会让归一化、平移、距离、特征点、渲染与校验六条路径各多一支。
     *
     * 两点直线只有一段，落点落在哪儿都是这一段，因此不必挑。
     */
    return ok({
      kind: 'polyline',
      vertices: [position(curve.start), position(point), position(curve.end)],
      closed: false,
    } satisfies ComposePolylineCurve)
  }
  if (curve.kind === 'polyline') return insertIntoPolyline(curve, point)
  return insertIntoPath(curve, point)
}

function insertIntoPolyline(curve: ComposePolylineCurve, point: StagePoint): StageVertexEdit {
  const segments = composePolylineSegments(curve.vertices, curve.closed)
  if (segments.length === 0) return rejected('unsupported')
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  segments.forEach((segment, index) => {
    const distance = pointToComposeSegmentDistance(segment, point)
    if (distance >= bestDistance) return
    bestDistance = distance
    best = index
  })
  /*
   * 第 i 段从顶点 i 连到顶点 i+1，因此新顶点插在下标 i+1 处。闭合多段线的收尾段下标是
   * `顶点数 - 1`，插在末尾，正是它在屏幕上的位置——取模在这里**不能用**：插在下标 0 会把
   * 新顶点放到整条折线的开头。
   */
  const vertices = [...curve.vertices]
  vertices.splice(best + 1, 0, position(point))
  return ok({ ...curve, vertices })
}

function insertIntoPath(curve: ComposePathCurve, point: StagePoint): StageVertexEdit {
  let target: { readonly subpath: number; readonly segment: number; readonly t: number } | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  let seamDistance = Number.POSITIVE_INFINITY

  curve.subpaths.forEach((subpath, subpathIndex) => {
    explicitCubics(subpath).forEach((cubic, segmentIndex) => {
      const t = nearestComposeCubicT(cubic, point)
      const at = pointAt(cubic, t)
      const distance = Math.hypot(at.x - point.x, at.y - point.y)
      if (distance >= bestDistance) return
      bestDistance = distance
      target = { subpath: subpathIndex, segment: segmentIndex, t }
    })
    // 收尾直段：展开时补出来的，数据里没有它，因此插不进去——见 `path-seam`。
    const points = subpathPoints(subpath)
    const last = points[points.length - 1]!
    if (!subpath.closed || (last.x === subpath.start.x && last.y === subpath.start.y)) return
    seamDistance = Math.min(
      seamDistance,
      pointToComposeSegmentDistance({ start: last, end: subpath.start }, point),
    )
  })

  if (target === null) return rejected('unsupported')
  if (seamDistance < bestDistance) return rejected('path-seam')

  const { subpath: subpathIndex, segment: segmentIndex, t } = target
  const subpath = curve.subpaths[subpathIndex]!
  const cubics = explicitCubics(subpath)
  const [left, right] = splitComposeCubic(cubics[segmentIndex]!, t)
  const segments = [...subpath.segments]
  segments.splice(segmentIndex, 1, cubicSegment(left), cubicSegment(right))
  const subpaths = [...curve.subpaths]
  subpaths[subpathIndex] = { ...subpath, segments }
  return ok({ ...curve, subpaths })
}

/** 三次段在参数 `t` 处的位置；只用来量「这一段离落点多远」。 */
function pointAt(cubic: ComposeCubicShape, t: number): ComposePosition {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return {
    x: a * cubic.start.x + b * cubic.c1.x + c * cubic.c2.x + d * cubic.end.x,
    y: a * cubic.start.y + b * cubic.c1.y + c * cubic.c2.y + d * cubic.end.y,
  }
}

/** 段只存两个控制点与终点：起点永远等于前一段的终点。 */
function cubicSegment(cubic: ComposeCubicShape): ComposeCubicSegment {
  return { c1: position(cubic.c1), c2: position(cubic.c2), to: position(cubic.end) }
}

/**
 * 删除某个夹点对应的顶点。
 *
 * @remarks
 * 只受理**顶点**夹点：段中点、直线的平移夹点与控制手柄各自表达别的自由度，在它们上面按
 * `Delete` 没有正确答案，因此以 `unsupported` 说出来而不是静默不动。
 *
 * 相邻两段合并成一段，**保留两侧各自外侧的那个控制点**：那两个点表达的是留下来的两个顶点上
 * 的切向，删掉中间那一个不该把它们一起改掉。形状会变——那正是用户要求的。
 *
 * @public
 */
export function deleteStageCurveVertex(curve: ComposeCurve, gripId: string): StageVertexEdit {
  if (curve.kind === 'arc') return rejected('arc')
  // 两点直线的任一端都在下限上：删掉一个就只剩一个点。
  if (curve.kind === 'line') {
    return gripId === 'start' || gripId === 'end' ? rejected('floor') : rejected('unsupported')
  }
  if (curve.kind === 'polyline') {
    const target = parseVertexIndex(gripId)
    if (target === null || target >= curve.vertices.length) return rejected('unsupported')
    if (curve.vertices.length <= MIN_VERTICES) return rejected('floor')
    return ok({
      ...curve,
      vertices: curve.vertices.filter((_, index) => index !== target),
    })
  }
  return deleteFromPath(curve, gripId)
}

/** `v{下标}`；不是顶点夹点时返回 null。 */
function parseVertexIndex(gripId: string): number | null {
  const match = /^v(\d+)$/.exec(gripId)
  return match ? Number(match[1]) : null
}

function deleteFromPath(curve: ComposePathCurve, gripId: string): StageVertexEdit {
  // 控制手柄的 id 是顶点 id 加一个后缀，因此这条正则**不带后缀**才只认顶点。
  const match = /^p(\d+)v(\d+)$/.exec(gripId)
  if (!match) return rejected('unsupported')
  const subpathIndex = Number(match[1])
  const target = Number(match[2])
  const subpath = curve.subpaths[subpathIndex]
  if (!subpath) return rejected('unsupported')
  const points = subpathPoints(subpath)
  if (target >= points.length) return rejected('unsupported')
  if (points.length <= MIN_VERTICES) return rejected('floor')

  const segments = [...subpath.segments]
  let start = subpath.start
  if (target === 0) {
    // 起点被删掉：第二个点接任，它前面那一段随之消失。闭合子路径的收尾直段自动改接新起点。
    start = segments[0]!.to
    segments.splice(0, 1)
  } else if (target === points.length - 1) {
    segments.splice(target - 1, 1)
  } else {
    // 中间的点：前后两段并成一段，外侧的两个控制点各自留下。
    const before = segments[target - 1]!
    const after = segments[target]!
    segments.splice(target - 1, 2, { c1: before.c1, c2: after.c2, to: after.to })
  }
  const subpaths = [...curve.subpaths]
  subpaths[subpathIndex] = { ...subpath, start, segments }
  return ok({ ...curve, subpaths })
}
