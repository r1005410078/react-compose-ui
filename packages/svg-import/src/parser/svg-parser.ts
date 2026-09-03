import { XMLParser } from 'fast-xml-parser'
import type { createSvgDiagnosticCollector } from './svg-diagnostics'

/**
 * 归一化之后的 SVG 元素。
 *
 * @remarks
 * 与 `fast-xml-parser` 的 `preserveOrder` 结构解耦：那份结构把属性挂在 `':@'` 上、把文本混在
 * 子节点数组里，让映射层直接读它等于把一个第三方库的形状变成本包的公共协议。
 *
 * **子节点保持文档顺序**：SVG 的绘制顺序就是文档顺序，重排会让后画的图形跑到前面去。
 *
 * @public
 */
export interface SvgNode {
  /** 已去掉命名空间前缀的小写标签名。 */
  readonly tag: string
  /** 属性名已去掉命名空间前缀；值原样保留。 */
  readonly attributes: Readonly<Record<string, string>>
  readonly children: readonly SvgNode[]
  /** 直接文本内容（不含后代元素的文本）。 */
  readonly text: string
}

/**
 * 不进文档的元素。
 *
 * @remarks
 * 它们**不是几何**：`script` 与 `foreignObject` 是可执行内容，SMIL 动画是另一套时间模型，
 * `metadata` / `title` / `desc` 是说明文字。丢弃它们不会让用户看到的图形少一块，因此这是本
 * 包唯一一处「整个元素不进文档」的地方——其余不能表达的东西一律**降级属性、保留几何**。
 */
const DROPPED = new Set([
  'script', 'foreignobject', 'animate', 'animatemotion', 'animatetransform', 'set',
  'metadata', 'title', 'desc',
])

/** 可执行内容的属性：事件处理器一律以 `on` 开头。 */
function isEventAttribute(name: string) {
  return name.startsWith('on')
}

/** 去掉命名空间前缀：`svg:path` 与 `path` 是同一个元素，`xlink:href` 与 `href` 同理。 */
function stripNamespace(name: string) {
  const colon = name.lastIndexOf(':')
  return (colon < 0 ? name : name.slice(colon + 1)).toLowerCase()
}

interface RawNode {
  readonly [key: string]: unknown
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  preserveOrder: true,
  trimValues: false,
  // 属性值里的实体（`&amp;` 等）要还原，否则一个带 `&` 的 URL 会被原样当作字面量。
  processEntities: true,
})

type Diagnostics = ReturnType<typeof createSvgDiagnosticCollector>

/**
 * 把一段 SVG 文本解析成元素树。
 *
 * @remarks
 * 本层认识的是 XML 的结构，与产出什么文档无关。它只做两件与 SVG 有关的事：去掉命名空间前缀，
 * 以及**丢弃可执行内容**——后者必须在这一层做，让它流进后面的层意味着某一层忘了它就会漏出去。
 *
 * @param source - SVG 文本。
 * @param diagnostics - 诊断收集器；被丢弃的东西都记在这里，静默丢弃不可接受。
 * @returns 根 `<svg>` 元素；文本里没有 `<svg>` 时返回 `null`。
 * @public
 */
export function parseSvg(source: string, diagnostics: Diagnostics): SvgNode | null {
  const roots = parser.parse(source) as readonly RawNode[]
  const nodes = roots.flatMap((raw) => toNodes(raw, diagnostics))
  return nodes.find((node) => node.tag === 'svg') ?? null
}

function toNodes(raw: RawNode, diagnostics: Diagnostics): readonly SvgNode[] {
  const entries = Object.entries(raw).filter(([key]) => key !== ':@')
  return entries.flatMap(([key, value]) => {
    if (key === '#text') return []
    const tag = stripNamespace(key)
    if (DROPPED.has(tag)) {
      diagnostics.add(
        tag === 'script' || tag === 'foreignobject' ? 'svg.executable-content' : 'svg.unsupported-element',
        tag,
      )
      return []
    }
    const children = Array.isArray(value) ? value as readonly RawNode[] : []
    return [{
      tag,
      attributes: toAttributes(raw[':@'], diagnostics),
      children: children.flatMap((child) => toNodes(child, diagnostics)),
      text: children
        .map((child) => (typeof child['#text'] === 'string' ? child['#text'] : ''))
        .join(''),
    }]
  })
}

function toAttributes(
  raw: unknown,
  diagnostics: Diagnostics,
): Readonly<Record<string, string>> {
  if (typeof raw !== 'object' || raw === null) return {}
  const attributes: Record<string, string> = {}
  Object.entries(raw as Record<string, unknown>).forEach(([name, value]) => {
    const key = stripNamespace(name)
    if (isEventAttribute(key)) {
      diagnostics.add('svg.executable-content', key)
      return
    }
    // 数字与布尔在这一层还原成字符串：SVG 的属性本来就都是字符串，解析器的类型推断只会让
    // 下游每读一个属性都要先判一次类型。
    attributes[key] = String(value)
  })
  return attributes
}
