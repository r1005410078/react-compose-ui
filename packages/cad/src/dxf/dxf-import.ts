import type { ComposeEntity } from '@compose-ui/core'
import { createCadInsert } from '../block'
import {
  CAD_DEFAULT_LAYER_ID,
  createCadArcEntity,
  createCadLineEntity,
  createCadPolylineEntity,
  createCadTextEntity,
  createEmptyCadDocument,
  type CadBlockDefinition,
  type CadDocument,
  type CadLayer,
  type CadPoint,
} from '../document'
import type { CadTextAlign } from '../geometry'
import {
  createDxfDiagnosticCollector,
  type DxfDiagnostic,
} from './dxf-diagnostics'
import {
  allValues,
  firstValue,
  groupDxfRecords,
  numberValue,
  tokenizeDxf,
  type DxfRecord,
} from './dxf-parser'

/** 导入结果。 @public */
export interface DxfImportResult {
  readonly document: CadDocument
  /** 没有被完整表达的内容；空数组表示全部导入。 */
  readonly diagnostics: readonly DxfDiagnostic[]
}

/**
 * DXF 的 Y 轴朝上，屏幕的 Y 轴朝下。
 *
 * @remarks
 * 翻转矩阵 `F = diag(1, -1)` 满足 `F² = I`，因此块实例的世界变换 `p = I + R(θ)·S·b` 在翻转
 * 之后是 `F p = F I + R(−θ)·S·(F b)`——位置翻转、**旋转取反**、**比例不变**，三条是同一个
 * 恒等式的三个推论。三者要么一起对、要么一起错，而错了的症状是「图看起来像镜像的」，很容易
 * 被误当成源文件本身的问题。
 */
function flipPoint(x: number, y: number): CadPoint {
  return { x, y: -y }
}

/**
 * DXF 的角是 Y 朝上的逆时针，本仓的角是屏幕顺时针。
 *
 * @remarks
 * 翻转把逆时针共轭成顺时针，因此取反即可。
 */
function flipAngle(degrees: number) {
  return -degrees
}

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

/**
 * DXF 的文字水平对齐（组码 72）。
 *
 * @remarks
 * 只映射前三种。3（Aligned）、4（Middle）、5（Fit）会改变字高或字宽以适配两个对齐点，本仓的
 * 文字没有这个概念，按左对齐处理。
 */
const TEXT_ALIGNS: Record<number, CadTextAlign> = { 0: 'left', 1: 'center', 2: 'right' }

/** 能映射成图元的实体类型。 */
const SUPPORTED = new Set(['LINE', 'CIRCLE', 'ARC', 'LWPOLYLINE', 'TEXT', 'INSERT'])

function readLayers(records: readonly DxfRecord[]): readonly CadLayer[] {
  const layers: CadLayer[] = []
  const seen = new Set<string>()
  for (const record of records) {
    if (record.type !== 'LAYER') continue
    const name = firstValue(record, 2)?.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    // 负的颜色号表示图层关闭；`70` 的第 1 位是冻结、第 3 位（值 4）是锁定。
    const color = numberValue(record, 62, 7)
    const flags = numberValue(record, 70, 0)
    layers.push({
      id: name,
      name,
      color: ACI_COLORS[Math.abs(color)] ?? DEFAULT_LAYER_COLOR,
      visible: color >= 0 && (flags & 1) === 0,
      locked: (flags & 4) !== 0,
    })
  }
  // 图层 `0` 在 DXF 里永远存在；文件没给也补一个，否则落回它的实体会指向不存在的图层。
  if (!seen.has(CAD_DEFAULT_LAYER_ID)) {
    layers.unshift({
      id: CAD_DEFAULT_LAYER_ID,
      name: CAD_DEFAULT_LAYER_ID,
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
  const vertices: CadPoint[] = []
  for (let i = 0; i < count; i += 1) {
    if (!Number.isFinite(xs[i]!) || !Number.isFinite(ys[i]!)) return null
    vertices.push(flipPoint(xs[i]!, ys[i]!))
  }
  return vertices
}

/** 一次导入过程中共享的可变状态。 */
interface MapContext {
  readonly layerIds: ReadonlySet<string>
  readonly diagnostics: ReturnType<typeof createDxfDiagnosticCollector>
  nextId: () => string
}

function resolveLayer(record: DxfRecord, context: MapContext) {
  const name = firstValue(record, 8)?.trim() ?? CAD_DEFAULT_LAYER_ID
  if (context.layerIds.has(name)) return name
  // 一个拼错的图层名不该让整张图导不进来。
  context.diagnostics.add('dxf.unknown-layer', name)
  return CAD_DEFAULT_LAYER_ID
}

/**
 * 把一条实体记录映射成 Entity。
 *
 * @param blocks - 已知的块名集合；`null` 表示当前正在块定义**内部**，此时 `INSERT` 不允许。
 */
function mapEntity(
  record: DxfRecord,
  context: MapContext,
  blocks: ReadonlySet<string> | null,
): ComposeEntity | null {
  if (!SUPPORTED.has(record.type)) {
    context.diagnostics.add('dxf.unsupported-entity', record.type)
    return null
  }
  const layerId = resolveLayer(record, context)
  const id = context.nextId()

  if (record.type === 'LINE') {
    const start = flipPoint(numberValue(record, 10, NaN), numberValue(record, 20, NaN))
    const end = flipPoint(numberValue(record, 11, NaN), numberValue(record, 21, NaN))
    if (!Number.isFinite(start.x + start.y + end.x + end.y)) {
      context.diagnostics.add('dxf.invalid-entity', record.type)
      return null
    }
    return createCadLineEntity(id, { layerId, start, end })
  }

  if (record.type === 'CIRCLE' || record.type === 'ARC') {
    const center = flipPoint(numberValue(record, 10, NaN), numberValue(record, 20, NaN))
    const radius = numberValue(record, 40, NaN)
    if (!Number.isFinite(center.x + center.y) || !(radius > 0)) {
      context.diagnostics.add('dxf.invalid-entity', record.type)
      return null
    }
    if (record.type === 'CIRCLE') {
      return createCadArcEntity(id, { layerId, center, radius, startAngle: 0, sweep: 360 })
    }
    const startAngle = numberValue(record, 50, 0)
    const endAngle = numberValue(record, 51, 0)
    // DXF 的弧从起角**逆时针**走到终角，因此扫掠先在 DXF 的方向上归一化到 [0,360)，再整体取反。
    const dxfSweep = ((endAngle - startAngle) % 360 + 360) % 360
    return createCadArcEntity(id, {
      layerId,
      center,
      radius,
      startAngle: flipAngle(startAngle),
      // 起终角相同在 DXF 里表示整圆而不是零长弧。
      sweep: flipAngle(dxfSweep === 0 ? 360 : dxfSweep),
    })
  }

  if (record.type === 'LWPOLYLINE') {
    const vertices = readVertices(record)
    if (!vertices || vertices.length < 2) {
      context.diagnostics.add('dxf.invalid-entity', record.type)
      return null
    }
    // bulge 非零的段是圆弧。`CadPolyline` 没有这个字段，而把一条带弧的折线拆成「多段线 + 若干
    // 独立圆弧」会让它不再是一个对象——那正是多段线存在的意义。因此按弦导入并报告。
    if (allValues(record, 42).some((value) => Number(value.trim()) !== 0)) {
      context.diagnostics.add('dxf.polyline-bulge', record.type)
    }
    return createCadPolylineEntity(id, {
      layerId,
      vertices,
      closed: (numberValue(record, 70, 0) & 1) !== 0,
    })
  }

  if (record.type === 'TEXT') {
    const position = flipPoint(numberValue(record, 10, NaN), numberValue(record, 20, NaN))
    const height = numberValue(record, 40, NaN)
    const content = firstValue(record, 1) ?? ''
    if (!Number.isFinite(position.x + position.y) || !(height > 0) || content.length === 0) {
      context.diagnostics.add('dxf.invalid-entity', record.type)
      return null
    }
    return createCadTextEntity(id, {
      layerId,
      position,
      content,
      height,
      rotation: flipAngle(numberValue(record, 50, 0)),
      align: TEXT_ALIGNS[numberValue(record, 72, 0)] ?? 'left',
    })
  }

  // INSERT
  if (blocks === null) {
    // 本仓的校验器拒绝嵌套块，硬导进去会让整份文档不合法——一个符号毁掉一张图。
    context.diagnostics.add('dxf.nested-block', firstValue(record, 2)?.trim() ?? '')
    return null
  }
  const blockName = firstValue(record, 2)?.trim() ?? ''
  if (!blocks.has(blockName)) {
    context.diagnostics.add('dxf.unknown-block', blockName)
    return null
  }
  const position = flipPoint(numberValue(record, 10, NaN), numberValue(record, 20, NaN))
  if (!Number.isFinite(position.x + position.y)) {
    context.diagnostics.add('dxf.invalid-entity', record.type)
    return null
  }
  return {
    id,
    name: blockName,
    components: {
      CadPlacement: { layerId },
      CadInsert: createCadInsert(blockName, position, {
        // 旋转取反、比例不变——同一个恒等式的两条推论。
        rotation: flipAngle(numberValue(record, 50, 0)),
        scale: { x: numberValue(record, 41, 1), y: numberValue(record, 42, 1) },
      }),
    },
  }
}

/** 把块内几何按基点换算为块局部坐标。 */
function offsetEntity(entity: ComposeEntity, base: CadPoint): ComposeEntity {
  const shift = (point: CadPoint): CadPoint => ({ x: point.x - base.x, y: point.y - base.y })
  const components = { ...entity.components }
  const line = components.CadLine as { start: CadPoint, end: CadPoint } | undefined
  if (line) components.CadLine = { start: shift(line.start), end: shift(line.end) }
  const arc = components.CadArc as { center: CadPoint } | undefined
  if (arc) components.CadArc = { ...arc, center: shift(arc.center) }
  const text = components.CadText as { position: CadPoint } | undefined
  if (text) components.CadText = { ...text, position: shift(text.position) }
  const polyline = components.CadPolyline as { vertices: readonly CadPoint[] } | undefined
  if (polyline) components.CadPolyline = { ...polyline, vertices: polyline.vertices.map(shift) }
  return { ...entity, components }
}

/**
 * 导入一份 ASCII DXF。
 *
 * @remarks
 * 纯函数：喂字符串、断言结果，不碰交互内核也不碰资源系统。
 *
 * **导入能导的，报告导不了的**。整份拒绝在这里不合理——一个 `DIMENSION` 不该让 95% 可用的图
 * 导不进来；静默丢弃同样不行——用户拿结果与原图一对，发现少了东西却没有解释，只会认为工具
 * 不可靠。
 *
 * @param text - ASCII DXF 文本。
 * @param options.idFactory - 生成 Entity ID；默认递增，便于测试断言。
 * @public
 */
export function importDxfDocument(
  text: string,
  options: { readonly idFactory?: () => string } = {},
): DxfImportResult {
  const records = groupDxfRecords(tokenizeDxf(text))
  const diagnostics = createDxfDiagnosticCollector()
  let counter = 0
  const nextId = options.idFactory ?? (() => `dxf-${(counter += 1)}`)

  const layers = readLayers(records)
  const context: MapContext = {
    layerIds: new Set(layers.map(({ id }) => id)),
    diagnostics,
    nextId,
  }

  // 先扫一遍块名：`INSERT` 可能出现在块定义之前，两趟比要求文件有序可靠。
  const blockNames = new Set<string>()
  for (const record of records) {
    if (record.type !== 'BLOCK') continue
    const name = firstValue(record, 2)?.trim()
    if (name && !name.startsWith('*')) blockNames.add(name)
  }

  const blocks: Record<string, CadBlockDefinition> = {}
  const entities: Record<string, ComposeEntity> = {}
  const rootIds: string[] = []

  /**
   * 当前块定义的名字；`null` 表示这个块不保留（布局块）。
   *
   * @remarks
   * 与 `insideBlock` 是两件事：布局块的内容既不进块表，也**不能**掉到顶层——它属于那个块。
   * 用一个变量兼职会让 `*Model_Space` 里的几何全部漏到图纸上。
   */
  let currentBlock: string | null = null
  let insideBlock = false
  let blockBase: CadPoint = { x: 0, y: 0 }
  let blockMembers: Record<string, ComposeEntity> = {}
  let blockRootIds: string[] = []
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
      blockMembers = {}
      blockRootIds = []
      continue
    }
    if (record.type === 'ENDBLK') {
      if (currentBlock !== null && blockRootIds.length > 0) {
        blocks[currentBlock] = {
          id: currentBlock,
          name: currentBlock,
          rootIds: blockRootIds,
          entities: blockMembers,
          ports: [],
        }
      }
      currentBlock = null
      insideBlock = false
      continue
    }

    // 表段里除了 LAYER 没有别的可读，实体段与块段之外的记录一律不当实体处理。
    if (record.type === 'LAYER' || record.type === 'TABLE' || record.type === 'ENDTAB') continue
    if (section !== 'ENTITIES' && section !== 'BLOCKS') continue

    const entity = mapEntity(record, context, insideBlock ? null : blockNames)
    if (!entity) continue
    // 布局块的内容被读了出来但不属于任何地方，直接丢掉。
    if (insideBlock && currentBlock === null) continue

    if (insideBlock) {
      const local = offsetEntity(entity, blockBase)
      blockMembers[local.id] = local
      blockRootIds.push(local.id)
      continue
    }
    entities[entity.id] = entity
    rootIds.push(entity.id)
  }

  const base = createEmptyCadDocument()
  return {
    document: { ...base, layers, rootIds, entities, blocks },
    diagnostics: diagnostics.collect(),
  }
}
