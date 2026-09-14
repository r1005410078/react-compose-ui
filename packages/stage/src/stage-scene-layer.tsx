import {
  ComposeEntityBorderLayer,
  ComposeEntityPaintLayer,
  ComposeRegistryEntityRenderer,
  composeEntityOverflowStyle,
  composeEntitySceneStyle,
} from '@compose-ui/component-registry'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import {
  getComposeCurve,
  getComposeFrame,
  getComposeHierarchy,
  getComposeLock,
  getComposeVisibility,
  resolveComposeOverflow,
  type ComposeDocument,
  type ComposeEntity,
  type ComposePaint,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type { ComposePageScriptScope, ComposeScriptModuleLoader } from '@compose-ui/script-runtime'
import type { StageSceneIndex, StageViewport } from '@compose-ui/stage-engine'
import {
  drainStageCullingReveal,
  initialStageCullingReveal,
  planStageCullingReveal,
  type StageCullingReveal,
} from './stage-culling-reveal'
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react'

function StageOverflowIndicator({
  horizontal,
  vertical,
}: {
  readonly horizontal: boolean
  readonly vertical: boolean
}) {
  if (!horizontal && !vertical) return null
  return (
    <div
      aria-hidden="true"
      className="compose-stage__overflow-indicators"
      style={{ pointerEvents: 'none' }}
    >
      {horizontal ? (
        <span className="compose-stage__overflow-indicator is-horizontal" data-testid="stage-overflow-indicator-x">
          <span />
        </span>
      ) : null}
      {vertical ? (
        <span className="compose-stage__overflow-indicator is-vertical" data-testid="stage-overflow-indicator-y">
          <span />
        </span>
      ) : null}
    </div>
  )
}

/**
 * 一个 Entity 的场景元素连同产出它的全部输入。
 *
 * @remarks
 * 输入全部按**引用**比较：Entity 与盒都是不可变对象，文档与布局快照在没动它们时会原样复用
 * 同一个对象（布局 Runtime 对没变的盒写回 `previous`），因此「引用相同」就是「输入相同」。
 */
interface StageSceneNodeCacheEntry {
  readonly assetResolver: ComposeAssetResolver | undefined
  readonly box: ComposeLayoutSnapshot['boxes'][string]
  readonly children: readonly ReactNode[] | undefined
  readonly element: ReactElement
  readonly paint: ComposePaint | undefined
  readonly registry: ComposeEntityRegistry
  readonly scriptModuleLoader: ComposeScriptModuleLoader | undefined
  readonly scriptScope: ComposePageScriptScope | undefined
  readonly textEditing: StageTextEditing | undefined
}

/**
 * 场景元素缓存：同一个 Entity 在输入没变时给出**同一个**元素对象。
 *
 * @remarks
 * 这一层缓存是视口裁剪换窗那一帧能同步完成的前提。换窗时内容子树要整棵重算，而 React 对
 * host 元素只有在 `oldProps === newProps` 时才 bail out——元素对象换了，哪怕每一个字段都
 * 相同，也要把整棵子树重新走一遍。实测两千个节点上那一趟是 80ms，正好落在平移帧上。
 *
 * 缓存之后没变的子树交回去的是同一个元素，React 在那个 fiber 上直接跳过整棵后代；换窗那
 * 一帧真正的工作只剩新进窗口的那一条带子。
 *
 * 曾经试过把这一趟重建交给 `useDeferredValue` 降级，**那样行不通**：React 18 的低优先级
 * 渲染每收到一次高优先级更新就整个重来，而平移每一帧都是一次高优先级更新——连续拖动时它
 * 永远完不成，直到五秒的过期强制同步刷出，用户看到的是「图要等很久才出来」。让那一趟便宜
 * 才是答案，不是让它晚一点。
 *
 * 以 Entity 对象为键：它不可变、跨文档版本共享，因此键的生命周期就是它自己的。第二层按
 * **Stage 实例**分开——元素里的指针回调闭包捕获的是那个实例的 ref，两个 Stage 渲染同一份
 * 文档时若共用一条缓存，就会把一个实例的指针回调交给另一个。
 */
const sceneNodeCache = new WeakMap<ComposeEntity, WeakMap<object, StageSceneNodeCacheEntry>>()

function cachedSceneNode(instance: object, entity: ComposeEntity) {
  return sceneNodeCache.get(entity)?.get(instance)
}

function storeSceneNode(instance: object, entity: ComposeEntity, entry: StageSceneNodeCacheEntry) {
  let perInstance = sceneNodeCache.get(entity)
  if (!perInstance) {
    perInstance = new WeakMap()
    sceneNodeCache.set(entity, perInstance)
  }
  perInstance.set(instance, entry)
}

function sameChildren(
  previous: readonly ReactNode[] | undefined,
  next: readonly ReactNode[] | undefined,
) {
  if (previous === next) return true
  if (!previous || !next || previous.length !== next.length) return false
  for (let i = 0; i < previous.length; i += 1) if (previous[i] !== next[i]) return false
  return true
}

/**
 * 大容器的子级每桶装多少个。
 *
 * @remarks
 * 一块场景直接挂着五千个子级时，子级数组只要换了一个元素，React 就要把五千个子 fiber 全部
 * 克隆一遍——哪怕其中四千九百个当场 bail out，这一趟本身就是每帧好几毫秒的固定开销，而分批
 * 揭示时**每一帧**都在换这个数组。按桶包进 `memo` 组件之后，没变的桶交回同一个数组，React
 * 在桶上就跳过，根只需要走几十个桶。桶按文档顺序连续切分，DOM 顺序（也就是绘制顺序）因此
 * 一个字节不变。
 *
 * 前提是每一批在文档里是**连续**的（队列按文档顺序排）：散在各桶里的一批会碰到每一个桶，
 * 分桶只剩开销——实测那样比不分桶还慢。
 */
const SCENE_CHILD_BUCKET_SIZE = 256

interface StageSceneBucketProps {
  readonly children: readonly ReactNode[]
}

/** 一桶子级；`memo` 让没变的桶整桶跳过。 */
const StageSceneBucket = memo(function StageSceneBucket({ children }: StageSceneBucketProps) {
  return <>{children}</>
})

type StageSceneBucketElement = ReactElement<StageSceneBucketProps>

/** 把子级切成桶；能复用上一次的桶就复用**同一个数组与同一个元素**——`memo` 比的是引用。 */
function bucketChildren(
  rendered: readonly ReactNode[],
  previous: readonly StageSceneBucketElement[] | undefined,
): readonly StageSceneBucketElement[] {
  const buckets: StageSceneBucketElement[] = []
  for (let start = 0, i = 0; start < rendered.length; start += SCENE_CHILD_BUCKET_SIZE, i += 1) {
    const slice = rendered.slice(start, start + SCENE_CHILD_BUCKET_SIZE)
    const prior = previous?.[i]
    buckets.push(prior && sameChildren(prior.props.children, slice)
      ? prior
      : <StageSceneBucket key={i}>{slice}</StageSceneBucket>)
  }
  return buckets
}

/** 没有裁剪、没有排队时都返回同一个引用；identity 稳定才不会让记忆化与 effect 每帧空转。 */
const NO_CULLED_IDS: ReadonlySet<string> = new Set<string>()
const NO_PENDING: readonly string[] = []

interface StageTextEditing {
  readonly entityId: string
  readonly value: string
  readonly onChange: (value: string) => void
}

interface StageSceneLayerProps {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly registry: ComposeEntityRegistry
  readonly assetResolver?: ComposeAssetResolver
  /** 页面型物料使用的文档加载端口；类型来自 core，Stage 不实现加载。 */
  readonly scriptScope?: ComposePageScriptScope
  readonly scriptModuleLoader?: ComposeScriptModuleLoader
  readonly viewport: StageViewport
  readonly paintPreview?: { readonly entityId: string; readonly paint: ComposePaint } | null
  /**
   * 额外跳过渲染的 Entity；其后代由递归自然剪掉。
   *
   * 由宿主从 core 的 WidgetSwitcher 隐藏派生得到，与 SceneIndex 共用同一个集合引用，
   * 保证「看得见」与「点得到」始终一致。
   */
  readonly hiddenEntityIds?: ReadonlySet<string>
  /**
   * 这一帧被视口裁剪掉的 Entity；其后代由递归自然剪掉。
   *
   * **与 `hiddenEntityIds` 形状一样，语义相反，因此 MUST NOT 合并**：`hidden` 是渲染与
   * 命中两边都没有，裁剪是**只有渲染这一边**没有。合并会让「看得见」与「点得到」分家。
   *
   * 传的是「被裁掉的」而不是「该渲染的」，因此只跳过被点名的——预览文档里刚建出来、场景
   * 索引还不认识的 Entity 照常渲染。
   */
  readonly culledEntityIds?: ReadonlySet<string>
  /**
   * `culledEntityIds` 变化时能不能分批逼近：键与上一次相同就能。
   *
   * 缺席即每次都当帧到齐。
   */
  readonly cullingBatchKey?: string
  /**
   * `culledEntityIds` 里**只因读不出来**被裁的那一部分。
   *
   * @remarks
   * 批次键变了（缩放跨档）时，由它带进来或带走的一律排队，其余当帧到齐——见
   * `planStageCullingReveal`。缺席即没有细节裁剪。
   */
  readonly detailCulledEntityIds?: ReadonlySet<string>
  /** 已提交文档的场景索引；分批时队列按它的文档顺序排，索引换了就不分批。 */
  readonly sceneIndex?: StageSceneIndex
  /** 正在画布内原地编辑文字的 Entity；只有它的 Renderer 收到编辑态。 */
  readonly textEditingEntityId?: string | null
  /**
   * 进入编辑时 Entity 的 authored 纯文本，用于给编辑目标播种初始内容。
   *
   * 它不是实时值：编辑期间的文本由 DOM 持有，Renderer 不得在编辑中用它回写内容，
   * 否则 Auto width 引起的重排会把用户刚敲的字覆盖掉。
   */
  readonly textEditingValue?: string | null
  /** 报告编辑中的纯文本；Stage 据此更新运行时覆盖，不派发文档命令。 */
  readonly onTextEditingChange?: (value: string) => void
  readonly onEntityPointerDown: (
    entity: ComposeEntity,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void
}

/** 只负责把 preview document 映射成可交互 DOM Scene。 */
export function StageSceneLayer({
  document,
  layoutSnapshot,
  registry,
  assetResolver,
  scriptScope,
  scriptModuleLoader,
  viewport,
  paintPreview,
  hiddenEntityIds,
  culledEntityIds = NO_CULLED_IDS,
  cullingBatchKey,
  detailCulledEntityIds = NO_CULLED_IDS,
  sceneIndex,
  textEditingEntityId = null,
  textEditingValue = null,
  onTextEditingChange,
  onEntityPointerDown,
}: StageSceneLayerProps) {
  // Stage 每次渲染都会重建 pointer 回调。用 ref 转发可让内容子树的记忆化只依赖场景事实，
  // 不被回调身份击穿。回调只在 commit 之后的 DOM 事件里读取，因此在 layout effect 中更新。
  const pointerDownRef = useRef(onEntityPointerDown)
  useLayoutEffect(() => {
    pointerDownRef.current = onEntityPointerDown
  }, [onEntityPointerDown])
  // 场景元素缓存的实例令牌：只当键用，与组件同生命周期。
  const cacheInstance = useMemo(() => ({}), [])
  // 编辑态只在会话进出时变化，因此可以直接进入 memo 依赖：编辑中的文本不经过这里，
  // 它由编辑目标的 contentEditable DOM 自己持有，不会每敲一个字符就重建整棵场景。
  const textEditing = useMemo<StageTextEditing | null>(
    () => textEditingEntityId === null || !onTextEditingChange
      ? null
      : {
          entityId: textEditingEntityId,
          value: textEditingValue ?? '',
          onChange: onTextEditingChange,
        },
    [onTextEditingChange, textEditingEntityId, textEditingValue],
  )

  /*
   * 目标裁剪集变了就当场推导两条队列（React 的「按 prop 推导状态」写法，同一趟渲染里完成）：
   * 上一帧实际生效的是 `(target − pendingCull) ∪ pendingReveal`，拿它与新目标相减，两边的差
   * 就是两条队列。放进 effect 里推导会晚一帧，而那一帧新进的整条带子会一次性全挂上——正是
   * 要避开的那一下。
   *
   * 换窗那一帧因此**什么都不挂不卸**：实际裁剪集与上一帧相同，内容按缓存走一遍之后交回同一
   * 棵元素树，React 在根上直接跳过。挂与卸从下一帧起每帧一批。
   *
   * 两条队列都按**文档顺序**排，见 `SCENE_CHILD_BUCKET_SIZE`。
   */
  const [reveal, setReveal] = useState<StageCullingReveal>(() => initialStageCullingReveal({
    batchKey: cullingBatchKey,
    detail: detailCulledEntityIds,
    index: sceneIndex,
    target: culledEntityIds,
  }))
  const documentPosition = useMemo(
    () => new Map(sceneIndex?.order.map((entityId, i) => [entityId, i] as const) ?? []),
    [sceneIndex],
  )
  if (reveal.target !== culledEntityIds) {
    setReveal(planStageCullingReveal(reveal, {
      batchKey: cullingBatchKey,
      detail: detailCulledEntityIds,
      index: sceneIndex,
      target: culledEntityIds,
    }, documentPosition))
  }
  // 推导那一趟渲染里 `reveal` 还是旧的，此时两条队列就是刚算出来的那份；只有稳定引用才能
  // 让下面的 effect 与记忆化不在每一帧空转。
  const queues = useMemo(
    () => reveal.target === culledEntityIds
      ? { pendingCull: reveal.pendingCull, pendingReveal: reveal.pendingReveal }
      : { pendingCull: NO_PENDING, pendingReveal: NO_PENDING },
    [culledEntityIds, reveal],
  )
  const draining = queues.pendingCull.length > 0 || queues.pendingReveal.length > 0
  useEffect(() => {
    if (!draining) return
    const frame = requestAnimationFrame(() => {
      setReveal(drainStageCullingReveal)
    })
    return () => cancelAnimationFrame(frame)
  }, [draining, queues])
  const appliedCulledIds = useMemo(() => {
    if (!draining) return culledEntityIds
    const applied = new Set(culledEntityIds)
    for (const entityId of queues.pendingCull) applied.delete(entityId)
    for (const entityId of queues.pendingReveal) applied.add(entityId)
    return applied
  }, [culledEntityIds, draining, queues])

  // 平移与缩放只改变根节点 transform，场景内容本身不变。这里把内容子树与 viewport 解耦，
  // 否则每个平移帧都要为全部 Entity 重建 element 并做 fiber diff，大场景下直接掉帧。
  const content = useMemo(() => {
    const renderEntity = (entityId: string) => {
      const entity = document.entities[entityId]
      if (!entity || !getComposeVisibility(entity).visible) return null
      if (hiddenEntityIds?.has(entityId)) return null
      if (appliedCulledIds.has(entityId)) return null
      const hierarchy = getComposeHierarchy(entity)
      // 线状节点的外接矩形里绝大部分是空的，不能让它拦截画布点击：盒交给 pointer-events:none，
      // 命中由物料自己的加宽透明 stroke 承担（填过色时那块面积也由物料自己接住）。判据是
      // `Curve` Component 而不是 Renderer 类型——「这个 Entity 是不是线状的」是几何问题，
      // 不是某个物料的私事。
      const isSegment = Boolean(getComposeCurve(entity))
      const box = layoutSnapshot.boxes[entityId]
      if (!box) return null
      const paint = paintPreview?.entityId === entity.id ? paintPreview.paint : undefined
      const editing = textEditing?.entityId === entity.id ? textEditing : undefined
      const cached = cachedSceneNode(cacheInstance, entity)
      const rendered = hierarchy?.childIds.map(renderEntity)
      const children = rendered && rendered.length > SCENE_CHILD_BUCKET_SIZE
        ? bucketChildren(rendered, cached?.children as readonly StageSceneBucketElement[] | undefined)
        : rendered
      if (
        cached
        && cached.box === box
        && cached.assetResolver === assetResolver
        && cached.registry === registry
        && cached.scriptModuleLoader === scriptModuleLoader
        && cached.scriptScope === scriptScope
        && cached.paint === paint
        && cached.textEditing === editing
        && sameChildren(cached.children, children)
      ) {
        return cached.element
      }
      const locked = getComposeLock(entity).locked
      // 指示器仍读领域 overflow；盒样式与 Preview/NestedEntity 共用 composeEntityOverflowStyle。
      const overflow = resolveComposeOverflow(entity)
      const element = (
        <div
          className={`compose-stage__node${hierarchy ? ' is-container' : ' is-renderer'}${
            locked ? ' is-locked' : ''
          }${isSegment ? ' is-segment' : ''}`}
          data-entity-id={entity.id}
          data-testid={getComposeFrame(entity)
            ? `stage-frame-${entity.id}`
            : hierarchy ? 'stage-container' : `stage-entity-${entity.id}`}
          key={entity.id}
          style={{
            ...composeEntitySceneStyle(entity, box),
            ...composeEntityOverflowStyle(entity),
          }}
          onPointerDown={(event) => pointerDownRef.current(entity, event)}
        >
          <ComposeEntityPaintLayer
            assetResolver={assetResolver}
            entity={entity}
            interactive={Boolean(hierarchy)}
            paint={paint}
          />
          <ComposeRegistryEntityRenderer
            assetResolver={assetResolver}
            entity={entity}
            mode="editor"
            registry={registry}
            scriptModuleLoader={scriptModuleLoader}
            scriptScope={scriptScope}
            textEditing={editing}
          />
          {children}
          {hierarchy ? (
            <StageOverflowIndicator
              horizontal={overflow.horizontal === 'scroll'}
              vertical={overflow.vertical === 'scroll'}
            />
          ) : null}
          <ComposeEntityBorderLayer entity={entity} />
        </div>
      )
      storeSceneNode(cacheInstance, entity, {
        assetResolver,
        box,
        children,
        element,
        paint,
        registry,
        scriptModuleLoader,
        scriptScope,
        textEditing: editing,
      })
      return element
    }
    return document.rootIds.map(renderEntity)
  }, [
    appliedCulledIds,
    assetResolver,
    cacheInstance,
    document,
    hiddenEntityIds,
    layoutSnapshot,
      paintPreview,
    registry,
    scriptModuleLoader,
    scriptScope,
    textEditing,
  ])

  return (
    <div
      className="compose-stage__scene"
      data-testid="stage-scene-layer"
      style={{
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        /*
         * 把缩放同时发成 CSS 自定义属性，供需要**屏幕像素**语义的物料反向除掉它。
         *
         * `vector-effect: non-scaling-stroke` 在这里**不管用**：它只中和 SVG 文档片段
         * *内部*的变换，而这里的缩放来自 SVG 之外的 HTML 祖先。实测放大 4.22 倍后描边
         * 的实际触达从 6px 涨到 29px，computed 值却老老实实是 `non-scaling-stroke`——
         * 只断言属性生效的用例会全绿。
         *
         * 走 CSS 变量而不是把 zoom 塞进 Renderer 协议：预览没有画布缩放，那边读不到这个
         * 变量就回退到 1，页面单位因此自动成立，物料不需要认识「编辑期还是渲染期」。
         */
        ['--compose-canvas-zoom' as string]: viewport.zoom,
      }}
    >
      {content}
    </div>
  )
}
