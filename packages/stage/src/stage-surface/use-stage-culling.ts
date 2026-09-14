import { useMemo } from 'react'
import {
  decodeComposeInstancePath,
  getComposeRenderer,
  isComposeInstancePath,
} from '@compose-ui/core'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  resolveStageCullingExemptIds,
  resolveStageCullingWindow,
  resolveStageDetailCulledIds,
  resolveStageVisibleEntityIds,
  type StageSceneIndex,
  type StageViewport,
} from '@compose-ui/stage-engine'

/** 用 NUL 拼接 ID 列表；Entity ID 不含该字符，因此拼接可逆且不会产生歧义。 */
const ID_SEPARATOR = '\u0000'

function joinIds(ids: Iterable<string>) {
  return [...ids].join(ID_SEPARATOR)
}

function splitIds(key: string) {
  return key === '' ? [] : key.split(ID_SEPARATOR)
}

/** 没有裁剪时返回同一个空集合，避免内容子树因为换了个空 Set 而重建。 */
const NO_CULLED_IDS: ReadonlySet<string> = new Set<string>()

/**
 * 可见集至少要比全集少这么大一个比例，裁剪才值得开。
 *
 * @remarks
 * 整张图基本都在可视区时（适配之后、或只放大了一两档），裁掉那一成节点省不下什么——样式重算
 * 与合成的账几乎没变——却要为每一次换窗付一整趟内容重建，平移因此比根本不裁还抖。这一档交
 * 空集，与「没有裁剪」逐字相同，也让「小图上渲染输出不变」不再依赖小图恰好整个落在窗口里。
 */
const MIN_CULLED_FRACTION = 0.1

/**
 * {@link useStageCulling} 的结果。
 *
 * @internal
 */
export interface StageCullingResult {
  /**
   * 这一帧的目标裁剪集：不该建 DOM 节点的 Entity。
   *
   * @remarks
   * 渲染层不一定当帧照单全收——平移换窗时它按批次逐帧逼近这个目标，见 `StageSceneLayer`。
   */
  readonly culledEntityIds: ReadonlySet<string>
  /**
   * `culledEntityIds` 里**只因读不出来**被裁的那一部分（细节裁剪）。
   *
   * @remarks
   * 场景层在批次键变化时据此分辨谁是可读性带进来的：那一半排队，窗口带进来的那一半当帧到齐。
   */
  readonly detailCulledEntityIds: ReadonlySet<string>
  /**
   * 「目标变了能不能分批逼近」的判据：键没变就能。
   *
   * @remarks
   * 键由缩放档位与豁免声明拼成。只有**同一文档、同一档位、同一豁免**之下目标集的变化才是
   * 纯粹的平移换窗——新进与离开的都在可视区外，晚几帧不可见；缩放跨档时新进的节点可能已在
   * 可视区里，豁免变了时正在编辑的那个必须当场在，文档变了时对象可能正被用户改着位置。
   */
  readonly batchKey: string
}

/**
 * {@link useStageCulling} 的输入。
 *
 * @internal
 */
export interface StageCullingInput {
  /** 已提交文档的场景索引。 */
  readonly index: StageSceneIndex
  /** 手势预览变换作用的 Entity；它们的几何此刻不由索引决定。 */
  readonly previewTransforms: Readonly<Record<string, unknown>>
  /** 只用来查 Renderer 声明的可读尺寸下限。 */
  readonly registry: Pick<ComposeEntityRegistry, 'getRenderer'>
  /** 当前选择集；可能含组件实例的复合地址。 */
  readonly selectedIds: readonly string[]
  /** 图面是否已量到真实尺寸。 */
  readonly surfaceMeasured: boolean
  readonly surfaceSize: { readonly width: number; readonly height: number }
  /** 正在画布内原地编辑文字的 Entity。 */
  readonly textEditingEntityId: string | null
  readonly viewport: StageViewport
}

/**
 * 求这一帧**不**建 DOM 节点的 Entity 集合，以及它能不能被分批逼近。
 *
 * @remarks
 * 返回的是「被裁掉的」而不是「该渲染的」，这一点是有意的：渲染层据此**只跳过被点名的**，
 * 因此索引不认识的 Entity（预览文档里刚建出来、尚未提交的那些）一律照常渲染。反过来传
 * 「该渲染的」会让任何一个索引来不及认识的 Entity 静默消失，而那类缺陷只在建对象的那一帧
 * 出现。
 *
 * 它与 `hiddenEntityIds` **MUST NOT 合并**，哪怕两者形状一样：`hidden` 的语义是渲染与命中
 * 两边都没有，裁剪是只有渲染这一边没有。合并会让「看得见」与「点得到」分家。
 *
 * 图面尚未量到真实尺寸前不裁：那一刻的 `surfaceSize` 还是兜底值，按它裁会在挂载后的第一帧
 * 少画一批东西，而那一帧用户看得见。
 *
 * @internal
 */
export function useStageCulling({
  index,
  previewTransforms,
  registry,
  selectedIds,
  surfaceMeasured,
  surfaceSize,
  textEditingEntityId,
  viewport,
}: StageCullingInput): StageCullingResult {
  const windowKey = resolveStageCullingWindow(viewport, surfaceSize).key
  /*
   * 窗口按身份记忆化：视口每帧都在动，而窗口按半屏量化，因此这里得到的对象在整段平移里
   * 是同一个。这正是「内容子树不随帧重建」的支点——那条既有约束（内容 memo 刻意不依赖
   * viewport）在裁剪落地之后仍然成立，靠的就是依赖换成了这个离散值。
   *
   * 矩形完全由 key 的六个分量决定（格子尺寸加四条边的下标），因此按 key 记忆化不会读到
   * 过期的视口。
   */
  const cullingWindow = useMemo(
    () => resolveStageCullingWindow(viewport, surfaceSize),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 窗口矩形是 windowKey 的纯函数，见上。
    [windowKey],
  )
  /*
   * 换窗那一帧的重建**同步**完成，不降级。曾经过一道 `useDeferredValue`，那样行不通：React 18
   * 的低优先级渲染每收到一次高优先级更新就整个重来，而平移每一帧都是一次高优先级更新，连续
   * 拖动时它永远完不成，直到五秒的过期强制刷出——用户看到的是图要等很久才出来。让那一趟便宜
   * 的是 `stage-scene-layer` 的场景元素缓存：没变的子树交回同一个元素，React 直接跳过。
   */

  /*
   * 豁免分两级，**范围由理由决定**：
   *
   * - 节点级——有一条路径会按这个 id 去 DOM 里找节点（今天全仓只有
   *   `instanceSelectionScreenBounds` 一处），找的就是那一个，因此只带上祖先链；
   * - 子树级——这棵子树此刻的几何由预览变换决定，索引里的那份是过期的，过期的是整棵。
   *
   * 选择集与实例下钻宿主属于前者：选区 chrome 读的是布局快照，只有实例内部那条查询读 DOM。
   * 把选择集做成子树级会让「选中一块场景」当场关掉整块场景的裁剪。
   */
  const nodeExemptKey = joinIds(new Set([
    ...(textEditingEntityId === null ? [] : [textEditingEntityId]),
    ...selectedIds.flatMap((id) => {
      if (!isComposeInstancePath(id)) return [id]
      const decoded = decodeComposeInstancePath(id)
      const hostId = decoded.ok ? decoded.segments[0] : undefined
      return hostId === undefined ? [] : [hostId]
    }),
  ]))
  const subtreeExemptKey = joinIds(Object.keys(previewTransforms))

  /*
   * 细节裁剪：这一档下小到读不出来的叶子。只随索引、档位与 Registry 变——与窗口一样，
   * 档内缩放不重建；阈值由物料声明，这里只负责把声明查出来交给判定。
   */
  const zoomStep = cullingWindow.zoomStep
  const detailCulled = useMemo(() => {
    if (!surfaceMeasured) return NO_CULLED_IDS
    return resolveStageDetailCulledIds(index, zoomStep, (entityId) => {
      const entity = index.document.entities[entityId]
      const renderer = entity && getComposeRenderer(entity)
      return (renderer && registry.getRenderer(renderer.type)?.minimumLegibleSize) ?? null
    })
  }, [index, registry, surfaceMeasured, zoomStep])

  const result = useMemo(() => {
    if (!surfaceMeasured) return { culledEntityIds: NO_CULLED_IDS, detailCulledEntityIds: NO_CULLED_IDS }
    const exemptions = { nodes: splitIds(nodeExemptKey), subtrees: splitIds(subtreeExemptKey) }
    const visible = new Set(resolveStageVisibleEntityIds(index, cullingWindow, exemptions))
    // 豁免压过可读性：选中一个小字它就得在，属性面板与选区盒都要它的节点。
    const exempt = resolveStageCullingExemptIds(index, exemptions)
    for (const entityId of detailCulled) if (!exempt.has(entityId)) visible.delete(entityId)
    if (visible.size >= index.order.length * (1 - MIN_CULLED_FRACTION)) {
      return { culledEntityIds: NO_CULLED_IDS, detailCulledEntityIds: NO_CULLED_IDS }
    }
    const culled = index.order.filter((entityId) => !visible.has(entityId))
    return {
      culledEntityIds: new Set(culled),
      detailCulledEntityIds: new Set(culled.filter((entityId) => detailCulled.has(entityId))),
    }
  }, [cullingWindow, detailCulled, index, nodeExemptKey, subtreeExemptKey, surfaceMeasured])
  const batchKey = `${zoomStep}${ID_SEPARATOR}${nodeExemptKey}${ID_SEPARATOR}${subtreeExemptKey}`
  return useMemo(() => ({ ...result, batchKey }), [batchKey, result])
}
