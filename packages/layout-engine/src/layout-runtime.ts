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
  type ComposeLayoutMeasurementPort,
  type ComposeLayoutSnapshot,
  type ComposeMeasureConstraint,
} from '@compose-ui/core'
import { loadYoga, type Config, type Node, type Yoga } from 'yoga-layout/load'

/** Layout Runtime 当前可观察状态。 @public */
export type ComposeLayoutRuntimeState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly snapshot: ComposeLayoutSnapshot }
  | { readonly status: 'error'; readonly error: Error }

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

function loadYogaSingleton(): Promise<Yoga> {
  yogaModulePromise ??= loadYoga()
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
  private state: ComposeLayoutRuntimeState = { status: 'loading' }
  private readonly listeners = new Set<() => void>()
  private document: ComposeDocument
  private measurementPort: ComposeLayoutMeasurementPort | undefined
  private measurementUnsubscribe: (() => void) | undefined
  private yoga: Yoga | undefined
  private config: Config | undefined
  private root: Node | undefined
  private readonly nodes = new Map<string, Node>()
  private revision = 0
  private disposed = false

  constructor(options: ComposeLayoutRuntimeOptions) {
    this.document = options.document
    this.setMeasurementPort(options.measurementPort)
    void this.initialize()
  }

  // React 的 useSyncExternalStore 会把 getter 作为裸函数调用，因此这里必须保留词法 this。
  readonly getState = () => this.state

  updateDocument(document: ComposeDocument) {
    if (this.disposed) return
    this.document = document
    if (this.yoga) this.solve()
  }

  setMeasurementPort(port: ComposeLayoutMeasurementPort | undefined) {
    if (this.disposed || this.measurementPort === port) return
    this.measurementUnsubscribe?.()
    this.measurementPort = port
    this.measurementUnsubscribe = port?.subscribe(() => {
      if (this.yoga && !this.disposed) this.solve()
    })
    if (this.yoga) this.solve()
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
      const yoga = await loadYogaSingleton()
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
        error: cause instanceof Error ? cause : new Error(String(cause)),
      }
      this.emit()
    }
  }

  private releaseYogaObjects() {
    this.nodes.forEach((node) => node.free())
    this.nodes.clear()
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

  private reconcileNodes() {
    const entityIds = new Set(Object.keys(this.document.entities))
    this.nodes.forEach((node, entityId) => {
      this.detachChildren(node)
      if (!entityIds.has(entityId)) {
        node.free()
        this.nodes.delete(entityId)
      }
    })
    this.detachChildren(this.root!)
    entityIds.forEach((entityId) => this.nodeFor(entityId).reset())
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
    if (sizing.mode === 'fixed' || !isFlow) {
      setSize(sizing.value)
      if (isMainAxis) node.setFlexShrink(0)
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
    diagnostics: ComposeLayoutDiagnostic[],
  ) {
    const yoga = this.yoga!
    const node = this.nodeFor(entity.id)
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

    const appearance = resolveComposeAppearance(entity)
    node.setBorder(yoga.EDGE_ALL, appearance.borderWidth)
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
      node.setMeasureFunc((width, widthMode, height, heightMode) => {
        const measured = this.measurementPort?.measure({
          entity,
          width: measureConstraint(yoga, widthMode, width),
          height: measureConstraint(yoga, heightMode, height),
        })
        if (!measured) {
          diagnostics.push({
            code: 'measurement.fallback',
            entityId: entity.id,
            message: 'Renderer 测量不可用，使用 LayoutItem fallback 尺寸',
          })
        }
        return {
          width: item.width.mode === 'hug' ? measured?.width ?? item.width.value : item.width.value,
          height: item.height.mode === 'hug' ? measured?.height ?? item.height.value : item.height.value,
        }
      })
    }
  }

  private buildTree(entityId: string, parent: ComposeEntity | undefined, diagnostics: ComposeLayoutDiagnostic[]) {
    const entity = this.document.entities[entityId]!
    const node = this.nodeFor(entityId)
    this.applyEntityStyle(entity, parent, diagnostics)
    const hierarchy = getComposeHierarchy(entity)
    hierarchy?.childIds.forEach((childId, index) => {
      const child = this.buildTree(childId, entity, diagnostics)
      node.insertChild(child, index)
    })
    return node
  }

  private solve() {
    if (!this.yoga || !this.root || !this.config || this.disposed) return
    try {
      const yoga = this.yoga
      const diagnostics: ComposeLayoutDiagnostic[] = []
      this.reconcileNodes()
      this.root.reset()
      this.root.setWidth(this.document.output.width)
      this.root.setHeight(this.document.output.height)
      this.root.setFlexDirection(yoga.FLEX_DIRECTION_ROW)
      this.document.rootIds.forEach((entityId, index) => {
        this.root!.insertChild(this.buildTree(entityId, undefined, diagnostics), index)
      })
      this.root.calculateLayout(
        this.document.output.width,
        this.document.output.height,
        yoga.DIRECTION_LTR,
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
      this.state = {
        status: 'ready',
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
