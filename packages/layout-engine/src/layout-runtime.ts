import {
  getComposeHierarchy,
  getComposeLayout,
  getComposeLayoutItem,
  getComposeRenderer,
  resolveComposeAppearance,
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
  type ComposeLayoutSnapshot,
  type ComposeMeasureConstraint,
} from '@compose-ui/core'
import type { Config, Node, Yoga } from 'yoga-layout/load'

/** Layout Runtime 当前可观察状态。 @public */
export type ComposeLayoutRuntimeState =
  | { readonly status: 'loading'; readonly document: ComposeDocument }
  | {
      readonly status: 'ready'
      readonly document: ComposeDocument
      readonly snapshot: ComposeLayoutSnapshot
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
  updateDocument(document: ComposeDocument): void
  setMeasurementPort(port: ComposeLayoutMeasurementPort | undefined): void
  subscribe(listener: () => void): () => void
  dispose(): void
}

let yogaModulePromise: Promise<Yoga> | undefined

type ComposeYogaLoader = () => Promise<Yoga>

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
  private state: ComposeLayoutRuntimeState
  private readonly listeners = new Set<() => void>()
  private document: ComposeDocument
  private measurementPort: ComposeLayoutMeasurementPort | undefined
  private measurementUnsubscribe: (() => void) | undefined
  private yoga: Yoga | undefined
  private config: Config | undefined
  private root: Node | undefined
  private readonly nodes = new Map<string, Node>()
  private readonly measuredEntityIds = new Set<string>()
  private readonly measurementDiagnostics = new Map<
    string,
    ComposeLayoutMeasurementDiagnostic
  >()
  private revision = 0
  private disposed = false

  constructor(
    options: ComposeLayoutRuntimeOptions,
    private readonly loadYoga: ComposeYogaLoader = loadYogaSingleton,
  ) {
    this.document = options.document
    this.state = { status: 'loading', document: options.document }
    this.setMeasurementPort(options.measurementPort)
    void this.initialize()
  }

  // React 的 useSyncExternalStore 会把 getter 作为裸函数调用，因此这里必须保留词法 this。
  readonly getState = () => this.state

  updateDocument(document: ComposeDocument) {
    if (this.disposed || this.document === document) return
    this.document = document
    if (this.yoga) this.solve()
    else this.state = { status: 'loading', document }
  }

  setMeasurementPort(port: ComposeLayoutMeasurementPort | undefined) {
    if (this.disposed || this.measurementPort === port) return
    this.measurementUnsubscribe?.()
    this.measurementPort = port
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
      this.state = {
        status: 'error',
        document: this.document,
        error: cause instanceof Error ? cause : new Error(String(cause)),
      }
      this.emit()
    }
  }

  private releaseYogaObjects() {
    this.nodes.forEach((node) => node.free())
    this.nodes.clear()
    this.measuredEntityIds.clear()
    this.measurementDiagnostics.clear()
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
    const isFlow = item.positioning === 'flow' && parentLayout !== undefined
    const parentDirection = parentLayout?.flexDirection ?? 'row'
    const rowMainAxis = parentDirection === 'row' || parentDirection === 'row-reverse'

    node.setBoxSizing(yoga.BOX_SIZING_BORDER_BOX)
    node.setPositionType(isFlow ? yoga.POSITION_TYPE_RELATIVE : yoga.POSITION_TYPE_ABSOLUTE)
    if (!isFlow) {
      node.setPosition(yoga.EDGE_LEFT, item.offset.x)
      node.setPosition(yoga.EDGE_TOP, item.offset.y)
    }
    node.setMargin(yoga.EDGE_TOP, item.margin.top)
    node.setMargin(yoga.EDGE_RIGHT, item.margin.right)
    node.setMargin(yoga.EDGE_BOTTOM, item.margin.bottom)
    node.setMargin(yoga.EDGE_LEFT, item.margin.left)
    node.setAlignSelf(align(yoga, item.alignSelf))
    this.applyAxis(node, 'width', item.width, rowMainAxis, isFlow)
    this.applyAxis(node, 'height', item.height, !rowMainAxis, isFlow)
    if (isFlow && item.width.mode === 'fill' && !rowMainAxis) {
      node.setAlignSelf(yoga.ALIGN_STRETCH)
    }
    if (isFlow && item.height.mode === 'fill' && rowMainAxis) {
      node.setAlignSelf(yoga.ALIGN_STRETCH)
    }
    if (
      isFlow
      && item.alignSelf === 'auto'
      && ((rowMainAxis && item.height.mode === 'hug')
        || (!rowMainAxis && item.width.mode === 'hug'))
    ) {
      node.setAlignSelf(yoga.ALIGN_FLEX_START)
    }

    const appearance = resolveComposeAppearance(entity)
    for (const edge of [yoga.EDGE_TOP, yoga.EDGE_RIGHT, yoga.EDGE_BOTTOM, yoga.EDGE_LEFT]) {
      node.setBorder(edge, appearance.borderWidth)
    }
    const layout = getComposeLayout(entity)
    if (layout) {
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
      && !(layout && hierarchy)
      && (item.width.mode === 'hug' || item.height.mode === 'hug')
    if (usesIntrinsicMeasurement) {
      this.measuredEntityIds.add(entity.id)
      const fallbackWidth = Math.max(0, item.width.value - appearance.borderWidth * 2)
      const fallbackHeight = Math.max(0, item.height.value - appearance.borderWidth * 2)
      node.setMeasureFunc((width, widthMode, height, heightMode) => {
        const measured = this.measurementPort?.measure({
          entity,
          width: measureConstraint(yoga, widthMode, width),
          height: measureConstraint(yoga, heightMode, height),
        })
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
    this.applyEntityStyle(entity, parent)
    const hierarchy = getComposeHierarchy(entity)
    const children = (hierarchy?.childIds ?? []).map((childId) =>
      this.prepareTree(childId, entity, desiredChildren))
    desiredChildren.set(node, children)
    return node
  }

  private solve() {
    if (!this.yoga || !this.root || !this.config || this.disposed) return
    try {
      const yoga = this.yoga
      this.root.setWidth(this.document.output.width)
      this.root.setHeight(this.document.output.height)
      this.root.setFlexDirection(yoga.FLEX_DIRECTION_ROW)
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
      })
      this.calculateAndPublish()
    }
    catch (cause) {
      this.state = {
        status: 'error',
        document: this.document,
        error: cause instanceof Error ? cause : new Error(String(cause)),
      }
      this.emit()
    }
  }

  private invalidateMeasurements(entityIds?: readonly string[]) {
    if (!this.yoga || this.disposed) return
    const targets = entityIds ?? [...this.measuredEntityIds]
    let dirty = false
    targets.forEach((entityId) => {
      if (!this.measuredEntityIds.has(entityId)) return
      const node = this.nodes.get(entityId)
      if (!node) return
      node.markDirty()
      dirty = true
    })
    if (dirty) this.calculateAndPublish()
  }

  private calculateAndPublish() {
    if (!this.yoga || !this.root || this.disposed) return
    try {
      this.root.calculateLayout(
        this.document.output.width,
        this.document.output.height,
        this.yoga.DIRECTION_LTR,
      )
      const boxes: Record<string, ComposeLayoutSnapshot['boxes'][string]> = {}
      this.nodes.forEach((node, entityId) => {
        const item = getComposeLayoutItem(this.document.entities[entityId]!)
        boxes[entityId] = Object.freeze({
          x: node.getComputedLeft(),
          y: node.getComputedTop(),
          width: node.getComputedWidth(),
          height: node.getComputedHeight(),
          positioning: item.positioning,
        })
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
      this.state = {
        status: 'ready',
        document: this.document,
        snapshot: Object.freeze({
          revision: ++this.revision,
          boxes: Object.freeze(boxes),
          diagnostics: Object.freeze(diagnostics),
        }),
      }
      this.emit()
    }
    catch (cause) {
      this.state = {
        status: 'error',
        document: this.document,
        error: cause instanceof Error ? cause : new Error(String(cause)),
      }
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
