import {
  composeGridContentHeight,
  getComposeGridItem,
  getComposeHierarchy,
  getComposeFrame,
  getComposeLayout,
  getComposeLayoutItem,
  getComposeRenderer,
  isComposeGridLayout,
  projectComposeGridCell,
  resolveComposeAppearance,
  resolveComposeHatches,
  resolveComposeWires,
  solveComposeGrid,
  type ComposeAlignContent,
  type ComposeAlignItems,
  type ComposeAxisSizing,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeFlexDirection,
  type ComposeFlexWrap,
  type ComposeJustifyContent,
  type ComposeLayoutDiagnostic,
  type ComposeLayoutMeasurementDiagnostic,
  type ComposeLayoutMeasurementPort,
  type ComposeGridCell,
  type ComposeGridMetrics,
  type ComposeLayoutSnapshot,
  type ComposeMeasureConstraint,
} from '@compose-ui/core'
import type { Config, Node, Yoga } from 'yoga-layout/load'

/** Layout Runtime 当前可观察状态。 @public */
export type ComposeLayoutRuntimeState =
  | { readonly status: 'loading'; readonly document: ComposeDocument }
  | {
      readonly status: 'ready'
      /**
       * 求解结果对应的文档。
       *
       * @remarks
       * 导线解算之后这里是**已解算**的那份，与 `snapshot` 是同一次求解的一致对；订阅方渲染与
       * 命中都读它。要判断「这个状态是不是我传进来的那份文档产出的」，读 `sourceDocument`。
       */
      readonly document: ComposeDocument
      /** 产出本状态的输入文档；只用于身份判定。 */
      readonly sourceDocument: ComposeDocument
      readonly snapshot: ComposeLayoutSnapshot
      /**
       * 该 Snapshot 是否来自手势期预览求解。
       *
       * @remarks
       * 预览态的 `document` 是宿主提交的瞬态文档，不等于最后一次正式提交；订阅方不应把
       * 预览 Snapshot 当作文档变化的依据。
       */
      readonly preview: boolean
    }
  | { readonly status: 'error'; readonly document: ComposeDocument; readonly error: Error }

/** 创建 Layout Runtime 的输入。 @public */
export interface ComposeLayoutRuntimeOptions {
  readonly document: ComposeDocument
  readonly measurementPort?: ComposeLayoutMeasurementPort
}

/** 文档会话级布局运行时。 @public */
export interface ComposeLayoutRuntime {
  getState(): ComposeLayoutRuntimeState
  /**
   * 最后一次**正式提交**的状态：预览求解期间保持返回预览开始前的提交态（引用稳定）。
   *
   * @remarks
   * 供交互 Controller context、SceneIndex 等必须忽略预览的消费方使用；无预览时与
   * {@link ComposeLayoutRuntime.getState} 相同。
   */
  getCommittedState(): ComposeLayoutRuntimeState
  updateDocument(document: ComposeDocument): void
  /**
   * 用瞬态预览文档求解并发布带预览标记的 Snapshot。
   *
   * @remarks
   * 供手势期实时布局使用：不改变正式提交状态、不产生文档事务。下一次
   * {@link ComposeLayoutRuntime.updateDocument} 会隐式终止预览；引擎仍在加载时调用被忽略
   * （加载期不存在可交互手势）。
   */
  previewDocument(document: ComposeDocument): void
  /** 结束预览并回到最后一次正式提交的求解结果；无生效预览时为 no-op。 */
  clearPreview(): void
  setMeasurementPort(port: ComposeLayoutMeasurementPort | undefined): void
  subscribe(listener: () => void): () => void
  dispose(): void
}

let yogaModulePromise: Promise<Yoga> | undefined

type ComposeYogaLoader = () => Promise<Yoga>

/**
 * 网格求解的最大趟数。
 *
 * @remarks
 * 每多一层嵌套网格就多要一趟（内层的列宽要等外层把格矩形写进去之后才算得出来），再加一趟
 * 确认不再变化。8 覆盖六层嵌套，而这个产品里一块板子套一块板子已经是极限。
 */
const MAX_GRID_PASSES = 8

function loadYogaSingleton(): Promise<Yoga> {
  yogaModulePromise ??= import('yoga-layout/load').then(({ loadYoga }) => loadYoga())
  return yogaModulePromise
}

function align(yoga: Yoga, value: ComposeAlignItems | ComposeAlignContent | 'auto') {
  return {
    auto: yoga.ALIGN_AUTO,
    'flex-start': yoga.ALIGN_FLEX_START,
    center: yoga.ALIGN_CENTER,
    'flex-end': yoga.ALIGN_FLEX_END,
    stretch: yoga.ALIGN_STRETCH,
    baseline: yoga.ALIGN_BASELINE,
    'space-between': yoga.ALIGN_SPACE_BETWEEN,
    'space-around': yoga.ALIGN_SPACE_AROUND,
  }[value]
}

function justify(yoga: Yoga, value: ComposeJustifyContent) {
  return {
    'flex-start': yoga.JUSTIFY_FLEX_START,
    center: yoga.JUSTIFY_CENTER,
    'flex-end': yoga.JUSTIFY_FLEX_END,
    'space-between': yoga.JUSTIFY_SPACE_BETWEEN,
    'space-around': yoga.JUSTIFY_SPACE_AROUND,
    'space-evenly': yoga.JUSTIFY_SPACE_EVENLY,
  }[value]
}

function direction(yoga: Yoga, value: ComposeFlexDirection) {
  return {
    row: yoga.FLEX_DIRECTION_ROW,
    'row-reverse': yoga.FLEX_DIRECTION_ROW_REVERSE,
    column: yoga.FLEX_DIRECTION_COLUMN,
    'column-reverse': yoga.FLEX_DIRECTION_COLUMN_REVERSE,
  }[value]
}

function wrap(yoga: Yoga, value: ComposeFlexWrap) {
  return {
    nowrap: yoga.WRAP_NO_WRAP,
    wrap: yoga.WRAP_WRAP,
    'wrap-reverse': yoga.WRAP_WRAP_REVERSE,
  }[value]
}

function measureConstraint(yoga: Yoga, mode: number, value: number): ComposeMeasureConstraint {
  if (mode === yoga.MEASURE_MODE_EXACTLY) return { mode: 'exactly', value }
  if (mode === yoga.MEASURE_MODE_AT_MOST) return { mode: 'at-most', value }
  return { mode: 'undefined' }
}

/**
 * 两份盒表是否逐项相同。
 *
 * @remarks
 * **按值比而不是按引用比**：求解会复用上一份 Snapshot 里值未变的冻结盒，而这里要比的是
 * 「提交态」与「刚从预览态解回来的结果」，后者的上一份是预览 Snapshot，因此即使数值相同
 * 也是两个不同的对象。
 */
function sameLayoutBoxes(
  a: ComposeLayoutSnapshot['boxes'],
  b: ComposeLayoutSnapshot['boxes'],
): boolean {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((id) => {
    const left = a[id]
    const right = b[id]
    return Boolean(left && right)
      && left!.x === right!.x
      && left!.y === right!.y
      && left!.width === right!.width
      && left!.height === right!.height
      && left!.positioning === right!.positioning
  })
}

/** 两份诊断是否逐项相同。 */
function sameLayoutDiagnostics(
  a: readonly ComposeLayoutDiagnostic[],
  b: readonly ComposeLayoutDiagnostic[],
): boolean {
  return a.length === b.length
    && a.every((left, index) => {
      const right = b[index]!
      return left.code === right.code
        && left.entityId === right.entityId
        && left.axis === right.axis
        && left.message === right.message
    })
}

function sameConstraint(a: ComposeMeasureConstraint, b: ComposeMeasureConstraint): boolean {
  if (a.mode !== b.mode) return false
  if (a.mode === 'undefined') return true
  return 'value' in a && 'value' in b && a.value === b.value
}

function setAxisBounds(node: Node, axis: 'width' | 'height', sizing: ComposeAxisSizing) {
  if (axis === 'width') {
    node.setMinWidth(sizing.min ?? undefined)
    node.setMaxWidth(sizing.max ?? undefined)
  }
  else {
    node.setMinHeight(sizing.min ?? undefined)
    node.setMaxHeight(sizing.max ?? undefined)
  }
}

class YogaLayoutRuntime implements ComposeLayoutRuntime {
  private state!: ComposeLayoutRuntimeState
  private readonly listeners = new Set<() => void>()
  private document: ComposeDocument
  private measurementPort: ComposeLayoutMeasurementPort | undefined
  private measurementUnsubscribe: (() => void) | undefined
  private yoga: Yoga | undefined
  private config: Config | undefined
  private root: Node | undefined
  private readonly nodes = new Map<string, Node>()
  /**
   * 样式增量缓存：Entity 引用与父级 Layout 引用都未变时跳过整套 Yoga setter 重写。
   *
   * @remarks
   * 单个 Entity 的样式只由自身组件与父级 Layout（决定 isFlow 与主轴方向）推导；文档不可变，
   * 引用未变即输入未变。跨 WASM 边界的 setter 是全量 solve 的主要成本（实测约占 90%），
   * 该缓存把单次重解成本从文档总量降到变更子树规模。
   */
  private readonly styleCache = new Map<string, {
    readonly entity: ComposeEntity
    readonly parentLayout: ReturnType<typeof getComposeLayout>
  }>()

  /**
   * 测量结果缓存：Renderer 引用与 Yoga 约束都未变时不重新调用 measurement port。
   *
   * @remarks
   * adapter 契约要求只测量隔离内容，测量输入因此不含 LayoutItem——这让「仅几何变化」的
   * 高频路径（拖拽 offset/margin）不会触发宿主的真实 DOM 测量。port 或其 revision 失效时
   * 由 setMeasurementPort/invalidateMeasurements 清除对应条目。只缓存成功结果，
   * 失败允许下次重试。
   */
  private readonly measurementCache = new Map<string, {
    readonly renderer: ReturnType<typeof getComposeRenderer>
    readonly width: ComposeMeasureConstraint
    readonly height: ComposeMeasureConstraint
    readonly result: { readonly width: number; readonly height: number; readonly baseline?: number }
  }>()

  private readonly measuredEntityIds = new Set<string>()
  /** 挂起的合并重解；`solve()` 与 `dispose()` 用换掉它的方式作废那一次，见 `invalidateMeasurements`。 */
  private pendingRecalculation: object | undefined
  private readonly measurementDiagnostics = new Map<
    string,
    ComposeLayoutMeasurementDiagnostic
  >()
  private revision = 0
  /** 本次求解里各网格子级已写入的格矩形，供收敛循环判断「还在变吗」。 */
  private readonly gridWrites = new Map<string, string>()
  private disposed = false
  /** 最后一次正式提交的文档；`document` 在预览期指向瞬态文档，结束后回到这里。 */
  private committedDocument: ComposeDocument
  private previewing = false
  /** 与 `state` 同步维护的最后提交态，见 {@link ComposeLayoutRuntime.getCommittedState}。 */
  private lastCommittedState: ComposeLayoutRuntimeState

  /** 统一入口：非预览态的每次状态替换同时刷新提交态缓存。 */
  private setState(next: ComposeLayoutRuntimeState) {
    this.state = next
    if (!(next.status === 'ready' && next.preview)) this.lastCommittedState = next
  }

  constructor(
    options: ComposeLayoutRuntimeOptions,
    private readonly loadYoga: ComposeYogaLoader = loadYogaSingleton,
  ) {
    this.document = options.document
    this.committedDocument = options.document
    this.lastCommittedState = { status: 'loading', document: options.document }
    this.setState({ status: 'loading', document: options.document })
    this.setMeasurementPort(options.measurementPort)
    void this.initialize()
  }

  // React 的 useSyncExternalStore 会把 getter 作为裸函数调用，因此这里必须保留词法 this。
  readonly getState = () => this.state

  readonly getCommittedState = () => (this.state.status === 'ready' && this.state.preview
    ? this.lastCommittedState
    : this.state)

  updateDocument(document: ComposeDocument) {
    if (this.disposed || (this.document === document && !this.previewing)) return
    // 正式提交隐式终止预览：即使文档引用与提交前相同，也要把求解结果切回提交态。
    this.previewing = false
    this.committedDocument = document
    this.document = document
    if (this.yoga) this.solve()
    else this.setState({ status: 'loading', document })
  }

  previewDocument(document: ComposeDocument) {
    // 加载期不存在可交互手势，忽略而不是排队——迟到的预览只会覆盖首帧正式求解。
    if (this.disposed || !this.yoga || this.document === document) return
    this.previewing = true
    this.document = document
    this.solve()
  }

  clearPreview() {
    if (this.disposed || !this.previewing) return
    this.previewing = false
    this.document = this.committedDocument
    if (this.yoga) this.solve()
  }

  setMeasurementPort(port: ComposeLayoutMeasurementPort | undefined) {
    if (this.disposed || this.measurementPort === port) return
    this.measurementUnsubscribe?.()
    this.measurementPort = port
    // 不同 port 对同一约束可能给出不同结果，缓存跨 port 无效。
    this.measurementCache.clear()
    this.measurementUnsubscribe = port?.subscribe((entityIds) => {
      if (this.yoga && !this.disposed) this.invalidateMeasurements(entityIds)
    })
    if (this.yoga) this.invalidateMeasurements()
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.measurementUnsubscribe?.()
    this.measurementUnsubscribe = undefined
    this.listeners.clear()
    this.releaseYogaObjects()
  }

  private emit() {
    this.listeners.forEach((listener) => listener())
  }

  private async initialize() {
    try {
      const yoga = await this.loadYoga()
      if (this.disposed) return
      this.yoga = yoga
      this.config = yoga.Config.create()
      this.config.setUseWebDefaults(true)
      this.config.setPointScaleFactor(0)
      this.root = yoga.Node.createWithConfig(this.config)
      this.solve()
    }
    catch (cause) {
      if (this.disposed) return
      this.setState({
        status: 'error',
        document: this.document,
        error: cause instanceof Error ? cause : new Error(String(cause)),
      })
      this.emit()
    }
  }

  private releaseYogaObjects() {
    this.nodes.forEach((node) => node.free())
    this.nodes.clear()
    this.measuredEntityIds.clear()
    this.measurementDiagnostics.clear()
    this.styleCache.clear()
    this.measurementCache.clear()
    this.root?.free()
    this.root = undefined
    this.config?.free()
    this.config = undefined
    this.yoga = undefined
  }

  private nodeFor(entityId: string) {
    let node = this.nodes.get(entityId)
    if (!node) {
      node = this.yoga!.Node.createWithConfig(this.config!)
      this.nodes.set(entityId, node)
    }
    return node
  }

  private detachChildren(node: Node) {
    while (node.getChildCount() > 0) node.removeChild(node.getChild(0))
  }

  private clearEntityStyle(node: Node) {
    const yoga = this.yoga!
    node.unsetMeasureFunc()
    node.setWidth(undefined)
    node.setHeight(undefined)
    node.setMinWidth(undefined)
    node.setMinHeight(undefined)
    node.setMaxWidth(undefined)
    node.setMaxHeight(undefined)
    node.setFlexGrow(0)
    node.setFlexShrink(1)
    node.setFlexBasis('auto')
    node.setPositionType(yoga.POSITION_TYPE_RELATIVE)
    node.setAlignSelf(yoga.ALIGN_AUTO)
    node.setFlexDirection(yoga.FLEX_DIRECTION_ROW)
    node.setFlexWrap(yoga.WRAP_NO_WRAP)
    node.setAlignContent(yoga.ALIGN_STRETCH)
    node.setJustifyContent(yoga.JUSTIFY_FLEX_START)
    node.setAlignItems(yoga.ALIGN_STRETCH)
    for (const edge of [yoga.EDGE_TOP, yoga.EDGE_RIGHT, yoga.EDGE_BOTTOM, yoga.EDGE_LEFT]) {
      node.setPosition(edge, undefined)
      node.setMargin(edge, 0)
      node.setPadding(edge, 0)
      node.setBorder(edge, 0)
    }
    node.setGap(yoga.GUTTER_ROW, 0)
    node.setGap(yoga.GUTTER_COLUMN, 0)
  }

  private syncTree(
    desiredChildren: ReadonlyMap<Node, readonly Node[]>,
  ) {
    const changedParents = [...desiredChildren].filter(([parent, desired]) => (
      parent.getChildCount() !== desired.length
      || desired.some((child, index) => parent.getChild(index) !== child)
    ))
    // 先统一解绑所有变化父级，再插入目标顺序；跨父级移动时不会把仍有 owner 的 Node
    // 插入新父级，也不会触发 Yoga reset() 在增量树上的已知卡死路径。
    changedParents.forEach(([parent]) => this.detachChildren(parent))
    changedParents.forEach(([parent, desired]) => {
      desired.forEach((child, index) => parent.insertChild(child, index))
    })
  }

  private applyAxis(
    node: Node,
    axis: 'width' | 'height',
    sizing: ComposeAxisSizing,
    isMainAxis: boolean,
    isFlow: boolean,
  ) {
    setAxisBounds(node, axis, sizing)
    const setSize = axis === 'width'
      ? (value: number | undefined) => node.setWidth(value)
      : (value: number | undefined) => node.setHeight(value)
    if (sizing.mode === 'fixed') {
      setSize(sizing.value)
      if (isMainAxis) node.setFlexShrink(0)
      return
    }
    if (sizing.mode === 'fill' && !isFlow) {
      // 严格 v6 validator 会拒绝该组合；Runtime 仍用 fallback 保持异常输入可诊断。
      setSize(sizing.value)
      return
    }
    setSize(undefined)
    if (sizing.mode === 'fill' && isMainAxis) {
      node.setFlexGrow(1)
      node.setFlexShrink(1)
      node.setFlexBasis(0)
    }
  }

  private applyEntityStyle(
    entity: ComposeEntity,
    parent: ComposeEntity | undefined,
  ) {
    const yoga = this.yoga!
    const node = this.nodeFor(entity.id)
    this.clearEntityStyle(node)
    this.measuredEntityIds.delete(entity.id)
    const item = getComposeLayoutItem(entity)
    const parentLayout = parent && getComposeLayout(parent)
    // 格中子级的盒**就是**格矩形：轴尺寸模式与 Hug 测量都不参与求解（见 applyGridLayouts）。
    // 这里先把它摆成绝对定位且不装测量回调，避免第一趟白测一次宿主 DOM——结果反正会被覆盖。
    const isGridChild = isComposeGridLayout(parentLayout)
      && getComposeGridItem(entity) !== undefined
    const isFlow = item.positioning === 'flow' && parentLayout !== undefined
    const parentDirection = parentLayout?.flexDirection ?? 'row'
    const rowMainAxis = parentDirection === 'row' || parentDirection === 'row-reverse'

    node.setBoxSizing(yoga.BOX_SIZING_BORDER_BOX)
    node.setPositionType(isFlow && !isGridChild
      ? yoga.POSITION_TYPE_RELATIVE
      : yoga.POSITION_TYPE_ABSOLUTE)
    if (!isFlow && !isGridChild) {
      node.setPosition(yoga.EDGE_LEFT, item.offset.x)
      node.setPosition(yoga.EDGE_TOP, item.offset.y)
    }
    node.setMargin(yoga.EDGE_TOP, item.margin.top)
    node.setMargin(yoga.EDGE_RIGHT, item.margin.right)
    node.setMargin(yoga.EDGE_BOTTOM, item.margin.bottom)
    node.setMargin(yoga.EDGE_LEFT, item.margin.left)
    node.setAlignSelf(align(yoga, item.alignSelf))
    const frame = getComposeFrame(entity)
    if (isGridChild) {
      // 位置与尺寸由 applyGridLayouts 在第一趟求解之后写入：列宽要等容器内容宽可知。
    }
    else if (frame) {
      // Frame.size 是该 Entity 尺寸的唯一事实来源，覆盖 LayoutItem 的任何推导结果。
      node.setWidth(frame.size.width)
      node.setHeight(frame.size.height)
    }
    else {
      this.applyAxis(node, 'width', item.width, rowMainAxis, isFlow)
      this.applyAxis(node, 'height', item.height, !rowMainAxis, isFlow)
    }
    if (isFlow && !isGridChild && item.width.mode === 'fill' && !rowMainAxis) {
      node.setAlignSelf(yoga.ALIGN_STRETCH)
    }
    if (isFlow && !isGridChild && item.height.mode === 'fill' && rowMainAxis) {
      node.setAlignSelf(yoga.ALIGN_STRETCH)
    }
    // 交叉轴 Hug 不再强制 flex-start：Hug 在 Yoga 侧本就是未设置尺寸（auto），保留
    // `alignSelf: auto` 才能按标准 Flexbox 语义继承父级 alignItems。子级要跳出父级拉伸
    // 时显式设置自己的 alignSelf 即可。

    const appearance = resolveComposeAppearance(entity)
    for (const edge of [yoga.EDGE_TOP, yoga.EDGE_RIGHT, yoga.EDGE_BOTTOM, yoga.EDGE_LEFT]) {
      node.setBorder(edge, appearance.borderWidth)
    }
    const layout = getComposeLayout(entity)
    if (isComposeGridLayout(layout)) {
      // 网格容器只写内边距：格子的位置由 applyGridLayouts 直接算成绝对坐标，Yoga 的 flex
      // 属性对它没有意义，而 grid Layout 上根本没有 flexDirection 这些字段。
      node.setPadding(yoga.EDGE_TOP, layout.padding.top)
      node.setPadding(yoga.EDGE_RIGHT, layout.padding.right)
      node.setPadding(yoga.EDGE_BOTTOM, layout.padding.bottom)
      node.setPadding(yoga.EDGE_LEFT, layout.padding.left)
    }
    else if (layout) {
      node.setFlexDirection(direction(yoga, layout.flexDirection))
      node.setFlexWrap(wrap(yoga, layout.flexWrap))
      node.setAlignContent(align(yoga, layout.alignContent))
      node.setJustifyContent(justify(yoga, layout.justifyContent))
      node.setAlignItems(align(yoga, layout.alignItems))
      node.setPadding(yoga.EDGE_TOP, layout.padding.top)
      node.setPadding(yoga.EDGE_RIGHT, layout.padding.right)
      node.setPadding(yoga.EDGE_BOTTOM, layout.padding.bottom)
      node.setPadding(yoga.EDGE_LEFT, layout.padding.left)
      node.setGap(yoga.GUTTER_ROW, layout.rowGap)
      node.setGap(yoga.GUTTER_COLUMN, layout.columnGap)
    }

    const hierarchy = getComposeHierarchy(entity)
    const usesIntrinsicMeasurement = getComposeRenderer(entity)
      && !isGridChild
      && !(layout && hierarchy)
      && (item.width.mode === 'hug' || item.height.mode === 'hug')
    if (usesIntrinsicMeasurement) {
      this.measuredEntityIds.add(entity.id)
      const fallbackWidth = Math.max(0, item.width.value - appearance.borderWidth * 2)
      const fallbackHeight = Math.max(0, item.height.value - appearance.borderWidth * 2)
      const renderer = getComposeRenderer(entity)
      node.setMeasureFunc((width, widthMode, height, heightMode) => {
        const widthConstraint = measureConstraint(yoga, widthMode, width)
        const heightConstraint = measureConstraint(yoga, heightMode, height)
        const cached = this.measurementCache.get(entity.id)
        const measured = cached
          && cached.renderer === renderer
          && sameConstraint(cached.width, widthConstraint)
          && sameConstraint(cached.height, heightConstraint)
          ? cached.result
          : this.measurementPort?.measure({
              entity,
              width: widthConstraint,
              height: heightConstraint,
            })
        if (measured) {
          this.measurementCache.set(entity.id, {
            renderer,
            width: widthConstraint,
            height: heightConstraint,
            result: measured,
          })
        }
        if (!measured) {
          this.measurementDiagnostics.set(entity.id, this.measurementPort?.getDiagnostic?.(entity.id) ?? {
            code: 'measurement.unregistered',
            message: 'Renderer 测量不可用，使用 LayoutItem fallback 尺寸',
          })
        }
        else this.measurementDiagnostics.delete(entity.id)
        return {
          width: item.width.mode === 'hug' ? measured?.width ?? fallbackWidth : fallbackWidth,
          height: item.height.mode === 'hug' ? measured?.height ?? fallbackHeight : fallbackHeight,
        }
      })
    }
    else this.measurementDiagnostics.delete(entity.id)
  }

  private prepareTree(
    entityId: string,
    parent: ComposeEntity | undefined,
    desiredChildren: Map<Node, readonly Node[]>,
  ): Node {
    const entity = this.document.entities[entityId]!
    const node = this.nodeFor(entityId)
    const parentLayout = parent && getComposeLayout(parent)
    const cached = this.styleCache.get(entityId)
    if (!cached || cached.entity !== entity || cached.parentLayout !== parentLayout) {
      this.applyEntityStyle(entity, parent)
      this.styleCache.set(entityId, { entity, parentLayout })
    }
    const hierarchy = getComposeHierarchy(entity)
    const children = (hierarchy?.childIds ?? []).map((childId) =>
      this.prepareTree(childId, entity, desiredChildren))
    desiredChildren.set(node, children)
    return node
  }

  private solve() {
    if (!this.yoga || !this.root || !this.config || this.disposed) return
    // 整趟求解本来就会重解，挂起的那一次合并重解不必再跑。
    this.pendingRecalculation = undefined
    try {
      const yoga = this.yoga
      const extent = this.rootExtent()
      this.root.setWidth(extent.width)
      this.root.setHeight(extent.height)
      this.root.setFlexDirection(yoga.FLEX_DIRECTION_ROW)
      this.gridWrites.clear()
      const desiredChildren = new Map<Node, readonly Node[]>()
      const rootChildren = this.document.rootIds.map((entityId) =>
        this.prepareTree(entityId, undefined, desiredChildren))
      const currentIds = new Set(Object.keys(this.document.entities))
      this.nodes.forEach((node, entityId) => {
        if (!currentIds.has(entityId)) desiredChildren.set(node, [])
      })
      desiredChildren.set(this.root, rootChildren)
      this.syncTree(desiredChildren)
      this.nodes.forEach((node, entityId) => {
        if (currentIds.has(entityId)) return
        node.free()
        this.nodes.delete(entityId)
        this.measuredEntityIds.delete(entityId)
        this.measurementDiagnostics.delete(entityId)
        this.styleCache.delete(entityId)
        this.measurementCache.delete(entityId)
      })
      this.calculateAndPublish()
    }
    catch (cause) {
      this.setState({
        status: 'error',
        document: this.document,
        error: cause instanceof Error ? cause : new Error(String(cause)),
      })
      this.emit()
    }
  }

  /**
   * 求合成 Yoga 根需要的尺寸。
   *
   * @remarks
   * v7 的文档根是一个或多个 Frame，没有全局输出尺寸可用。根 Frame 全部是 Absolute 定位且
   * 尺寸固定，因此合成根只需要覆盖它们的并集包围盒——这个值不影响任何 Frame 自身的求解，
   * 只是给 Yoga 一个确定的可用空间，避免依赖 `undefined` 造成的实现相关行为。
   */
  private rootExtent(): { readonly width: number; readonly height: number } {
    let width = 0
    let height = 0
    this.document.rootIds.forEach((entityId) => {
      const entity = this.document.entities[entityId]
      if (!entity) return
      const frame = getComposeFrame(entity)
      if (!frame) return
      const offset = getComposeLayoutItem(entity).offset
      width = Math.max(width, offset.x + frame.size.width)
      height = Math.max(height, offset.y + frame.size.height)
    })
    return { width, height }
  }

  /**
   * 测量失效是**逐条**到达、**合并**重解。
   *
   * @remarks
   * 失效的来源天生成批：字体加载完成时每一个文字的测量器各自报一次失效，一份真实图纸上
   * 就是一千九百次；页面脚本一次导出变化也会让绑定它的每个 Entity 各报一次。每一次都当场
   * 重解的话，重解次数等于文字数——实测打开一份 5381 实体的 DXF 时，一千九百趟重解连成一个
   * 11 秒的长任务，整页冻住，而场景在 1.4 秒时就已经进了 DOM。
   *
   * 因此这里只做**同步**的记账（作废缓存、标脏节点），重解推迟到微任务里做一次。推迟到
   * 微任务而不是下一帧：同一次事件分发或同一批 Promise 回调里的失效都落在同一个微任务
   * 检查点之前，而微任务仍然赶在这一帧绘制之前，用户看不到中间态。`solve()` 自己会重解，
   * 因此它会作废挂起的那一次。
   */
  private invalidateMeasurements(entityIds?: readonly string[]) {
    if (!this.yoga || this.disposed) return
    const targets = entityIds ?? [...this.measuredEntityIds]
    let dirty = false
    targets.forEach((entityId) => {
      if (!this.measuredEntityIds.has(entityId)) return
      const node = this.nodes.get(entityId)
      if (!node) return
      // port revision 失效表示宿主内容变了，缓存的旧结果必须一并作废。
      this.measurementCache.delete(entityId)
      node.markDirty()
      dirty = true
    })
    if (!dirty || this.pendingRecalculation) return
    const token = {}
    this.pendingRecalculation = token
    queueMicrotask(() => {
      if (this.pendingRecalculation !== token) return
      this.pendingRecalculation = undefined
      this.calculateAndPublish()
    })
  }

  /**
   * 网格预解算：把格坐标解成绝对矩形并写进 Yoga 节点。
   *
   * @remarks
   * **必须排在第一趟 `calculateLayout` 之后**：列宽由容器**内容宽**推出，而那个值要等容器
   * 自己被求解出来才知道。改写之后容器与子级都脏了，因此调用方要再求解一趟。
   *
   * 只有文档里真有网格容器时才发生第二趟——没有网格的文档一分钱都不多付。
   *
   * Yoga 的绝对定位子级以父级的**内边距盒**（border 之内、padding 之外）为原点，与既有
   * Absolute 子级同一套语义，因此这里要自己把 padding 加进落点。
   *
   * @returns 是否改写过任何节点；为 true 时调用方 MUST 重新求解。
   */
  private applyGridLayouts(): boolean {
    const yoga = this.yoga!
    let changed = false
    /** 本趟写入与上一趟不同才算「变了」，循环据此收敛。 */
    const note = (key: string, value: string) => {
      if (this.gridWrites.get(key) === value) return
      this.gridWrites.set(key, value)
      changed = true
    }
    this.nodes.forEach((node, entityId) => {
      const entity = this.document.entities[entityId]
      if (!entity) return
      const layout = getComposeLayout(entity)
      if (!isComposeGridLayout(layout)) return
      const hierarchy = getComposeHierarchy(entity)
      if (!hierarchy) return

      const borderX = node.getComputedBorder(yoga.EDGE_LEFT)
        + node.getComputedBorder(yoga.EDGE_RIGHT)
      const contentWidth = Math.max(
        0,
        node.getComputedWidth() - borderX - layout.padding.left - layout.padding.right,
      )
      const metrics: ComposeGridMetrics = {
        columns: layout.columns,
        rowHeight: layout.rowHeight,
        rowGap: layout.rowGap,
        columnGap: layout.columnGap,
        contentWidth,
      }

      const cells: ComposeGridCell[] = []
      hierarchy.childIds.forEach((childId) => {
        const child = this.document.entities[childId]
        const item = child && getComposeGridItem(child)
        if (!child || !item) return
        cells.push({ id: childId, x: item.x, y: item.y, w: item.w, h: item.h })
      })
      const solved = solveComposeGrid(cells, {
        columns: layout.columns,
        float: layout.float,
      })

      solved.forEach((cell) => {
        const childNode = this.nodes.get(cell.id)
        if (!childNode) return
        const rect = projectComposeGridCell(cell, metrics)
        childNode.setPosition(yoga.EDGE_LEFT, layout.padding.left + rect.x)
        childNode.setPosition(yoga.EDGE_TOP, layout.padding.top + rect.y)
        childNode.setWidth(rect.width)
        childNode.setHeight(rect.height)
        note(cell.id, `${rect.x},${rect.y},${rect.width},${rect.height}`)
      })

      /*
       * 绝对定位的子级不撑父级，因此 Hug 高度必须显式写回——否则一块放满卡片的板子高度是 0。
       * 每趟都无条件重写，不依赖样式增量缓存：缓存跳过的是 applyEntityStyle，不是这里。
       *
       * **它自己也是格中子级时不写**：那一档它的盒**就是**外层给它的格矩形，两边都写会让两个
       * 高度在相邻两趟里互相覆盖，收敛循环因此永远停不下来。
       */
      if (getComposeLayoutItem(entity).height.mode === 'hug' && !getComposeGridItem(entity)) {
        const borderY = node.getComputedBorder(yoga.EDGE_TOP)
          + node.getComputedBorder(yoga.EDGE_BOTTOM)
        const hugHeight = composeGridContentHeight(solved, metrics)
          + layout.padding.top
          + layout.padding.bottom
          + borderY
        node.setHeight(hugHeight)
        note(`${entityId}:hug`, String(hugHeight))
      }
    })
    return changed
  }

  private calculateAndPublish() {
    if (!this.yoga || !this.root || this.disposed) return
    try {
      const extent = this.rootExtent()
      this.root.calculateLayout(extent.width, extent.height, this.yoga.DIRECTION_LTR)
      /*
       * **迭代到稳定，而不是固定跑一趟。**一趟不够的是**嵌套网格**：内层容器的列宽要按它的
       * 内容宽算，而它作为格中子级根本没有轴尺寸——那个宽度要等外层这一趟把格矩形写进去、
       * 再求解一次才存在。只跑一趟时内层读到的宽度是 0，十二列全塌成 0 宽，屏幕上是一排
       * 只剩间距的细条。
       *
       * 收敛靠 `applyGridLayouts` 只在**写入值真的变了**时报 true：第一趟全是新值，第二趟只有
       * 嵌套那一层变，第三趟不再变就停。上界按嵌套层数给，够深的嵌套本来就不是这个产品的形态，
       * 而一个没有上界的循环在数值恰好来回摆动时会挂死整个编辑器。
       */
      for (let pass = 0; pass < MAX_GRID_PASSES; pass += 1) {
        if (!this.applyGridLayouts()) break
        this.root.calculateLayout(extent.width, extent.height, this.yoga.DIRECTION_LTR)
      }
      const previousBoxes = this.state.status === 'ready' ? this.state.snapshot.boxes : undefined
      const boxes: Record<string, ComposeLayoutSnapshot['boxes'][string]> = {}
      this.nodes.forEach((node, entityId) => {
        const item = getComposeLayoutItem(this.document.entities[entityId]!)
        const next = {
          x: node.getComputedLeft(),
          y: node.getComputedTop(),
          width: node.getComputedWidth(),
          height: node.getComputedHeight(),
          positioning: item.positioning,
        }
        // 值未变时复用上一 Snapshot 的冻结对象，让订阅方的相等性检查与 memo 生效。
        const previous = previousBoxes?.[entityId]
        boxes[entityId] = previous
          && previous.x === next.x
          && previous.y === next.y
          && previous.width === next.width
          && previous.height === next.height
          && previous.positioning === next.positioning
          ? previous
          : Object.freeze(next)
      })
      const diagnostics: ComposeLayoutDiagnostic[] = []
      this.measurementDiagnostics.forEach((measurement, entityId) => {
        const entity = this.document.entities[entityId]
        if (!entity) return
        const item = getComposeLayoutItem(entity)
        for (const axis of ['width', 'height'] as const) {
          if (item[axis].mode !== 'hug') continue
          diagnostics.push({
            code: measurement.code,
            entityId,
            axis,
            message: measurement.message,
          })
        }
      })
      // 导线解算排在布局求解之后、发布之前：它既改文档又改导线自己的盒，两者分头产出会让
      // 命中读到的盒与渲染画出的几何差一帧，而这种偏差只在拖动符号的那一瞬出现、极难复现。
      // Runtime 是唯一同时握有文档与快照的地方，因此解算住在这里，三条渲染路径各自零改动。
      // 导线是绝对定位，改它的盒不影响任何其他 Entity 的求解，因此不触发二次求解。
      /*
       * 回到提交态且几何逐项相同时**复用上一份提交态**，不新发一份。
       *
       * `clearPreview()` 要把 Yoga 树从预览布局摆回提交态，因此必须真的重解一遍；但解出来
       * 的结果按定义与上一次提交态求解逐项相同——输入是同一份文档。若照常发布，`revision`
       * 会平白加一，而**那是一次可观察的变化**：手势会话的空间基线正是「document 恒等 +
       * layoutSnapshot.revision 恒等」，于是一次纯粹的预览清理会把正在进行的手势判成失效并
       * 中止它。
       *
       * 症状具体而难查：网格里拖一张卡，求解文档会随目标格在「有兄弟要让位」与「没有」之间
       * 来回，每一次「没有」都是一次 `clearPreview`——拖到某一行时卡片突然弹回原位，此后整
       * 条手势再也不跟手，而用户还没松手。resize 碰不到它，因为那一档的求解文档自始至终非
       * 空，`clearPreview` 只在手势结束时发生。
       *
       * 判据取「同一份输入 + 几何逐项相同」而不是只看输入：预览期间宿主的测量可能失效，那
       * 时重解确实会得到不同的盒，此刻中止手势是对的——冻结的几何真的过期了。
       */
      const committed = this.lastCommittedState
      if (
        !this.previewing
        && committed.status === 'ready'
        && committed.sourceDocument === this.document
        && sameLayoutBoxes(committed.snapshot.boxes, boxes)
        && sameLayoutDiagnostics(committed.snapshot.diagnostics, diagnostics)
      ) {
        this.setState(committed)
        this.emit()
        return
      }
      const wired = resolveComposeWires(this.document, {
        revision: ++this.revision,
        boxes: Object.freeze(boxes),
        diagnostics: Object.freeze(diagnostics),
      })
      /*
       * 填充跟着边界走，与导线并排——两者都是**求解不存储**：边界动了之后重解那段代码因此
       * 根本不存在，移动、方向键、Inspector、撤销、粘贴、导入与外部同步全部自动正确。
       *
       * **预览档跳过**：手势期每帧都会 solve 一次，而求面是两两求交；导线只要查一个端口的
       * 位置，付得起每帧的账，填充付不起。代价写在明处——拖动过程中填充停在原处，松手才跟上。
       */
      const resolved = this.previewing
        ? wired
        : resolveComposeHatches(wired.document, wired.snapshot)
      this.setState({
        status: 'ready',
        document: resolved.document,
        sourceDocument: this.document,
        preview: this.previewing,
        snapshot: Object.freeze(resolved.snapshot),
      })
      this.emit()
    }
    catch (cause) {
      this.setState({
        status: 'error',
        document: this.document,
        error: cause instanceof Error ? cause : new Error(String(cause)),
      })
      this.emit()
    }
  }
}

/** 创建持有 Yoga 树的文档会话级运行时。 @public */
export function createComposeLayoutRuntime(
  options: ComposeLayoutRuntimeOptions,
): ComposeLayoutRuntime {
  return new YogaLayoutRuntime(options)
}

/**
 * 以可控 backend loader 创建 Runtime，仅用于验证加载与释放边界。
 *
 * @remarks
 * 函数不从包入口导出，且 loader 只接受 `unknown`，避免 Yoga 类型进入公共 API。
 * @internal
 */
export function createComposeLayoutRuntimeWithBackendForTesting(
  options: ComposeLayoutRuntimeOptions,
  loadBackend: () => Promise<unknown>,
): ComposeLayoutRuntime {
  return new YogaLayoutRuntime(options, async () => await loadBackend() as Yoga)
}

/** 一次性解析文档布局，并在完成后释放 Yoga 对象。 @public */
export function resolveComposeDocumentLayout(
  document: ComposeDocument,
  measurementPort?: ComposeLayoutMeasurementPort,
): Promise<ComposeLayoutSnapshot> {
  return new Promise((resolve, reject) => {
    const runtime = createComposeLayoutRuntime({ document, measurementPort })
    const consume = () => {
      const state = runtime.getState()
      if (state.status === 'loading') return
      unsubscribe()
      runtime.dispose()
      if (state.status === 'ready') resolve(state.snapshot)
      else reject(state.error)
    }
    const unsubscribe = runtime.subscribe(consume)
    consume()
  })
}
