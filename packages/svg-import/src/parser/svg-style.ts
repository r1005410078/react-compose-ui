import type { SvgNode } from './svg-parser'
import type { createSvgDiagnosticCollector } from './svg-diagnostics'

type Diagnostics = ReturnType<typeof createSvgDiagnosticCollector>

/**
 * 参与求值的呈现属性。
 *
 * @remarks
 * 只列本包用得上的那些：多列一个就要多想一次「它在文档里落到哪」，而没有落点的属性求值出来
 * 也没人读。
 */
const PRESENTATION = [
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-dasharray',
  'opacity', 'display', 'visibility', 'color',
  'font-size', 'font-family', 'font-weight', 'text-anchor',
] as const

/** 会被子级继承的那些；`opacity` 与 `display` 不继承，这是 CSS 的规定而不是简化。 */
const INHERITED = new Set([
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-dasharray',
  'visibility', 'color',
  'font-size', 'font-family', 'font-weight', 'text-anchor',
])

/** 一个元素求值之后的样式：属性名到值，全部已经是这个元素自己的值。 @public */
export type SvgComputedStyle = Readonly<Record<string, string>>

/** `<style>` 里的一条规则。 */
interface StyleRule {
  /** 选择器种类与它要匹配的名字。 */
  readonly kind: 'tag' | 'class' | 'id'
  readonly name: string
  readonly declarations: Readonly<Record<string, string>>
  /** 同优先级时后写的赢；CSS 的层叠顺序。 */
  readonly order: number
}

/**
 * 选择器的优先级。
 *
 * @remarks
 * 取 CSS 的特异性次序（id > class > tag），数值本身不重要，只有大小关系被用到。
 */
const SPECIFICITY = { tag: 1, class: 10, id: 100 } as const

/**
 * 解析 `<style>` 的内容。
 *
 * @remarks
 * 只支持 `tag`、`.class`、`#id` 与它们的逗号组——Illustrator 与 Figma 导出的就是
 * `.st0{fill:#231815}` 这一档。其余选择器**跳过并诊断**，MUST NOT 猜：猜错的样式会安静地
 * 画在图上，而用户没有任何办法看出这条规则本该是什么。
 *
 * 注释与 at-rule（`@media` 等）一并跳过：它们的花括号会打乱这里的朴素切分，而支持它们意味着
 * 要写一个真正的 CSS 解析器。
 *
 * @public
 */
export function parseSvgStyleRules(
  css: string,
  diagnostics: Diagnostics,
): readonly StyleRule[] {
  const rules: StyleRule[] = []
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  let order = 0
  for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (match[1] ?? '').trim()
    const body = match[2] ?? ''
    if (selectors.startsWith('@')) {
      diagnostics.add('svg.unsupported-selector', selectors.split(/\s/)[0] ?? '@')
      continue
    }
    const declarations = parseDeclarations(body)
    selectors.split(',').forEach((raw) => {
      const selector = raw.trim()
      if (selector === '') return
      order += 1
      if (/^\.[A-Za-z_][\w-]*$/.test(selector)) {
        rules.push({ kind: 'class', name: selector.slice(1), declarations, order })
        return
      }
      if (/^#[A-Za-z_][\w-]*$/.test(selector)) {
        rules.push({ kind: 'id', name: selector.slice(1), declarations, order })
        return
      }
      if (/^[A-Za-z][\w-]*$/.test(selector)) {
        rules.push({ kind: 'tag', name: selector.toLowerCase(), declarations, order })
        return
      }
      diagnostics.add('svg.unsupported-selector', selector)
    })
  }
  return rules
}

/** `fill:#f00;stroke:none` → `{ fill: '#f00', stroke: 'none' }`。 */
function parseDeclarations(body: string): Readonly<Record<string, string>> {
  const declarations: Record<string, string> = {}
  body.split(';').forEach((entry) => {
    const colon = entry.indexOf(':')
    if (colon < 0) return
    const name = entry.slice(0, colon).trim().toLowerCase()
    const value = entry.slice(colon + 1).trim()
    if (name !== '' && value !== '') declarations[name] = value
  })
  return declarations
}

/**
 * 收集整棵树里所有 `<style>` 的规则。
 *
 * @remarks
 * `<style>` 可以出现在任何地方（不只是 `<defs>` 里），而 CSS 是全文档作用域的，因此这一步
 * 必须先于任何求值走完整棵树。
 *
 * @public
 */
export function collectSvgStyleRules(
  root: SvgNode,
  diagnostics: Diagnostics,
): readonly StyleRule[] {
  const rules: StyleRule[] = []
  const walk = (node: SvgNode) => {
    if (node.tag === 'style') rules.push(...parseSvgStyleRules(node.text, diagnostics))
    node.children.forEach(walk)
  }
  walk(root)
  return rules
}

/**
 * 求出一个元素自己的样式。
 *
 * @remarks
 * 四处来源按 CSS 的层叠顺序合并：**继承 < 呈现属性 < `<style>` 规则 < 内联 `style`**。
 * 呈现属性的优先级低于任何 CSS 规则，这是 CSS 的规定而不是本包的选择——写反的症状是
 * `<path class="st0" fill="red">` 画成红色，而浏览器里它是 `.st0` 那个颜色。
 *
 * 求值之后文档里**不留任何继承关系**：改一个部件的颜色不该先问它继承自谁。这与 DXF 的
 * byLayer 颜色在导入期求值进描边是同一条判断。
 *
 * @param inherited - 父级求值后的样式；根元素传空对象。
 * @public
 */
export function computeSvgStyle(
  node: SvgNode,
  inherited: SvgComputedStyle,
  rules: readonly StyleRule[],
): SvgComputedStyle {
  const computed: Record<string, string> = {}
  // 继承打底：只有可继承的那些跟下来。
  Object.entries(inherited).forEach(([name, value]) => {
    if (INHERITED.has(name)) computed[name] = value
  })
  PRESENTATION.forEach((name) => {
    const value = node.attributes[name]
    if (value !== undefined && value !== '') computed[name] = value
  })
  matchingRules(node, rules).forEach((rule) => {
    Object.entries(rule.declarations).forEach(([name, value]) => {
      computed[name] = value
    })
  })
  Object.entries(parseDeclarations(node.attributes.style ?? '')).forEach(([name, value]) => {
    computed[name] = value
  })
  // `currentColor` 指向同一个元素上求值出来的 `color`；解析掉它之后下游不需要认识这个关键字。
  const currentColor = computed.color
  if (currentColor) {
    Object.entries(computed).forEach(([name, value]) => {
      if (value.trim().toLowerCase() === 'currentcolor') computed[name] = currentColor
    })
  }
  return computed
}

/** 命中这个元素的规则，按「特异性，其次文档顺序」排序——后应用的赢。 */
function matchingRules(node: SvgNode, rules: readonly StyleRule[]): readonly StyleRule[] {
  const classes = new Set((node.attributes.class ?? '').split(/\s+/).filter(Boolean))
  const id = node.attributes.id
  return rules
    .filter((rule) => (
      rule.kind === 'tag'
        ? rule.name === node.tag
        : rule.kind === 'class'
          ? classes.has(rule.name)
          : rule.name === id
    ))
    .sort((a, b) => (
      SPECIFICITY[a.kind] - SPECIFICITY[b.kind] || a.order - b.order
    ))
}
