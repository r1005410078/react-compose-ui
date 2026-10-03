import {
  getComposeCurve,
  getComposeCurveFill,
  getComposeFrame,
  getComposeHierarchy,
  getComposeRenderer,
  getComposeTransform,
  getComposeTransformPivot,
  getComposeVisibility,
  resolveComposeAppearance,
  resolveComposeOverflow,
  resolveComposeRenderedChildIds,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
  type ComposePaint,
  type ComposeResolvedLayoutBox,
} from '@compose-ui/core'
import { curveShape } from './qml-curve'
import type {
  ComposeQmlExportDiagnostic,
  ComposeQmlExportInput,
  ComposeQmlExportResult,
  ComposeQmlInstanceContent,
} from './qml-export-types'
import { textObjects } from './qml-text'
import { qmlColor, qmlNumber, qmlString, writeQmlDocument, type QmlObject } from './qml-writer'

/** 导出入口拒绝输入时抛出：要导出的场景不存在、不是根 Frame 或没有布局结果。 @public */
export class ComposeQmlExportError extends Error {
  override readonly name = 'ComposeQmlExportError'
}

/** 组件实例的 Renderer 类型；协议常量住在物料包，本包不依赖它。 */
const COMPONENT_INSTANCE_RENDERER = 'component-instance'

/** Renderer 自己不画任何东西的类型：视觉全部来自 `Appearance`。 */
const APPEARANCE_ONLY_RENDERERS = new Set(['rectangle'])

/** 占位的样式：一块半透明的框，让「这里本来有东西」在画面上看得出来。 */
const PLACEHOLDER_FILL = '#1f94a3b8'
const PLACEHOLDER_BORDER = '#94a3b8'

/**
 * Entity 地址到 QML id 的确定性映射。
 *
 * @remarks
 * QML id 只能以小写字母或下划线开头、只含 `[A-Za-z0-9_]`，因此统一加 `e_` 前缀并替换其余字符。
 * 组件实例内部的对象用复合地址（`实例/内部`），段之间写成 `__`：同一个组件放八次，内部对象
 * 各有八份，id 必须带上实例前缀才互不相同。
 * 两个地址规范化后相撞时按**遍历顺序**追加后缀——遍历顺序由文档层级决定，所以同一输入两次
 * 导出得到同一组 id。原始地址另写进 `objectName`，Qt 一侧按地址查找对象不依赖这套规则。
 */
function createIdAllocator() {
  const used = new Set<string>()
  return (address: string) => {
    const base = `e_${address.split('/').map((segment) => segment.replace(/[^A-Za-z0-9_]/g, '_')).join('__')}`
    let candidate = base
    for (let suffix = 2; used.has(candidate); suffix += 1) candidate = `${base}_${suffix}`
    used.add(candidate)
    return candidate
  }
}

/**
 * 背景 Paint 在 QML 里能画成的纯色。
 *
 * @remarks
 * 渐变取**最靠近轨道中点**的色标：它是整块面积上最有代表性的那个颜色，取首尾任一端都会让
 * 一块从深到浅的渐变整个变成它最深或最浅的样子。
 */
function paintColor(paint: ComposePaint): { readonly color: string; readonly degraded: 'gradient' | 'image' | null } {
  if (paint.kind === 'solid') return { color: paint.color, degraded: null }
  if (paint.kind === 'image') return { color: 'transparent', degraded: 'image' }
  const middle = [...paint.stops].sort((a, b) => Math.abs(a.position - 0.5) - Math.abs(b.position - 0.5))[0]
  return { color: middle?.color ?? 'transparent', degraded: 'gradient' }
}

function isTransparent(color: string) {
  return color === 'transparent' || /^#[0-9a-fA-F]{6}00$/.test(color)
}

interface ExportContext {
  readonly input: ComposeQmlExportInput
  readonly allocateId: (entityId: string) => string
  readonly diagnostics: ComposeQmlExportDiagnostic[]
  readonly fontFamilies: string[]
}

/**
 * 一次导出遍历所在的文档：页面本身，或某个组件实例的嵌套文档。
 *
 * @remarks
 * 嵌套文档有自己的快照与坐标原点，因此盒子永远从**当前作用域**的快照里读；`prefix` 是这层
 * 实例的复合地址，页面一级为空串。
 */
interface ExportScope {
  readonly document: ComposeDocument
  readonly snapshot: ComposeLayoutSnapshot
  readonly prefix: string
}

function scopedAddress(scope: ExportScope, entityId: string) {
  return scope.prefix ? `${scope.prefix}/${entityId}` : entityId
}

function report(context: ExportContext, diagnostic: ComposeQmlExportDiagnostic) {
  context.diagnostics.push(diagnostic)
}

function placeholder(size: ComposeResolvedLayoutBox): QmlObject {
  return {
    type: 'Rectangle',
    properties: [
      ['width', qmlNumber(size.width)],
      ['height', qmlNumber(size.height)],
      ['color', qmlColor(PLACEHOLDER_FILL)],
      ['border.color', qmlColor(PLACEHOLDER_BORDER)],
      ['border.width', '1'],
    ],
    children: [],
  }
}

/**
 * Renderer 的内容：文字、曲线、占位或什么都不画。
 *
 * @remarks
 * 曲线按 `Curve` Component 判定而不是 Renderer 类型——与预览、命中走同一个谓词。
 */
function rendererContent(
  context: ExportContext,
  entity: ComposeEntity,
  address: string,
  qmlId: string,
  box: ComposeResolvedLayoutBox,
): readonly QmlObject[] {
  const curve = getComposeCurve(entity)
  const renderer = getComposeRenderer(entity)
  if (curve) return [curveShape(curve, renderer?.props ?? {}, getComposeCurveFill(entity), box)]
  if (!renderer || APPEARANCE_ONLY_RENDERERS.has(renderer.type)) return []
  if (renderer.type === COMPONENT_INSTANCE_RENDERER) {
    const content = context.input.instances?.get(address)
    if (content) {
      const expanded = instanceContent(context, address, content, box)
      if (expanded) return [expanded]
    }
    report(context, {
      code: 'instance.unresolved',
      entityId: address,
      message: `组件实例「${address}」没有可用的嵌套求解结果，已导出为同尺寸的占位。`,
    })
    return [placeholder(box)]
  }
  if (renderer.type === 'text') {
    const text = textObjects(qmlId, renderer.props, box)
    if (text.fontFamily && !context.fontFamilies.includes(text.fontFamily)) {
      context.fontFamilies.push(text.fontFamily)
    }
    if (typeof renderer.props.fontFamily === 'string' && renderer.props.fontFamily.includes(',')) {
      report(context, {
        code: 'text.font-stack',
        entityId: address,
        message: `字体栈「${renderer.props.fontFamily}」只导出第一个字族「${text.fontFamily ?? ''}」，其余由 Qt 自行回退。`,
      })
    }
    return text.objects
  }
  report(context, {
    code: 'renderer.placeholder',
    entityId: address,
    message: `「${renderer.type}」类型的内容暂不支持导出，已导出为同尺寸的占位。`,
  })
  return [placeholder(box)]
}

function reportStaticBehaviour(context: ExportContext, entity: ComposeEntity, address: string) {
  const bindings = entity.components.Bindings as { readonly rendererProps?: { readonly fields?: object } } | undefined
  const fields = Object.keys(bindings?.rendererProps?.fields ?? {})
  if (fields.length > 0) {
    report(context, {
      code: 'binding.static-value',
      entityId: address,
      message: `数据绑定（${fields.join('、')}）按文档中的当前值静态导出。`,
    })
  }
  if (entity.components.Animation !== undefined) {
    report(context, {
      code: 'animation.static-pose',
      entityId: address,
      message: '动画轨道不导出，对象按文档中的静态姿态导出。',
    })
  }
}

function scaleTransform(
  scale: { readonly x: number; readonly y: number },
  origin: { readonly x: number; readonly y: number },
): QmlObject {
  return {
    type: 'Scale',
    properties: [
      ...(origin.x !== 0 ? [['origin.x', qmlNumber(origin.x)] as const] : []),
      ...(origin.y !== 0 ? [['origin.y', qmlNumber(origin.y)] as const] : []),
      ['xScale', qmlNumber(scale.x)],
      ['yScale', qmlNumber(scale.y)],
    ],
    children: [],
  }
}

/**
 * 把一个组件实例内联展开成一棵子树。
 *
 * @remarks
 * 结构照搬预览的实例渲染器：实例盒（叶子，已经裁剪）→ 翻转层（绕**盒中心**镜像，不读
 * `Transform.pivot`——那个字段回答的是绕哪一点旋转）→ `scale` 时的缩放层（按根的自然尺寸
 * 摆放、以原点为基准）→ 嵌套文档的根子树。两层分开写而不是乘成一个 `Scale`：两者的原点
 * 不同，乘起来就得再推一遍原点，而预览本来就是两层。
 *
 * 嵌套文档在自己的作用域里导出：盒子读嵌套快照，地址带上实例前缀，因此内层实例按
 * `外层/内层` 取得自己的求解结果。
 */
function instanceContent(
  context: ExportContext,
  address: string,
  content: ComposeQmlInstanceContent,
  box: ComposeResolvedLayoutBox,
): QmlObject | null {
  const rootId = content.document.rootIds[0]
  if (!rootId || content.document.rootIds.length !== 1) return null
  const scope: ExportScope = { document: content.document, snapshot: content.snapshot, prefix: address }
  const root = exportEntity(context, scope, rootId, false)
  if (!root) return null
  let inner = root
  if (content.contentFit === 'scale' && content.rootSize) {
    inner = {
      type: 'Item',
      properties: [
        ['width', qmlNumber(content.rootSize.width)],
        ['height', qmlNumber(content.rootSize.height)],
        ...(content.contentScale.x !== 1 || content.contentScale.y !== 1
          ? [['transform', scaleTransform(content.contentScale, { x: 0, y: 0 })] as const]
          : []),
      ],
      children: [inner],
    }
  }
  const flipped = content.flipScale.x !== 1 || content.flipScale.y !== 1
  return {
    type: 'Item',
    properties: [
      ['width', qmlNumber(box.width)],
      ['height', qmlNumber(box.height)],
      ...(flipped
        ? [['transform', scaleTransform(content.flipScale, { x: box.width / 2, y: box.height / 2 })] as const]
        : []),
    ],
    children: [inner],
  }
}

/**
 * 导出一个 Entity 及其子树。
 *
 * @remarks
 * 层序照搬预览：Paint（底色）→ Renderer 内容 → 子级 → **边框覆盖层**。预览的边框是压在子级
 * 之上的独立一层，而 Qt `Rectangle` 自己的边框画在子级下面；写成同一个 `Rectangle` 的
 * `border` 会让贴边的子级盖住边框。
 */
function exportEntity(
  context: ExportContext,
  scope: ExportScope,
  entityId: string,
  isRoot: boolean,
): QmlObject | null {
  const { document, snapshot } = scope
  const entity = document.entities[entityId]
  // 根场景即使被隐藏也照样导出：导出单位就是它，隐藏只是编辑期的视图状态。
  if (!entity || (!isRoot && !getComposeVisibility(entity).visible)) return null
  const box = snapshot.boxes[entityId]
  if (!box) return null
  const address = scopedAddress(scope, entityId)
  const qmlId = context.allocateId(address)
  const curve = getComposeCurve(entity)
  const hierarchy = getComposeHierarchy(entity)
  const appearance = resolveComposeAppearance(entity)
  reportStaticBehaviour(context, entity, address)

  // 曲线的盒不是它的形状：预览不为它画任何背景，填充由形状自己画。
  const paint = curve ? { color: 'transparent', degraded: null } : paintColor(appearance.backgroundPaint)
  if (paint.degraded === 'gradient') {
    report(context, {
      code: 'paint.gradient-degraded',
      entityId: address,
      message: `渐变背景已降级为中位色标的纯色 ${paint.color}。`,
    })
  }
  if (paint.degraded === 'image') {
    report(context, { code: 'paint.image-unsupported', entityId: address, message: '图片背景暂不支持导出，已省略。' })
  }
  if (appearance.shadow) {
    report(context, { code: 'appearance.shadow-ignored', entityId: address, message: '阴影暂不支持导出，已省略。' })
  }
  const hasBackground = !isTransparent(paint.color)

  const clip = (() => {
    if (curve) return false
    // 预览里叶子恒为 overflow: hidden——文字溢出盒子时被裁掉。
    if (!hierarchy) return true
    const overflow = resolveComposeOverflow(entity)
    const modes = [overflow.horizontal, overflow.vertical]
    if (modes.every((mode) => mode === 'visible')) return false
    if (modes.includes('scroll')) {
      report(context, {
        code: 'overflow.scroll-unsupported',
        entityId: address,
        message: '滚动容器按裁剪导出，Qt 中不能滚动。',
      })
    }
    if (overflow.horizontal !== overflow.vertical && modes.includes('visible')) {
      report(context, {
        code: 'overflow.axis-mixed',
        entityId: address,
        message: '只在一个方向裁剪的容器，在 Qt 中两个方向一起裁剪。',
      })
    }
    return true
  })()
  const childIds = hierarchy ? resolveComposeRenderedChildIds(document, entityId) : []
  if (clip && hierarchy && appearance.borderRadius > 0 && childIds.length > 0) {
    report(context, {
      code: 'overflow.rounded-clip',
      entityId: address,
      message: '圆角容器在 Qt 中按矩形裁剪子级，圆角外的部分不会被裁掉。',
    })
  }

  const transform = getComposeTransform(entity)
  const pivot = getComposeTransformPivot(entity)
  // 根场景的盒子坐标是它在无限工作区上的位置，导出单位就是这块场景，因此根不写 x/y。
  const size = isRoot ? (getComposeFrame(entity)?.size ?? box) : box
  const properties: (readonly [string, string | QmlObject])[] = [
    ['id', qmlId],
    ['objectName', qmlString(address)],
    ...(isRoot ? [] : [['x', qmlNumber(box.x)] as const, ['y', qmlNumber(box.y)] as const]),
    ['width', qmlNumber(size.width)],
    ['height', qmlNumber(size.height)],
    ...(hasBackground ? [['color', qmlColor(paint.color)] as const] : []),
    ...(hasBackground && appearance.borderRadius > 0 ? [['radius', qmlNumber(appearance.borderRadius)] as const] : []),
    ...(appearance.opacity !== 1 ? [['opacity', qmlNumber(appearance.opacity)] as const] : []),
    ...(clip ? [['clip', 'true'] as const] : []),
    ...(transform.rotation !== 0
      ? [['transform', {
          // 自由基点：`transformOrigin` 只有九个枚举值，接不住盒外的基点。
          type: 'Rotation',
          properties: [
            ['origin.x', qmlNumber(pivot.x * size.width)],
            ['origin.y', qmlNumber(pivot.y * size.height)],
            ['angle', qmlNumber(transform.rotation)],
          ],
          children: [],
        } satisfies QmlObject] as const]
      : []),
  ]

  const children: QmlObject[] = [...rendererContent(context, entity, address, qmlId, box)]
  for (const childId of childIds) {
    const child = exportEntity(context, scope, childId, false)
    if (child) children.push(child)
  }
  if (!curve && appearance.borderWidth > 0 && !isTransparent(appearance.borderColor)) {
    children.push({
      type: 'Rectangle',
      properties: [
        ['width', qmlNumber(size.width)],
        ['height', qmlNumber(size.height)],
        ['color', qmlColor('transparent')],
        ['border.color', qmlColor(appearance.borderColor)],
        ['border.width', qmlNumber(appearance.borderWidth)],
        ...(appearance.borderRadius > 0 ? [['radius', qmlNumber(appearance.borderRadius)] as const] : []),
      ],
      children: [],
    })
  }

  return { type: hasBackground ? 'Rectangle' : 'Item', properties, children }
}

/**
 * 把一块场景导出成 Qt Quick 能直接加载的 `.qml`。
 *
 * @remarks
 * 导出的是**求解之后的结果**，不翻译布局语义：每个对象按布局快照绝对定位。Qt Quick 的
 * Layouts 与 Yoga 在 gap、Hug、换行与最小/最大尺寸上的算法都不同，翻译过去的症状是「到处差
 * 几个像素」而且无从查起；场景本来就是定尺寸的大屏，绝对定位没有损失。
 *
 * 不能表达的内容降级导出并给出诊断，元素不丢。
 *
 * @param input - 已解算的文档、成对的布局快照与要导出的场景
 * @returns QML 文本、诊断与用到的字族
 * @throws {@link ComposeQmlExportError} 场景不是文档的根 Frame，或快照里没有它的盒子
 * @public
 */
export function exportComposeSceneToQml(input: ComposeQmlExportInput): ComposeQmlExportResult {
  const { document, snapshot, frameId } = input
  const frame = document.entities[frameId]
  if (!document.rootIds.includes(frameId) || !getComposeFrame(frame)) {
    throw new ComposeQmlExportError(`「${frameId}」不是文档的根场景`)
  }
  if (!snapshot.boxes[frameId]) {
    throw new ComposeQmlExportError(`布局快照里没有场景「${frameId}」的结果`)
  }
  const context: ExportContext = {
    input,
    allocateId: createIdAllocator(),
    diagnostics: [],
    fontFamilies: [],
  }
  const root = exportEntity(context, { document, snapshot, prefix: '' }, frameId, true)
  const usesShapes = (object: QmlObject): boolean => object.type === 'Shape' || object.children.some(usesShapes)
  const imports = root && usesShapes(root) ? ['QtQuick', 'QtQuick.Shapes'] : ['QtQuick']
  return {
    qml: root ? writeQmlDocument(root, imports) : '',
    diagnostics: context.diagnostics,
    fontFamilies: context.fontFamilies,
  }
}
