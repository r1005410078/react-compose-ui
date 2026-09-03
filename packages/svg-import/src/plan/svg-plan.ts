import {
  COMPOSE_BUILTIN_COMPONENT_KEYS as KEYS,
  createComposeFrame,
  createComposeGroupEntitySeed,
  createDefaultCanvasSettings,
  normalizeComposeCurveGeometry,
  roundComposeGeometry,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeSize,
  type JsonObject,
} from '@compose-ui/core'
import { createSvgDiagnosticCollector } from '../parser/svg-diagnostics'
import { parseSvg, type SvgNode } from '../parser/svg-parser'
import {
  collectSvgStyleRules,
  computeSvgStyle,
  type SvgComputedStyle,
} from '../parser/svg-style'
import { SVG_SHAPE_TAGS, svgShapeToCurve } from './svg-geometry'
import { resolveSvgPaint, styleNumber } from './svg-paint'
import {
  applySvgMatrix,
  multiplySvgMatrix,
  parseSvgTransform,
  svgStrokeScale,
  SVG_IDENTITY,
  type SvgMatrix,
} from './svg-transform'
import type {
  PlanSvgImportOptions,
  SvgEntitySeed,
  SvgImportPlan,
  SvgPendingAsset,
} from './svg-types'

type Diagnostics = ReturnType<typeof createSvgDiagnosticCollector>

/**
 * 由字号估算基线到盒顶的距离。
 *
 * @remarks
 * SVG 的 `<text>` 锚在**基线**上，页面 Text 锚在盒左上角。导入器无 DOM，量不到真实字体度量，
 * 因此这里给一个比例。它只是**导入那一刻的落点初值**，不是任何契约——盒本身走 Hug，由布局
 * 求解量真实文字。与 `@compose-ui/dxf` 各存一份：两个包互不依赖，这处重复是包边界造成的。
 *
 * @public
 */
export const SVG_TEXT_ASCENT_RATIO = 0.8

/** 由字号估算单字符宽度；只用来把非左对齐的锚点换算成盒左上角。 @public */
export const SVG_TEXT_ADVANCE_RATIO = 0.6

/** 外观修饰属性：忽略它们但**保留几何**，因为它们是修饰而不是形状。 */
const IGNORED_PAINT_EFFECTS = ['filter', 'mask', 'clip-path'] as const

/** 结构元素：自己不产出 Entity，子级的处理各自不同。 */
const STRUCTURAL = new Set(['defs', 'style', 'symbol', 'marker', 'clippath', 'mask', 'pattern'])

interface BuildContext {
  readonly createSeed: PlanSvgImportOptions['createSeed']
  readonly idFactory: () => string
  readonly diagnostics: Diagnostics
  readonly gradients: ReadonlyMap<string, SvgNode>
  readonly byId: ReadonlyMap<string, SvgNode>
  readonly entities: Record<string, ComposeEntity>
  readonly assets: SvgPendingAsset[]
  readonly rules: ReturnType<typeof collectSvgStyleRules>
}

/**
 * 把一份 SVG 规划成组件资产。
 *
 * @remarks
 * 三层里的映射层。前两层（XML 分词、样式与变换归一化）认识的是 SVG 的结构与 CSS，与产出什么
 * 文档无关；换目标时被重写的只有这里。
 *
 * @returns 文本里没有 `<svg>` 根时返回 `null`。
 * @public
 */
export function planSvgImport(
  source: string,
  options: PlanSvgImportOptions,
): SvgImportPlan | null {
  const diagnostics = createSvgDiagnosticCollector()
  const root = parseSvg(source, diagnostics)
  if (!root) return null

  const context: BuildContext = {
    createSeed: options.createSeed,
    idFactory: options.idFactory,
    diagnostics,
    gradients: indexGradients(root),
    byId: indexById(root),
    entities: {},
    assets: [],
    rules: collectSvgStyleRules(root, diagnostics),
  }

  const { size, matrix } = resolveViewport(root)
  const rootStyle = computeSvgStyle(root, {}, context.rules)
  const childIds = buildChildren(root, matrix, rootStyle, context)

  const rootId = options.idFactory()
  const frame = buildFrameEntity(rootId, options.name, size, childIds, context)
  if (!frame) {
    diagnostics.add('svg.missing-preset', 'frame')
    return null
  }
  context.entities[rootId] = frame

  return {
    component: {
      name: options.name,
      size,
      document: {
        schemaVersion: 7,
        canvas: createDefaultCanvasSettings(),
        rootIds: [rootId],
        entities: context.entities,
      } satisfies ComposeDocument,
    },
    assets: context.assets,
    diagnostics: diagnostics.collect(),
  }
}

/**
 * 根 Frame 的尺寸与根变换。
 *
 * @remarks
 * `width`/`height` 与 `viewBox` 不一致时内容要按两者的比例缩放——`<svg width="48" viewBox="0 0 24 24">`
 * 画出来是两倍大。漏掉这一步的症状是「导进来的图标只有四分之一大」，而它只在两者不一致时出现。
 *
 * `viewBox` 的 `min-x`/`min-y` 平移掉：组件根的原点是它自己的左上角。
 */
function resolveViewport(root: SvgNode): { readonly size: ComposeSize; readonly matrix: SvgMatrix } {
  const viewBox = (root.attributes.viewbox ?? '')
    .split(/[\s,]+/)
    .map((raw) => Number.parseFloat(raw))
    .filter((value) => Number.isFinite(value))
  const width = Number.parseFloat(root.attributes.width ?? '')
  const height = Number.parseFloat(root.attributes.height ?? '')
  if (viewBox.length === 4 && viewBox[2]! > 0 && viewBox[3]! > 0) {
    const size = {
      width: Number.isFinite(width) && width > 0 ? width : viewBox[2]!,
      height: Number.isFinite(height) && height > 0 ? height : viewBox[3]!,
    }
    const scale: SvgMatrix = [size.width / viewBox[2]!, 0, 0, size.height / viewBox[3]!, 0, 0]
    return {
      size,
      matrix: multiplySvgMatrix(scale, [1, 0, 0, 1, -viewBox[0]!, -viewBox[1]!]),
    }
  }
  return {
    // SVG 的默认尺寸是 300 × 150；两者都缺席时照它，而不是自己发明一个。
    size: {
      width: Number.isFinite(width) && width > 0 ? width : 300,
      height: Number.isFinite(height) && height > 0 ? height : 150,
    },
    matrix: SVG_IDENTITY,
  }
}

function indexGradients(root: SvgNode): ReadonlyMap<string, SvgNode> {
  const gradients = new Map<string, SvgNode>()
  const walk = (node: SvgNode) => {
    if (node.tag === 'lineargradient' || node.tag === 'radialgradient') {
      const id = node.attributes.id
      if (id) gradients.set(id, node)
    }
    node.children.forEach(walk)
  }
  walk(root)
  return gradients
}

function indexById(root: SvgNode): ReadonlyMap<string, SvgNode> {
  const byId = new Map<string, SvgNode>()
  const walk = (node: SvgNode) => {
    const id = node.attributes.id
    if (id && !byId.has(id)) byId.set(id, node)
    node.children.forEach(walk)
  }
  walk(root)
  return byId
}

/** 处理一组子级，返回它们的 Entity id（文档顺序即绘制顺序，不得重排）。 */
function buildChildren(
  parent: SvgNode,
  matrix: SvgMatrix,
  style: SvgComputedStyle,
  context: BuildContext,
): readonly string[] {
  return parent.children.flatMap((child) => buildNode(child, matrix, style, context))
}

function buildNode(
  node: SvgNode,
  parentMatrix: SvgMatrix,
  parentStyle: SvgComputedStyle,
  context: BuildContext,
): readonly string[] {
  // `<defs>` 之类的结构元素不产出 Entity，它们的内容由引用它的地方展开。
  if (STRUCTURAL.has(node.tag)) return []
  const style = computeSvgStyle(node, parentStyle, context.rules)
  const matrix = multiplySvgMatrix(parentMatrix, parseSvgTransform(node.attributes.transform))
  reportPaintEffects(node, context.diagnostics)

  if (node.tag === 'use') return buildUse(node, matrix, style, context)
  if (node.tag === 'g' || node.tag === 'a' || node.tag === 'svg') {
    const childIds = buildChildren(node, matrix, style, context)
    if (childIds.length === 0) return []
    const id = context.idFactory()
    context.entities[id] = withVisibility(createComposeGroupEntitySeed({
      id,
      name: node.attributes.id ?? 'Group',
      childIds,
    }), style)
    return [id]
  }
  if (SVG_SHAPE_TAGS.has(node.tag)) return buildShape(node, matrix, style, context)
  if (node.tag === 'text') return buildText(node, matrix, style, context)
  if (node.tag === 'image') return buildImage(node, matrix, context)
  context.diagnostics.add('svg.unsupported-element', node.tag)
  return []
}

/**
 * 外观修饰无法表达时**忽略属性、保留几何**。
 *
 * @remarks
 * 用户看到的是一个少了修饰的正确图形——**可见的降级**；而丢掉整个元素是不可见的，用户拿结果
 * 和原图一对，只会认为工具不可靠。
 */
function reportPaintEffects(node: SvgNode, diagnostics: Diagnostics) {
  IGNORED_PAINT_EFFECTS.forEach((name) => {
    if (node.attributes[name]) diagnostics.add('svg.unsupported-paint-effect', name)
  })
}

/** `<use>` 就地展开：解引用并叠加它自己的 `x`/`y` 偏移。 */
function buildUse(
  node: SvgNode,
  matrix: SvgMatrix,
  style: SvgComputedStyle,
  context: BuildContext,
): readonly string[] {
  const href = node.attributes.href ?? ''
  const target = href.startsWith('#') ? context.byId.get(href.slice(1)) : undefined
  if (!target) {
    context.diagnostics.add('svg.unresolved-use', href || 'use')
    return []
  }
  const offset = parseSvgTransform(
    `translate(${node.attributes.x ?? 0} ${node.attributes.y ?? 0})`,
  )
  const shifted = multiplySvgMatrix(matrix, offset)
  // `<symbol>` 与 `<defs>` 里的目标本身不产出 Entity，展开的是它的**子级**。
  return STRUCTURAL.has(target.tag)
    ? buildChildren(target, shifted, style, context)
    : buildNode(target, shifted, style, context)
}

/** 按元素挑最贴切的 Preset：矩形与圆各有自己的入口与手柄，落回 `curve` 会把它们弄丢。 */
function presetFor(tag: string): readonly string[] {
  if (tag === 'rect') return ['rect', 'curve']
  if (tag === 'circle' || tag === 'ellipse') return ['circle', 'curve']
  return ['curve']
}

function buildShape(
  node: SvgNode,
  matrix: SvgMatrix,
  style: SvgComputedStyle,
  context: BuildContext,
): readonly string[] {
  const curve = svgShapeToCurve(node, matrix, context.diagnostics)
  if (!curve) {
    context.diagnostics.add('svg.invalid-element', node.tag)
    return []
  }
  const seed = firstSeed(presetFor(node.tag), context)
  if (!seed) {
    context.diagnostics.add('svg.missing-preset', node.tag)
    return []
  }
  const normalized = normalizeComposeCurveGeometry(curve)
  const id = context.idFactory()
  const fill = resolveSvgPaint(
    style.fill ?? '#000000',
    styleNumber(style, 'fill-opacity', 1),
    context.gradients,
    context.diagnostics,
  )
  const stroke = resolveSvgPaint(
    style.stroke,
    styleNumber(style, 'stroke-opacity', 1),
    context.gradients,
    context.diagnostics,
  )
  const strokeWidth = stroke
    ? styleNumber(style, 'stroke-width', 1) * svgStrokeScale(matrix)
    : 0
  context.entities[id] = withVisibility({
    id,
    name: node.attributes.id ?? seed.name,
    components: {
      ...seed.components,
      [KEYS.appearance]: {
        ...(seed.components[KEYS.appearance] ?? {}),
        backgroundPaint: { kind: 'solid', color: fill ?? 'transparent' },
        opacity: styleNumber(style, 'opacity', 1),
      },
      [KEYS.layoutItem]: fixedBox(seed, normalized.offset, normalized.size),
      [KEYS.renderer]: rendererWith(seed, {
        ...(stroke ? { stroke } : {}),
        strokeWidth: roundComposeGeometry(strokeWidth),
        ...dashProps(style, context.diagnostics),
        ...(style['stroke-linecap'] ? { strokeLinecap: style['stroke-linecap'] } : {}),
      }),
      [KEYS.curve]: normalized.curve as unknown as JsonObject,
    },
  }, style)
  return [id]
}

/**
 * 虚线取既有 picklist 里最接近的一档。
 *
 * @remarks
 * `strokeDasharray` 眼下是由线宽推出的三选一，表达不了任意图案。**取最接近的那一档并诊断**，
 * 而不是静默丢掉：一条本该是虚线的导线画成实线，在接线图上是读图错误。
 */
function dashProps(style: SvgComputedStyle, diagnostics: Diagnostics): JsonObject {
  const raw = style['stroke-dasharray']?.trim()
  if (!raw || raw === 'none') return {}
  const numbers = raw.split(/[\s,]+/).map((value) => Number.parseFloat(value)).filter(Number.isFinite)
  if (numbers.length === 0) return {}
  diagnostics.add('svg.dash-approximated', raw)
  // 第一段极短即点线，否则按短划线。
  return { strokeDasharray: (numbers[0] ?? 0) <= 1 ? '1 4' : '8 4' }
}

function buildText(
  node: SvgNode,
  matrix: SvgMatrix,
  style: SvgComputedStyle,
  context: BuildContext,
): readonly string[] {
  const content = collectText(node, context.diagnostics)
  if (content.trim() === '') return []
  const seed = firstSeed(['text'], context)
  if (!seed) {
    context.diagnostics.add('svg.missing-preset', 'text')
    return []
  }
  const fontSize = styleNumber(style, 'font-size', 12)
  const anchor = applySvgMatrix(matrix, {
    x: Number.parseFloat(node.attributes.x ?? '0') || 0,
    y: Number.parseFloat(node.attributes.y ?? '0') || 0,
  })
  const align = style['text-anchor'] === 'middle'
    ? 'center'
    : style['text-anchor'] === 'end' ? 'right' : 'left'
  const estimatedWidth = content.length * fontSize * SVG_TEXT_ADVANCE_RATIO
  const offset = {
    x: roundComposeGeometry(anchor.x - (align === 'center'
      ? estimatedWidth / 2
      : align === 'right' ? estimatedWidth : 0)),
    y: roundComposeGeometry(anchor.y - fontSize * SVG_TEXT_ASCENT_RATIO),
  }
  const color = resolveSvgPaint(
    style.fill ?? '#000000',
    styleNumber(style, 'fill-opacity', 1),
    context.gradients,
    context.diagnostics,
  )
  const id = context.idFactory()
  context.entities[id] = withVisibility({
    id,
    name: node.attributes.id ?? content.slice(0, 20),
    components: {
      ...seed.components,
      [KEYS.layoutItem]: hugBox(seed, offset),
      [KEYS.renderer]: rendererWith(seed, {
        text: content,
        fontSize: roundComposeGeometry(fontSize * svgStrokeScale(matrix)),
        textAlign: align,
        ...(color ? { color } : {}),
        ...(style['font-family'] ? { fontFamily: style['font-family'] } : {}),
        ...(style['font-weight'] ? { fontWeight: style['font-weight'] } : {}),
      }),
    },
  }, style)
  return [id]
}

/** `<tspan>` 的独立定位不支持，只取它的文本。 */
function collectText(node: SvgNode, diagnostics: Diagnostics): string {
  if (node.children.some((child) => child.tag === 'tspan')) {
    diagnostics.add('svg.tspan-flattened', 'tspan')
  }
  const walk = (current: SvgNode): string => (
    current.text + current.children.map(walk).join('')
  )
  return walk(node).replace(/\s+/g, ' ').trim()
}

function buildImage(
  node: SvgNode,
  matrix: SvgMatrix,
  context: BuildContext,
): readonly string[] {
  const href = node.attributes.href ?? ''
  const data = /^data:([^;,]+);base64,(.*)$/s.exec(href.trim())
  if (!data) {
    // 外链已在安全规则里被拒；这里报的是同一件事的另一半——它没有进文档。
    context.diagnostics.add('svg.executable-content', 'image-href')
    return []
  }
  const width = Number.parseFloat(node.attributes.width ?? '')
  const height = Number.parseFloat(node.attributes.height ?? '')
  if (!(width > 0) || !(height > 0)) {
    // 尺寸未知的图片放进绝对布局里，落点与盒都无从谈起。
    context.diagnostics.add('svg.unknown-image-size', 'image')
    return []
  }
  const seed = firstSeed(['image'], context)
  if (!seed) {
    context.diagnostics.add('svg.missing-preset', 'image')
    return []
  }
  const x = Number.parseFloat(node.attributes.x ?? '0') || 0
  const y = Number.parseFloat(node.attributes.y ?? '0') || 0
  const topLeft = applySvgMatrix(matrix, { x, y })
  const bottomRight = applySvgMatrix(matrix, { x: x + width, y: y + height })
  const id = context.idFactory()
  const mediaType = data[1] ?? 'image/png'
  context.entities[id] = {
    id,
    name: node.attributes.id ?? seed.name,
    components: {
      ...seed.components,
      [KEYS.layoutItem]: fixedBox(
        seed,
        { x: roundComposeGeometry(topLeft.x), y: roundComposeGeometry(topLeft.y) },
        {
          width: roundComposeGeometry(Math.abs(bottomRight.x - topLeft.x)),
          height: roundComposeGeometry(Math.abs(bottomRight.y - topLeft.y)),
        },
      ),
    },
  }
  context.assets.push({
    entityId: id,
    fileName: `${node.attributes.id ?? 'image'}.${mediaType.split('/')[1] ?? 'png'}`,
    mediaType,
    base64: data[2] ?? '',
  })
  return [id]
}

/** 取第一个能创建出来的 Preset；都取不到时返回 `null`。 */
function firstSeed(presetIds: readonly string[], context: BuildContext): SvgEntitySeed | null {
  for (const presetId of presetIds) {
    const seed = context.createSeed(presetId)
    if (seed) return seed
  }
  return null
}

/** `display: none` 与 `visibility: hidden` 都落成不可见——它们在屏幕上是同一件事。 */
function withVisibility(entity: ComposeEntity, style: SvgComputedStyle): ComposeEntity {
  const hidden = style.display === 'none' || style.visibility === 'hidden'
  if (!hidden) return entity
  return {
    ...entity,
    components: { ...entity.components, [KEYS.visibility]: { visible: false } },
  }
}

function axis(source: JsonObject | undefined, mode: 'fixed' | 'hug', value: number): JsonObject {
  return { ...(source ?? {}), mode, value: Math.max(1, value), min: null, max: null }
}

function fixedBox(
  seed: SvgEntitySeed,
  offset: { readonly x: number; readonly y: number },
  size: ComposeSize,
): JsonObject {
  const layoutItem = (seed.components[KEYS.layoutItem] ?? {}) as JsonObject
  return {
    ...layoutItem,
    offset: { x: offset.x, y: offset.y },
    width: axis(layoutItem.width as JsonObject, 'fixed', size.width),
    height: axis(layoutItem.height as JsonObject, 'fixed', size.height),
  }
}

/** 文字的盒走 Hug：盒是会被看见的东西，不该停在估算值上。 */
function hugBox(seed: SvgEntitySeed, offset: { readonly x: number; readonly y: number }): JsonObject {
  const layoutItem = (seed.components[KEYS.layoutItem] ?? {}) as JsonObject
  return {
    ...layoutItem,
    offset: { x: offset.x, y: offset.y },
    width: { ...((layoutItem.width ?? {}) as JsonObject), mode: 'hug' },
    height: { ...((layoutItem.height ?? {}) as JsonObject), mode: 'hug' },
  }
}

function rendererWith(seed: SvgEntitySeed, props: JsonObject): JsonObject {
  const renderer = (seed.components[KEYS.renderer] ?? {}) as JsonObject
  return {
    ...renderer,
    props: { ...((renderer.props ?? {}) as JsonObject), ...props },
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
  const hierarchy = (seed.components[KEYS.hierarchy] ?? {}) as JsonObject
  return {
    id,
    name,
    components: {
      ...seed.components,
      // 尺寸的事实来源是 `Frame.size`；`LayoutItem` 的固定尺寸只是求解回退，两者必须一致。
      [KEYS.frame]: { ...createComposeFrame(size), ...(seed.components[KEYS.frame] ?? {}), size },
      [KEYS.hierarchy]: { ...hierarchy, childIds: [...childIds] },
      [KEYS.layoutItem]: fixedBox(seed, { x: 0, y: 0 }, size),
    },
  }
}
