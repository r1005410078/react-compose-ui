import { getComposeLock, isComposeFrameEntity, type ComposeDocument } from '@compose-ui/core'
import { rectContains, rectsIntersect, type StageRect } from './geometry'
import type { StageSceneIndex } from './scene-index'

/**
 * 框选的命中判定模式。
 *
 * @remarks
 * 只描述「判定几何」这一个维度：`intersect` 碰到即选中，`contain` 要求完全框住，
 * `directional` 把判定交给拖拽方向。与已有选区的布尔组合是正交的另一维，见
 * {@link StageMarqueeCombine}。
 * @public
 */
export type StageMarqueeMode = 'intersect' | 'contain' | 'directional'

/**
 * 框选拖拽的水平方向。
 *
 * @remarks
 * `ltr` 表示起点在终点左侧。归一化矩形丢失了方向信息，所以 `directional` 判定必须由调用方
 * 显式传入方向，而不是从矩形反推。
 * @public
 */
export type StageMarqueeDirection = 'ltr' | 'rtl'

/**
 * 框选结果与已有选区的组合方式。
 *
 * @public
 */
export type StageMarqueeCombine = 'replace' | 'add' | 'subtract'

/**
 * 宿主未提供模式时使用的判定，保持与历史行为一致。
 *
 * @public
 */
export const DEFAULT_STAGE_MARQUEE_MODE: StageMarqueeMode = 'intersect'

/**
 * 视为「点击」而非「拖框」的世界尺寸阈值。
 *
 * @remarks
 * 小于一个世界像素的框来自没有真正移动的按下，此时不应把整个画布判成命中。
 */
const DEGENERATE_AREA_SIZE = 1

/**
 * 解析一次框选所需的全部输入。
 *
 * @public
 */
export interface StageMarqueeQuery {
  /** 归一化后的世界坐标框。 */
  readonly area: StageRect
  /** 框选开始前的选区，按宿主顺序排列；`add`/`subtract` 以它为基准。 */
  readonly base?: readonly string[]
  /** 与已有选区的组合方式。 @defaultValue 'replace' */
  readonly combine?: StageMarqueeCombine
  /** 拖拽方向，`directional` 模式据此切换判定。 */
  readonly direction: StageMarqueeDirection
  /** 与 index 同一求解周期的文档，用于读取 lock 状态。 */
  readonly document: ComposeDocument
  /** 提供确定性场景顺序与世界包围盒的场景索引。 */
  readonly index: StageSceneIndex
  /** 判定模式。 @defaultValue 'intersect' */
  readonly mode?: StageMarqueeMode
}

/**
 * 把模式与拖拽方向归约为实际生效的判定。
 *
 * @remarks
 * `directional` 采用 CAD 惯例：从左往右拖要求完全框住，从右往左拖碰到即选中。Overlay 也用
 * 这个结果决定实线还是虚线，因此判定归约必须只有这一处实现。
 * @public
 */
export function resolveMarqueeHitTest(
  mode: StageMarqueeMode = DEFAULT_STAGE_MARQUEE_MODE,
  direction: StageMarqueeDirection,
): Exclude<StageMarqueeMode, 'directional'> {
  if (mode !== 'directional') return mode
  return direction === 'ltr' ? 'contain' : 'intersect'
}

/**
 * 解析一次框选命中的 Entity ID。
 *
 * @remarks
 * 判定几何使用节点的世界 AABB。旋转节点的 AABB 大于其实际图形，因此 `contain` 对旋转节点
 * 偏严格——这是当前变更有意接受的取舍，真实路径级判定留待后续变更。
 *
 * hidden 与 locked 节点永远不进入结果，`subtract` 也不会因此把它们从既有选区中漏掉，因为
 * 它们本就不该出现在既有选区里。
 *
 * 完全包住框选区域的 Frame 不进入结果：在画板里拖框表达的是"选这些子级"，把画板本身
 * 一并选中会让紧接着的移动整体搬走画板。从画板外面框住它仍然选得中。
 *
 * @returns 稳定文档 ID。`replace` 按确定性场景顺序返回；`add` 保留既有选区顺序并在其后追加
 * 新命中，避免打乱宿主依赖的「首个选中项」语义。
 * @public
 */
export function resolveMarqueeSelection(query: StageMarqueeQuery): readonly string[] {
  const { area, base = [], combine = 'replace', direction, document, index, mode } = query
  const degenerate = area.width < DEGENERATE_AREA_SIZE && area.height < DEGENERATE_AREA_SIZE
  const hitTest = resolveMarqueeHitTest(mode, direction)
  const hits = degenerate
    ? []
    : index.order.filter((entityId) => {
        const entity = document.entities[entityId]
        const bounds = index.getWorldBounds(entityId)
        if (!entity || !bounds) return false
        if (!index.isVisible(entityId) || getComposeLock(entity).locked) return false
        if (isComposeFrameEntity(entity) && rectContains(bounds, area)) return false
        return hitTest === 'contain'
          ? rectContains(area, bounds)
          : rectsIntersect(area, bounds)
      })
  if (combine === 'replace') return hits
  const hitSet = new Set(hits)
  if (combine === 'subtract') return base.filter((entityId) => !hitSet.has(entityId))
  const baseSet = new Set(base)
  return [...base, ...hits.filter((entityId) => !baseSet.has(entityId))]
}

/**
 * 从手势起止点取出拖拽方向。
 *
 * @remarks
 * 归一化矩形丢失了方向，因此方向必须从起止点单独取，不能从矩形反推。
 * @public
 */
export function marqueeDirection(
  startWorld: { readonly x: number },
  currentWorld: { readonly x: number },
): StageMarqueeDirection {
  return currentWorld.x >= startWorld.x ? 'ltr' : 'rtl'
}

/**
 * 把修饰键翻译成与既有选区的布尔组合。
 *
 * @remarks
 * 组合与判定模式正交：模式决定「框住什么算命中」，组合决定「命中之后怎么并入选区」。
 * @public
 */
export function marqueeCombine(
  modifiers: { readonly shift: boolean; readonly alt: boolean },
): StageMarqueeCombine {
  if (modifiers.shift) return 'add'
  if (modifiers.alt) return 'subtract'
  return 'replace'
}

/**
 * 解析一次框选**提交**最终写入的选区。
 *
 * @remarks
 * 与 {@link resolveMarqueeSelection} 的差别只在起框容器的排除：从非空容器体上起框时，用户看的
 * 是「容器内的画布」，把这个容器连同它的祖先一并选中等于没有解决当初的收敛冲突——它们被框住
 * 只是几何巧合。排除沿 index 的父链一路上溯，因此嵌套容器同样成立。
 *
 * @param originEntityId - 起框所在的容器；`undefined`（从空白起框）时不排除任何节点。
 * @returns 稳定文档 ID。
 * @public
 */
export function resolveMarqueeCommit(
  query: StageMarqueeQuery & { readonly originEntityId?: string },
): readonly string[] {
  const resolved = resolveMarqueeSelection(query)
  if (!query.originEntityId) return resolved
  const excluded = new Set<string>()
  let ancestor: string | null = query.originEntityId
  while (ancestor) {
    excluded.add(ancestor)
    ancestor = query.index.getParentId(ancestor)
  }
  return resolved.filter((entityId) => !excluded.has(entityId))
}
