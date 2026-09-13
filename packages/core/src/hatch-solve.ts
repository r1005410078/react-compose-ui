/**
 * 填充几何的派生求解。
 *
 * @remarks
 * 与 `resolveComposeWires` **并排**，由布局 Runtime 在每次 solve 里调用。
 *
 * **求解不存储**，与导线是同一条原则：收益不是少存几个数，而是「边界动了之后重解」那段代码
 * 根本不存在——移动、方向键微调、Inspector 改位置、撤销、粘贴、导入与外部同步全部自动正确。
 * 反过来，把跟随挂在事务提交上是**逐条路径回写**，而仓库为导线明令禁止过它：漏一条的症状是
 * 「填充与边界对不上」，看起来像渲染缺陷而不是数据缺陷。
 *
 * 推论：跟随**不进撤销历史**。撤销一步回到改动之前，填充跟着回去是求解的结果，
 * 而不是第二条历史记录——「撤销一步全回去」因此是白拿的。
 * @packageDocumentation
 */

import {
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutItem,
  type ComposeLayoutSnapshot,
  type ComposePosition,
  type JsonObject,
} from './document-types'
import {
  composePolylineOutline,
  getComposeCurve,
  normalizeComposeCurveGeometry,
  projectComposeCurveToBox,
  type ComposeCurve,
} from './curve'
import { composeCurveInnerAnchor, resolveComposeCurveRegion } from './curve-region'
import { jsonEqual } from './patches'
import { getComposeHatch } from './hatch'
import { getComposeTransform } from './entity'
import type { ComposeOutlinePiece, ComposePlanarPoint } from './curve-geometry'

/** {@link resolveComposeHatches} 的结果。 @public */
export interface ComposeResolvedHatches {
  readonly document: ComposeDocument
  readonly snapshot: ComposeLayoutSnapshot
}

/** 父级局部坐标里的一段边界，连同它出自哪个 Entity。 */
interface OwnedPiece {
  readonly owner: string
  readonly piece: ComposeOutlinePiece
}

function translatePoint(
  point: ComposePlanarPoint,
  dx: number,
  dy: number,
): ComposePosition {
  return { x: point.x + dx, y: point.y + dy }
}

/** 把盒局部的一列轮廓片段搬进**父级**局部坐标——只是平移，与导线读 `box.x + point.x` 同一条。 */
function translatePiece(
  piece: ComposeOutlinePiece,
  dx: number,
  dy: number,
): ComposeOutlinePiece {
  if (piece.kind === 'arc') {
    return { kind: 'arc', arc: { ...piece.arc, center: translatePoint(piece.arc.center, dx, dy) } }
  }
  return {
    kind: 'segment',
    segment: {
      start: translatePoint(piece.segment.start, dx, dy),
      end: translatePoint(piece.segment.end, dx, dy),
    },
  }
}

/** 一条曲线在父级局部坐标里的轮廓片段；多段线走圆角之后的那一列。 */
function ownedPieces(
  owner: string,
  curve: ComposeCurve,
  box: { readonly x: number; readonly y: number },
): readonly OwnedPiece[] {
  const pieces: readonly ComposeOutlinePiece[] = curve.kind === 'polyline'
    ? composePolylineOutline(curve)
    : outlineOf(curve)
  return pieces.map((piece) => ({ owner, piece: translatePiece(piece, box.x, box.y) }))
}

/** 非多段线的轮廓片段。`path` 眼下不参与边界，与 `TRIM` 拒绝 `path` 是同一条欠账。 */
function outlineOf(curve: ComposeCurve): readonly ComposeOutlinePiece[] {
  if (curve.kind === 'arc') return [{ kind: 'arc', arc: curve }]
  if (curve.kind === 'line') return [{ kind: 'segment', segment: { start: curve.start, end: curve.end } }]
  return []
}

/** 每个 Entity 的父级；根级为 `null`。 */
function parentTable(document: ComposeDocument): ReadonlyMap<string, string | null> {
  const table = new Map<string, string | null>()
  for (const id of Object.keys(document.entities)) table.set(id, null)
  for (const [parentId, entity] of Object.entries(document.entities)) {
    const hierarchy = entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.hierarchy] as
      { readonly childIds?: readonly string[] } | undefined
    for (const childId of hierarchy?.childIds ?? []) table.set(childId, parentId)
  }
  return table
}

function hasRotation(entity: ComposeEntity): boolean {
  return getComposeTransform(entity).rotation !== 0
}

/**
 * 把全部填充的几何按当前边界解算一遍。
 *
 * @remarks
 * **只在存下来的那几个边界里求**，不扫全图：`HATCH` 命令那一次要从整张图找出边界，
 * 而跟随已经知道边界是谁了，因此是 O(k²)（k 通常两三个）而不是 O(N²)。
 * 推论：此后新画的、穿过这块面的线**不参与**——它不是当初围出这块面的边界，
 * 而填充停在原处正是今天的行为。
 *
 * 两档分流，判据是**边界清单**：
 * - 重求出来的清单与存着的那份**相同** → 写进去（跟随）。
 * - **不同** → 几何一个字节不动。拓扑变了时「跟上」意味着一次用户没有要求过的形状改变。
 *
 * 求不出面时保留作者几何，与导线「任一端解算失败就用作者几何兜底」同一条——塌成一点或整块
 * 消失都会让用户以为填充被删了。
 *
 * 求解**会改填充自己的盒**，因此文档与快照成对返回：分头产出会让命中读到的盒与渲染画出的
 * 几何差一帧。填充是绝对定位，改它的盒不影响任何其他 Entity 的求解。
 *
 * @returns 没有任何填充需要解算时**原样返回入参**，引用不变，订阅方的记忆化因此不会失效。
 * @public
 */
export function resolveComposeHatches(
  document: ComposeDocument,
  snapshot: ComposeLayoutSnapshot,
): ComposeResolvedHatches {
  let entities: Record<string, ComposeEntity> | null = null
  let boxes: Record<string, ComposeLayoutSnapshot['boxes'][string]> | null = null
  let parents: ReadonlyMap<string, string | null> | null = null

  for (const [id, entity] of Object.entries(document.entities)) {
    const hatch = getComposeHatch(entity)
    if (!hatch?.boundaryIds || hatch.boundaryIds.length === 0) continue
    const box = snapshot.boxes[id]
    const item = entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.layoutItem] as
      ComposeLayoutItem | undefined
    if (!box || !item) continue

    parents ??= parentTable(document)
    const parentId = parents.get(id) ?? null

    /*
     * 边界必须与填充**同父级**：求解走 `snapshot.boxes`，同父级下盒坐标才可比；跨层级要合成
     * 整条祖先链的变换。与 `wire.parent-mismatch`「限制在同一父级把嵌套时静默错位变成一条
     * 读得出来的问题」逐字相同。旋转过的边界同样不跟随——盒到父级只是平移，带旋转时那条平移
     * 说的是另一个形状，而一个**错的**面比不跟随糟得多。
     */
    const owned: OwnedPiece[] = []
    let usable = true
    for (const boundaryId of hatch.boundaryIds) {
      const source = document.entities[boundaryId]
      const sourceBox = snapshot.boxes[boundaryId]
      const curve = source ? getComposeCurve(source) : undefined
      if (!source || !sourceBox || !curve
        || (parents.get(boundaryId) ?? null) !== parentId
        || hasRotation(source)) {
        usable = false
        break
      }
      owned.push(...ownedPieces(boundaryId, projectComposeCurveToBox(curve, sourceBox), sourceBox))
    }
    if (!usable || owned.length === 0) continue

    // 锚点存的是 Entity 局部；加回盒的偏移就回到父级局部，与导线读 `box.x + point.x` 同一条。
    const seed: ComposePlanarPoint = { x: box.x + hatch.seed.x, y: box.y + hatch.seed.y }
    const region = resolveComposeCurveRegion(owned.map(({ piece }) => piece), seed)
    if (region.status !== 'resolved') continue

    // 清单比对：把用到的那些子边映射回它们各自的 Entity。
    const used = new Set<string>()
    for (const source of region.sources) used.add(owned[source.index]!.owner)
    const stored = [...hatch.boundaryIds].sort()
    const next = [...used].sort()
    if (stored.length !== next.length || stored.some((value, index) => value !== next[index])) {
      continue
    }

    const normalized = normalizeComposeCurveGeometry(region.curve)
    /*
     * 几何与上一次求出来的逐位相同 → 这一次**没有跟随发生**，到此为止。
     *
     * 这既是语义也是性能。语义：锚点只在跟随成功之后重取，刚填出来的那块面上用户点的地方就是
     * 他心里那块面，此时把它挪走会让「重新生成」变得不可预测。性能：量过一块两边界的面，
     * **求面 0.011ms，而取锚点 1.16ms**——差一百倍，因此挡在取锚点之前的这一道就是全部的账。
     * 五十块填充于是从每次 solve 59ms 降到不到 1ms，而 59ms 是每一次方向键微调都付的。
     * 反过来先比对边界的盒与几何、连求面都不求，换来的是那 0.011ms，却要在纯函数外面养一份
     * 跨帧的缓存。
     */
    if (jsonEqual(
      entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.curve],
      normalized.curve as unknown as JsonObject,
    )) continue

    // 锚点重取：离每一条边界都最远，下一次变形才扛得住被吞进另一块面。求不出内部就留着旧的。
    const anchor = composeCurveInnerAnchor(normalized.curve) ?? hatch.seed

    entities ??= { ...document.entities }
    boxes ??= { ...snapshot.boxes }
    entities[id] = {
      ...entity,
      components: {
        ...entity.components,
        [COMPOSE_BUILTIN_COMPONENT_KEYS.curve]: normalized.curve as unknown as JsonObject,
        [COMPOSE_BUILTIN_COMPONENT_KEYS.hatch]: { ...hatch, seed: anchor } as unknown as JsonObject,
        [COMPOSE_BUILTIN_COMPONENT_KEYS.layoutItem]: {
          ...item,
          offset: normalized.offset,
          width: { ...item.width, value: normalized.size.width },
          height: { ...item.height, value: normalized.size.height },
        },
      },
    }
    boxes[id] = {
      ...box,
      x: normalized.offset.x,
      y: normalized.offset.y,
      width: normalized.size.width,
      height: normalized.size.height,
    }
  }

  if (!entities || !boxes) return { document, snapshot }
  return { document: { ...document, entities }, snapshot: { ...snapshot, boxes } }
}
