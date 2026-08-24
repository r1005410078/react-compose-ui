import {
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  createDefaultCanvasSettings,
  createComposeFrame,
  normalizeComposeCurveGeometry,
  roundComposeGeometry,
  type ComposeCurve,
  type ComposeDocument,
  type ComposeEntity,
  type ComposePosition,
  type ComposeSize,
  type JsonObject,
} from '@compose-ui/core'
import {
  createDxfDiagnosticCollector,
  type DxfDiagnostic,
} from '../parser/dxf-diagnostics'
import {
  allValues,
  firstValue,
  groupDxfRecords,
  numberValue,
  tokenizeDxf,
  type DxfRecord,
} from '../parser/dxf-parser'
import type {
  DxfComponentPlan,
  DxfCreateSeed,
  DxfImportPlan,
  DxfInstancePlan,
} from './dxf-types'

/**
 * 由字号估算基线到盒顶的距离。
 *
 * @remarks
 * DXF 的 TEXT 锚在**基线**上，页面 Text 锚在盒左上角。导入器无 DOM，量不到真实字体度量，
 * 因此这里给一个比例。它只是**导入那一刻的落点初值**，不是任何契约——盒本身走 Hug，由布局
 * 求解量真实文字。与 CAD 侧「字体栈与比例是一对不变量」不同：那条的理由是命中框必须与字形
 * 对齐，而这里估算只影响初始位置。
 *
 * @public
 */
export const DXF_TEXT_ASCENT_RATIO = 0.8

/** 由字号估算单字符宽度；只用来把非左对齐的锚点换算成盒左上角。 @public */
export const DXF_TEXT_ADVANCE_RATIO = 0.6

/** ACI 的前九个标准色；落不到表里的用图层默认色。 */
const ACI_COLORS: Record<number, string> = {
  1: '#ff0000',
  2: '#ffff00',
  3: '#00ff00',
  4: '#00ffff',
  5: '#0000ff',
  6: '#ff00ff',
  7: '#d8e2f1',
  8: '#808080',
  9: '#c0c0c0',
}

const DEFAULT_LAYER_COLOR = '#d8e2f1'
const DEFAULT_LAYER_ID = '0'

/** 能映射成 Entity 的实体类型。 */
const SUPPORTED = new Set(['LINE', 'CIRCLE', 'ARC', 'LWPOLYLINE', 'TEXT', 'INSERT'])

/**
 * DXF 的文字水平对齐（组码 72）。
 *
 * @remarks
 * 只映射前三种。3（Aligned）、4（Middle）、5（Fit）会改变字高或字宽以适配两个对齐点，页面
 * 的文字没有这个概念，按左对齐处理。
 */
const TEXT_ALIGNS: Record<number, 'left' | 'center' | 'right'> = {
  0: 'left',
  1: 'center',
  2: 'right',
}

/**
 * DXF 的 Y 轴朝上，屏幕的 Y 轴朝下。
 *
 * @remarks
 * 翻转矩阵 `F = diag(1, -1)` 满足 `F² = I`，因此块实例的世界变换 `p = I + R(θ)·S·b` 在翻转
 * 之后是 `F p = F I + R(−θ)·S·(F b)`——位置翻转、**旋转取反**、**比例不变**，三条是同一个
 * 恒等式的三个推论。三者要么一起对、要么一起错，而错了的症状是「图看起来像镜像的」，很容易
 * 被误当成源文件本身的问题。
 *
 * `+ 0` 掉 `-0`：`-0` 在 JSON 里写成 `0`，是只在 `Object.is` 与断言里现形的幽灵差异。
 */
function flipPoint(x: number, y: number): ComposePosition {
  return { x: x + 0, y: -y + 0 }
}

/** DXF 的角是 Y 朝上的逆时针，本仓的角是屏幕顺时针；翻转把两者共轭，取反即可。 */
function flipAngle(degrees: number) {
  return -degrees + 0
}

interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

interface DxfLayer {
  readonly color: string
  readonly visible: boolean
  readonly locked: boolean
}

/** 中间表示：已翻转到屏幕坐标，尚未归一化，也还不知道自己落在哪块盒里。 */
type PlanItem =
  | { readonly kind: 'curve'; readonly curve: ComposeCurve; readonly layer: string }
  | {
    readonly kind: 'text'
    readonly anchor: ComposePosition
    readonly content: string
    readonly fontSize: number
    readonly align: 'left' | 'center' | 'right'
    readonly rotation: number
    readonly layer: string
  }
  | {
    readonly kind: 'insert'
    readonly blockName: string
    readonly anchor: ComposePosition
    readonly rotation: number
    readonly layer: string
  }

interface BlockGeometry {
  /** 块内几何的紧包围盒，块局部（未平移）坐标。 */
  readonly bounds: Rect
  /** 块基点，块局部坐标。 */
  readonly base: ComposePosition
  readonly items: readonly PlanItem[]
}

function readLayers(records: readonly DxfRecord[]): Map<string, DxfLayer> {
  const layers = new Map<string, DxfLayer>()
  for (const record of records) {
    if (record.type !== 'LAYER') continue
    const name = firstValue(record, 2)?.trim()
    if (!name || layers.has(name)) continue
    // 负的颜色号表示图层关闭；`70` 的第 1 位是冻结、第 3 位（值 4）是锁定。
    const color = numberValue(record, 62, 7)
    const flags = numberValue(record, 70, 0)
    layers.set(name, {
      color: ACI_COLORS[Math.abs(color)] ?? DEFAULT_LAYER_COLOR,
      visible: color >= 0 && (flags & 1) === 0,
      locked: (flags & 4) !== 0,
    })
  }
  // 图层 `0` 在 DXF 里永远存在；文件没给也补一个，否则落回它的实体读不到外观。
  if (!layers.has(DEFAULT_LAYER_ID)) {
    layers.set(DEFAULT_LAYER_ID, {
      color: DEFAULT_LAYER_COLOR,
      visible: true,
      locked: false,
    })
  }
  return layers
}

/** 读顶点序列：`10`/`20` 成对且**重复出现**，因此按出现顺序配对。 */
function readVertices(record: DxfRecord) {
  const xs = allValues(record, 10).map((value) => Number(value.trim()))
  const ys = allValues(record, 20).map((value) => Number(value.trim()))
  const count = Math.min(xs.length, ys.length)
  const vertices: ComposePosition[] = []
  for (let i = 0; i < count; i += 1) {
    if (!Number.isFinite(xs[i]!) || !Number.isFinite(ys[i]!)) return null
    vertices.push(flipPoint(xs[i]!, ys[i]!))
  }
  return vertices
}

interface MapContext {
  readonly layers: ReadonlyMap<string, DxfLayer>
  readonly diagnostics: ReturnType<typeof createDxfDiagnosticCollector>
}

function resolveLayer(record: DxfRecord, context: MapContext) {
  const name = firstValue(record, 8)?.trim() ?? DEFAULT_LAYER_ID
  if (context.layers.has(name)) return name
  // 一个拼错的图层名不该让整张图导不进来。
  context.diagnostics.add('dxf.unknown-layer', name)
  return DEFAULT_LAYER_ID
}

/**
 * 把一条实体记录映射成中间表示。
 *
 * @param blocks - 已知的块名集合；`null` 表示当前正在块定义**内部**，此时 `INSERT` 不允许。
 */
function mapRecord(
  record: DxfRecord,
  context: MapContext,
  blocks: ReadonlySet<string> | null,
): PlanItem | null {
  if (!SUPPORTED.has(record.type)) {
    context.diagnostics.add('dxf.unsupported-entity', record.type)
    return null
  }
  const layer = resolveLayer(record, context)

  if (record.type === 'LINE') {
    const start = flipPoint(numberValue(record, 10, NaN), numberValue(record, 20, NaN))
    const end = flipPoint(numberValue(record, 11, NaN), numberValue(record, 21, NaN))
    if (!Number.isFinite(start.x + start.y + end.x + end.y)) {
      context.diagnostics.add('dxf.invalid-entity', record.type)
      return null
    }
    return { kind: 'curve', curve: { kind: 'line', start, end }, layer }
  }

  if (record.type === 'CIRCLE' || record.type === 'ARC') {
    const center = flipPoint(numberValue(record, 10, NaN), numberValue(record, 20, NaN))
    const radius = numberValue(record, 40, NaN)
    if (!Number.isFinite(center.x + center.y) || !(radius > 0)) {
      context.diagnostics.add('dxf.invalid-entity', record.type)
      return null
    }
    if (record.type === 'CIRCLE') {
      // 整圆是扫掠 360 的弧，不另立类型——与 `ComposeCurve` 的三元联合一字不差。
      return {
        kind: 'curve',
        curve: { kind: 'arc', center, radius, startAngle: 0, sweep: 360 },
        layer,
      }
    }
    const startAngle = numberValue(record, 50, 0)
    const endAngle = numberValue(record, 51, 0)
    // DXF 的弧从起角**逆时针**走到终角，因此扫掠先在 DXF 的方向上归一化到 [0,360)，再整体取反。
    const dxfSweep = ((endAngle - startAngle) % 360 + 360) % 360
    return {
      kind: 'curve',
      curve: {
        kind: 'arc',
        center,
        radius,
        startAngle: flipAngle(startAngle),
        // 起终角相同在 DXF 里表示整圆而不是零长弧。
        sweep: flipAngle(dxfSweep === 0 ? 360 : dxfSweep),
      },
      layer,
    }
  }

  if (record.type === 'LWPOLYLINE') {
    const vertices = readVertices(record)
    if (!vertices || vertices.length < 2) {
      context.diagnostics.add('dxf.invalid-entity', record.type)
      return null
    }
    // bulge 非零的段是圆弧。`ComposePolylineCurve` 没有这个字段，而把一条带弧的折线拆成
    // 「多段线 + 若干独立圆弧」会让它不再是一个对象——那正是多段线存在的意义。因此按弦导入
    // 并报告。
    if (allValues(record, 42).some((value) => Number(value.trim()) !== 0)) {
      context.diagnostics.add('dxf.polyline-bulge', record.type)
    }
    return {
      kind: 'curve',
      curve: {
        kind: 'polyline',
        vertices,
        closed: (numberValue(record, 70, 0) & 1) !== 0,
      },
      layer,
    }
  }

  if (record.type === 'TEXT') {
    const anchor = flipPoint(numberValue(record, 10, NaN), numberValue(record, 20, NaN))
    const fontSize = numberValue(record, 40, NaN)
    const content = firstValue(record, 1) ?? ''
    if (!Number.isFinite(anchor.x + anchor.y) || !(fontSize > 0) || content.length === 0) {
      context.diagnostics.add('dxf.invalid-entity', record.type)
      return null
    }
    return {
      kind: 'text',
      anchor,
      content,
      fontSize,
      align: TEXT_ALIGNS[numberValue(record, 72, 0)] ?? 'left',
      rotation: flipAngle(numberValue(record, 50, 0)),
      layer,
    }
  }

  // INSERT
  const blockName = firstValue(record, 2)?.trim() ?? ''
  if (blocks === null) {
    // 组件实例套实例在页面世界是可表达的，但它引出「实例内部再下钻」的一整套问题，不该由
    // 一个导入器顺手决定。
    context.diagnostics.add('dxf.nested-block', blockName)
    return null
  }
  if (!blocks.has(blockName)) {
    context.diagnostics.add('dxf.unknown-block', blockName)
    return null
  }
  const anchor = flipPoint(numberValue(record, 10, NaN), numberValue(record, 20, NaN))
  if (!Number.isFinite(anchor.x + anchor.y)) {
    context.diagnostics.add('dxf.invalid-entity', record.type)
    return null
  }
  // 实例尺寸的唯一事实来源是组件根，`Transform` 里也没有 scale——缩放在页面世界无处可放。
  // 静默按 1 导入会让用户拿结果与原图一对时认为工具不可靠，整份拒绝更过分，因此报告。
  if (numberValue(record, 41, 1) !== 1 || numberValue(record, 42, 1) !== 1) {
    context.diagnostics.add('dxf.instance-scale', blockName)
  }
  return {
    kind: 'insert',
    blockName,
    anchor,
    // 旋转取反、比例不变——同一个恒等式的两条推论。
    rotation: flipAngle(numberValue(record, 50, 0)),
    layer,
  }
}

function textFontMetrics(item: Extract<PlanItem, { kind: 'text' }>) {
  const width = Math.max(1, item.content.length * item.fontSize * DXF_TEXT_ADVANCE_RATIO)
  // 与物料的默认行高同一条公式；导入器不依赖 `materials`，因此这里自带一份。
  const height = Math.round(item.fontSize * 120) / 100
  const shift = item.align === 'center' ? width / 2 : item.align === 'right' ? width : 0
  return {
    width,
    height,
    x: item.anchor.x - shift,
    y: item.anchor.y - item.fontSize * DXF_TEXT_ASCENT_RATIO,
  }
}

/** 块局部的插入几何：盒左上角、尺寸与归一化基点。 */
function insertGeometry(block: BlockGeometry, anchor: ComposePosition) {
  const size = {
    width: Math.max(block.bounds.width, 1),
    height: Math.max(block.bounds.height, 1),
  }
  return {
    // 把盒的左上角摆到该在的地方，转轴自然落回插入点。
    offset: {
      x: anchor.x + (block.bounds.x - block.base.x),
      y: anchor.y + (block.bounds.y - block.base.y),
    },
    size,
    pivot: {
      x: (block.base.x - block.bounds.x) / size.width,
      y: (block.base.y - block.bounds.y) / size.height,
    },
  }
}

/** 绕基点旋转之后的轴对齐包围盒。 */
function rotatedBounds(
  box: Rect,
  pivot: ComposePosition,
  degrees: number,
): Rect {
  const origin = {
    x: box.x + pivot.x * box.width,
    y: box.y + pivot.y * box.height,
  }
  const radians = degrees * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ].map(({ x, y }) => {
    const dx = x - origin.x
    const dy = y - origin.y
    return { x: origin.x + dx * cos - dy * sin, y: origin.y + dx * sin + dy * cos }
  })
  const xs = corners.map((corner) => corner.x)
  const ys = corners.map((corner) => corner.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY }
}

function itemBounds(
  item: PlanItem,
  blocks: ReadonlyMap<string, BlockGeometry>,
): Rect | null {
  if (item.kind === 'curve') {
    const { offset, size } = normalizeComposeCurveGeometry(item.curve)
    return { x: offset.x, y: offset.y, width: size.width, height: size.height }
  }
  if (item.kind === 'text') {
    const metrics = textFontMetrics(item)
    const box = { x: metrics.x, y: metrics.y, width: metrics.width, height: metrics.height }
    if (item.rotation === 0) return box
    // 文字绕自己的对齐点转，与 INSERT 绕块基点是同一件事。
    const pivot = {
      x: (item.anchor.x - metrics.x) / metrics.width,
      y: (item.anchor.y - metrics.y) / metrics.height,
    }
    return rotatedBounds(box, pivot, item.rotation)
  }
  const block = blocks.get(item.blockName)
  if (!block) return null
  const { offset, size, pivot } = insertGeometry(block, item.anchor)
  const box = { x: offset.x, y: offset.y, width: size.width, height: size.height }
  return item.rotation === 0 ? box : rotatedBounds(box, pivot, item.rotation)
}

function unionBounds(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const rect of rects) {
    minX = Math.min(minX, rect.x)
    minY = Math.min(minY, rect.y)
    maxX = Math.max(maxX, rect.x + rect.width)
    maxY = Math.max(maxY, rect.y + rect.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function sizeOf(bounds: Rect | null): ComposeSize {
  return {
    width: roundComposeGeometry(Math.max(bounds?.width ?? 1, 1)),
    height: roundComposeGeometry(Math.max(bounds?.height ?? 1, 1)),
  }
}

const KEYS = COMPOSE_BUILTIN_COMPONENT_KEYS

function withLayerFlags(
  components: Record<string, JsonObject>,
  layer: DxfLayer | undefined,
) {
  // 图层的显隐与锁定各自求值到 Entity 上：页面世界的粒度更细，图层这个容器没有对应物。
  if (layer && !layer.visible) components[KEYS.visibility] = { visible: false }
  if (layer?.locked) components[KEYS.lock] = { locked: true }
  return components
}

function fixedAxis(axis: JsonObject, value: number): JsonObject {
  return { ...axis, mode: 'fixed', value: roundComposeGeometry(value) }
}

function hugAxis(axis: JsonObject, value: number): JsonObject {
  return { ...axis, mode: 'hug', value: roundComposeGeometry(value) }
}

interface BuildContext {
  readonly createSeed: DxfCreateSeed
  readonly nextId: () => string
  readonly layers: ReadonlyMap<string, DxfLayer>
  readonly diagnostics: ReturnType<typeof createDxfDiagnosticCollector>
}

function buildCurveEntity(
  item: Extract<PlanItem, { kind: 'curve' }>,
  translate: ComposePosition,
  context: BuildContext,
): ComposeEntity | null {
  const seed = context.createSeed('curve')
  if (!seed) return null
  const layer = context.layers.get(item.layer)
  const normalized = normalizeComposeCurveGeometry(item.curve)
  const layoutItem = seed.components[KEYS.layoutItem] as JsonObject
  const renderer = seed.components[KEYS.renderer] as JsonObject
  const props = (renderer.props ?? {}) as JsonObject
  return {
    id: context.nextId(),
    // 图层名落成 Entity 名：场景树可读、可搜，而且不需要新造任何机制。
    name: item.layer === DEFAULT_LAYER_ID ? seed.name : item.layer,
    components: withLayerFlags({
      ...seed.components,
      [KEYS.curve]: normalized.curve,
      [KEYS.renderer]: {
        ...renderer,
        props: { ...props, stroke: layer?.color ?? DEFAULT_LAYER_COLOR },
      },
      [KEYS.layoutItem]: {
        ...layoutItem,
        offset: {
          x: roundComposeGeometry(normalized.offset.x - translate.x),
          y: roundComposeGeometry(normalized.offset.y - translate.y),
        },
        width: fixedAxis(layoutItem.width as JsonObject, normalized.size.width),
        height: fixedAxis(layoutItem.height as JsonObject, normalized.size.height),
      },
    }, layer),
  }
}

function buildTextEntity(
  item: Extract<PlanItem, { kind: 'text' }>,
  translate: ComposePosition,
  context: BuildContext,
): ComposeEntity | null {
  const seed = context.createSeed('text')
  if (!seed) return null
  const layer = context.layers.get(item.layer)
  const metrics = textFontMetrics(item)
  const layoutItem = seed.components[KEYS.layoutItem] as JsonObject
  const renderer = seed.components[KEYS.renderer] as JsonObject
  const props = (renderer.props ?? {}) as JsonObject
  const transform = seed.components[KEYS.transform] as JsonObject
  return {
    id: context.nextId(),
    name: item.content,
    components: withLayerFlags({
      ...seed.components,
      [KEYS.transform]: {
        ...transform,
        rotation: roundComposeGeometry(item.rotation),
        // 文字绕自己的对齐点转，与 INSERT 绕块基点是同一件事。
        ...(item.rotation === 0
          ? {}
          : {
            pivot: {
              x: roundComposeGeometry((item.anchor.x - metrics.x) / metrics.width),
              y: roundComposeGeometry((item.anchor.y - metrics.y) / metrics.height),
            },
          }),
      },
      [KEYS.renderer]: {
        ...renderer,
        props: {
          ...props,
          text: item.content,
          fontSize: roundComposeGeometry(item.fontSize),
          textAlign: item.align,
          color: layer?.color ?? DEFAULT_LAYER_COLOR,
        },
      },
      [KEYS.layoutItem]: {
        ...layoutItem,
        offset: {
          x: roundComposeGeometry(metrics.x - translate.x),
          y: roundComposeGeometry(metrics.y - translate.y),
        },
        // 盒走 Hug：盒是会被看见的东西，不该停在估算值上。这里的固定值只是测量缺席时的兜底。
        width: hugAxis(layoutItem.width as JsonObject, metrics.width),
        height: hugAxis(layoutItem.height as JsonObject, metrics.height),
      },
    }, layer),
  }
}

function buildFrameEntity(
  id: string,
  name: string,
  size: ComposeSize,
  childIds: readonly string[],
  context: BuildContext,
): ComposeEntity | null {
  const seed = context.createSeed('frame')
  if (!seed) return null
  const layoutItem = seed.components[KEYS.layoutItem] as JsonObject
  const hierarchy = seed.components[KEYS.hierarchy] as JsonObject
  return {
    id,
    name,
    components: {
      ...seed.components,
      // 尺寸的事实来源是 `Frame.size`；`LayoutItem` 的固定尺寸只是求解回退，两者必须一致。
      [KEYS.frame]: { ...createComposeFrame(size), ...(seed.components[KEYS.frame] ?? {}), size },
      [KEYS.hierarchy]: { ...hierarchy, childIds: [...childIds] },
      [KEYS.layoutItem]: {
        ...layoutItem,
        offset: { x: 0, y: 0 },
        width: fixedAxis(layoutItem.width as JsonObject, size.width),
        height: fixedAxis(layoutItem.height as JsonObject, size.height),
      },
    },
  }
}

/** 把一组中间表示落成 Entity，并按平移量归一化到目标原点。 */
function buildItems(
  items: readonly PlanItem[],
  translate: ComposePosition,
  blocks: ReadonlyMap<string, BlockGeometry>,
  context: BuildContext,
) {
  const entities: Record<string, ComposeEntity> = {}
  const childIds: string[] = []
  const instances: DxfInstancePlan[] = []
  for (const item of items) {
    if (item.kind === 'insert') {
      const block = blocks.get(item.blockName)
      if (!block) continue
      const { offset, pivot } = insertGeometry(block, item.anchor)
      const id = context.nextId()
      instances.push({
        id,
        blockName: item.blockName,
        offset: {
          x: roundComposeGeometry(offset.x - translate.x),
          y: roundComposeGeometry(offset.y - translate.y),
        },
        rotation: roundComposeGeometry(item.rotation),
        pivot: {
          x: roundComposeGeometry(pivot.x),
          y: roundComposeGeometry(pivot.y),
        },
      })
      childIds.push(id)
      continue
    }
    const entity = item.kind === 'curve'
      ? buildCurveEntity(item, translate, context)
      : buildTextEntity(item, translate, context)
    if (!entity) {
      context.diagnostics.add('dxf.missing-preset', item.kind)
      continue
    }
    entities[entity.id] = entity
    childIds.push(entity.id)
  }
  return { entities, childIds, instances }
}

function emptyDocument(entities: Record<string, ComposeEntity>, rootId: string): ComposeDocument {
  return {
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
    rootIds: [rootId],
    entities,
  }
}

/** {@link planDxfImport} 的可选参数。 @public */
export interface PlanDxfImportOptions {
  /**
   * 按 Preset id 取 seed。
   *
   * @remarks
   * 页面 Entity 需要 Preset 与 Renderer，而那些住在物料与 Registry 里——一个无 React 的格式
   * 包不该认识它们。
   */
  readonly createSeed: DxfCreateSeed
  /** 生成 Entity ID；默认递增，便于测试断言。 */
  readonly idFactory?: () => string
  /** 场景名称。 @defaultValue `'场景'` */
  readonly sceneName?: string
}

/**
 * 把一份 ASCII DXF 规划成页面导入计划。
 *
 * @remarks
 * 纯函数：喂字符串、断言结果，不碰资源系统也不碰 Registry。
 *
 * **导入能导的，报告导不了的**。整份拒绝不合理——一个 `DIMENSION` 不该让 95% 可用的图导不
 * 进来；静默丢弃同样不行——用户拿结果与原图一对，发现少了东西却没有解释，只会认为工具不
 * 可靠。
 *
 * 产出的是**计划**而不是文档：一次导入要落两类资源（一份页面文件与若干组件文件），它们分属
 * 不同的 Store，而组件实例需要资源引用与 revision——那些要等组件文件写完才存在。宿主写完
 * 文件、建好实例 Entity 之后交给 {@link assembleDxfDocument}。
 *
 * @public
 */
export function planDxfImport(text: string, options: PlanDxfImportOptions): DxfImportPlan {
  const records = groupDxfRecords(tokenizeDxf(text))
  const diagnostics = createDxfDiagnosticCollector()
  let counter = 0
  const nextId = options.idFactory ?? (() => `dxf-${(counter += 1)}`)
  const layers = readLayers(records)
  const mapContext: MapContext = { layers, diagnostics }

  // 先扫一遍块名：`INSERT` 可能出现在块定义之前，两趟比要求文件有序可靠。
  const blockNames = new Set<string>()
  for (const record of records) {
    if (record.type !== 'BLOCK') continue
    const name = firstValue(record, 2)?.trim()
    if (name && !name.startsWith('*')) blockNames.add(name)
  }

  const blocks = new Map<string, BlockGeometry>()
  const sceneItems: PlanItem[] = []

  /**
   * 当前块定义的名字；`null` 表示这个块不保留（布局块）。
   *
   * @remarks
   * 与 `insideBlock` 是两件事：布局块的内容既不进块表，也**不能**掉到顶层——它属于那个块。
   * 用一个变量兼职会让 `*Model_Space` 里的几何全部漏到图纸上。
   */
  let currentBlock: string | null = null
  let insideBlock = false
  let blockBase: ComposePosition = { x: 0, y: 0 }
  let blockItems: PlanItem[] = []
  let section: string | null = null

  for (const record of records) {
    if (record.type === 'SECTION') {
      section = firstValue(record, 2)?.trim() ?? null
      continue
    }
    if (record.type === 'ENDSEC') {
      section = null
      continue
    }

    if (record.type === 'BLOCK') {
      const name = firstValue(record, 2)?.trim() ?? ''
      // `*Model_Space` 这类布局块不是符号。
      insideBlock = true
      currentBlock = name.startsWith('*') || name.length === 0 ? null : name
      blockBase = flipPoint(numberValue(record, 10, 0), numberValue(record, 20, 0))
      blockItems = []
      continue
    }
    if (record.type === 'ENDBLK') {
      const bounds = currentBlock === null
        ? null
        : unionBounds(blockItems.map((item) => itemBounds(item, blocks)).filter(
          (rect): rect is Rect => rect !== null,
        ))
      if (currentBlock !== null && bounds) {
        blocks.set(currentBlock, { bounds, base: blockBase, items: blockItems })
      }
      currentBlock = null
      insideBlock = false
      continue
    }

    // 表段里除了 LAYER 没有别的可读，实体段与块段之外的记录一律不当实体处理。
    if (record.type === 'LAYER' || record.type === 'TABLE' || record.type === 'ENDTAB') continue
    if (section !== 'ENTITIES' && section !== 'BLOCKS') continue

    const item = mapRecord(record, mapContext, insideBlock ? null : blockNames)
    if (!item) continue
    // 布局块的内容被读了出来但不属于任何地方，直接丢掉。
    if (insideBlock && currentBlock === null) continue
    if (insideBlock) blockItems.push(item)
    else sceneItems.push(item)
  }

  const context: BuildContext = {
    createSeed: options.createSeed,
    nextId,
    layers,
    diagnostics,
  }

  const components: DxfComponentPlan[] = []
  for (const [blockName, block] of blocks) {
    const size = sizeOf(block.bounds)
    const built = buildItems(block.items, { x: block.bounds.x, y: block.bounds.y }, blocks, context)
    const frameId = nextId()
    // 组件根必须是 Frame（Component Asset v2 的既有不变量）。
    const frame = buildFrameEntity(frameId, blockName, size, built.childIds, context)
    if (!frame) continue
    components.push({
      blockName,
      document: emptyDocument({ ...built.entities, [frameId]: frame }, frameId),
    })
  }

  const sceneBounds = unionBounds(
    sceneItems.map((item) => itemBounds(item, blocks)).filter(
      (rect): rect is Rect => rect !== null,
    ),
  )
  // DXF 的坐标动辄几千几十万，而场景是绝对坐标的原点；不归一化的导入结果会整体落在场景之外。
  const translate = { x: sceneBounds?.x ?? 0, y: sceneBounds?.y ?? 0 }
  const built = buildItems(sceneItems, translate, blocks, context)
  const frameId = nextId()
  const size = sizeOf(sceneBounds)
  const frame = buildFrameEntity(
    frameId,
    options.sceneName ?? '场景',
    size,
    built.childIds,
    context,
  )

  return {
    scene: {
      frameId,
      size,
      entities: frame ? { ...built.entities, [frameId]: frame } : built.entities,
      childIds: built.childIds,
    },
    components,
    instances: built.instances,
    diagnostics: diagnostics.collect(),
  }
}

/**
 * 把宿主建好的实例 Entity 合进场景计划，得到一份完整页面文档。
 *
 * @remarks
 * 计划里的实例只有位置与基点：实例 Entity 需要资源引用与 revision，而那些要等组件文件写完
 * 才存在。缺任何一个实例都返回 `null`——半份文档的 `Hierarchy` 会指向不存在的 Entity。
 *
 * @public
 */
export function assembleDxfDocument(
  plan: DxfImportPlan,
  instances: Readonly<Record<string, ComposeEntity>>,
): ComposeDocument | null {
  const entities: Record<string, ComposeEntity> = { ...plan.scene.entities }
  for (const instance of plan.instances) {
    const entity = instances[instance.id]
    if (!entity) return null
    entities[instance.id] = entity
  }
  if (!entities[plan.scene.frameId]) return null
  return emptyDocument(entities, plan.scene.frameId)
}

export type { DxfDiagnostic }
