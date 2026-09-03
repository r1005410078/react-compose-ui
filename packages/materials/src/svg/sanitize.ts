import DOMPurify from 'dompurify'

const forbiddenTags = [
  'script',
  'foreignObject',
  'iframe',
  'style',
  'link',
  'animate',
  'animateMotion',
  'animateTransform',
  'set',
]
const forbiddenTagNames = new Set(forbiddenTags.map((tag) => tag.toLowerCase()))
const paintableTags = new Set([
  'path',
  'rect',
  'circle',
  'ellipse',
  'polygon',
  'polyline',
  'text',
  'tspan',
  'use',
])

/**
 * 能安全落成呈现属性的 CSS 属性。
 *
 * @remarks
 * 白名单而不是黑名单：呈现属性与 CSS 属性并不是同一个集合，把不认识的名字照抄成属性，轻则
 * 无效，重则把 `filter`、`clip-path` 这类带 `url()` 的引用重新引进来。这里只收纯呈现的那一批，
 * 值里若仍带 `url()` 会被后面那一轮属性清洗按同一条规则拦下。
 */
const inlinableProperties = new Set([
  'alignment-baseline', 'baseline-shift', 'clip-rule', 'color', 'display',
  'dominant-baseline', 'fill', 'fill-opacity', 'fill-rule', 'font-family', 'font-size',
  'font-style', 'font-weight', 'letter-spacing', 'opacity', 'paint-order',
  'shape-rendering', 'stop-color', 'stop-opacity', 'stroke', 'stroke-dasharray',
  'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
  'stroke-opacity', 'stroke-width', 'text-anchor', 'text-decoration', 'vector-effect',
  'visibility', 'word-spacing',
])

/** `fill:#f00;stroke:none` → `{ fill: '#f00', stroke: 'none' }`。 */
function parseDeclarations(body: string): Readonly<Record<string, string>> {
  const declarations: Record<string, string> = {}
  body.split(';').forEach((entry) => {
    const colon = entry.indexOf(':')
    if (colon < 0) return
    const name = entry.slice(0, colon).trim().toLowerCase()
    const value = entry.slice(colon + 1).replace(/\s*!important\s*$/iu, '').trim()
    if (name !== '' && value !== '') declarations[name] = value
  })
  return declarations
}

/**
 * 选择器特异性的粗略估算。
 *
 * @remarks
 * 只需要大小关系：`#id` > `.class` / `[attr]` / `:pseudo` > 标签。精确实现要一个 CSS 解析器，
 * 而这里唯一要挡住的是「`text{fill:gray}` 写在 `.pri{fill:none}` 后面时，谁说了算」——按源码
 * 次序会让标签规则赢，那与浏览器的答案相反。
 */
function selectorSpecificity(selector: string) {
  const ids = selector.match(/#[\w-]+/gu)?.length ?? 0
  const classes = selector.match(/[.:[]/gu)?.length ?? 0
  const types = selector.match(/(^|[\s>+~])[a-z]/giu)?.length ?? 0
  return ids * 10_000 + classes * 100 + types
}

function applyDeclarations(element: Element, declarations: Readonly<Record<string, string>>) {
  for (const [name, value] of Object.entries(declarations)) {
    // CSS 压过呈现属性，因此这里是覆盖而不是「缺席才写」。
    if (inlinableProperties.has(name)) element.setAttribute(name, value)
  }
}

/**
 * 把 `<style>` 规则与内联 `style` 求值成呈现属性。
 *
 * @remarks
 * 净化会**删掉** `<style>` 与 `style` 属性（它们能藏 `url()`、`@import` 与属性选择器泄露），
 * 而 Illustrator / Figma 导出的 SVG 把全部墨色都写在 `.st0{fill:#231815}` 这类 class 里——
 * 直接删掉等于把每个图形的 `fill` 打回 SVG 的默认值**黑色**、`stroke` 打回没有，整张图于是
 * 变成一块黑色剪影。因此在删之前先把它们求值到元素自己身上：安全边界一点没放宽（属性仍要过
 * 后面那一轮 `url()` 与 `on*` 清洗），丢掉的只是「样式住在哪里」这件事。
 *
 * 匹配交给浏览器的 `matches` / `querySelectorAll`，因此后代、子、属性这些选择器都照常工作；
 * 无效选择器抛出即跳过那条规则，而不是让整份 SVG 渲染失败。
 */
function inlineStyleSheets(document: Document) {
  const root = document.documentElement
  const rules = [...root.getElementsByTagName('style')].flatMap((sheet, sheetIndex) => {
    const css = (sheet.textContent ?? '').replace(/\/\*[\s\S]*?\*\//gu, '')
    return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].flatMap((match, ruleIndex) => {
      const selectors = (match[1] ?? '').trim()
      // at-rule 的花括号会打乱这里的朴素切分，整条跳过。
      if (selectors === '' || selectors.startsWith('@')) return []
      const declarations = parseDeclarations(match[2] ?? '')
      return selectors.split(',').map((raw) => raw.trim()).filter(Boolean).map((selector) => ({
        selector,
        declarations,
        specificity: selectorSpecificity(selector),
        order: sheetIndex * 1_000 + ruleIndex,
      }))
    })
  })

  rules
    .sort((a, b) => a.specificity - b.specificity || a.order - b.order)
    .forEach(({ selector, declarations }) => {
      try {
        if (root.matches(selector)) applyDeclarations(root, declarations)
        root.querySelectorAll(selector).forEach((element) => {
          applyDeclarations(element, declarations)
        })
      } catch {
        // 选择器不合法：跳过这一条，其余规则照常求值。
      }
    })

  // 内联 `style` 压过任何选择器，因此最后一步走。
  ;[root, ...root.querySelectorAll('*')].forEach((element) => {
    const inline = element.getAttribute('style')
    if (inline) applyDeclarations(element, parseDeclarations(inline))
  })
}

function safeFragmentValue(value: string) {
  const normalized = value.trim()
  if (normalized.startsWith('#')) return true
  const matches = [...normalized.matchAll(/url\(([^)]+)\)/giu)]
  return matches.length > 0 && matches.every((match) => (
    match[1]?.trim().replace(/^['"]|['"]$/gu, '').startsWith('#')
  ))
}

/** 净化并应用确定性的 SVG paint 覆盖。 @internal */
export function sanitizeSvg(
  source: string,
  options: {
    readonly overrideFill: boolean
    readonly fillColor: string
    readonly overrideStroke: boolean
    readonly strokeColor: string
  },
) {
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml')
  // 必须先于删除 `<style>`：删掉之后墨色就无处可取了。
  inlineStyleSheets(parsed)
  parsed.querySelectorAll('*').forEach((element) => {
    if (forbiddenTagNames.has(element.tagName.toLowerCase())) element.remove()
  })
  const clean = DOMPurify.sanitize(parsed.documentElement.outerHTML, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: forbiddenTags,
    FORBID_ATTR: ['style'],
  })
  const document = new DOMParser().parseFromString(clean, 'image/svg+xml')
  const root = document.documentElement
  root.querySelectorAll('*').forEach((element) => {
    if (forbiddenTagNames.has(element.tagName.toLowerCase())) element.remove()
  })
  const elements = [root, ...root.querySelectorAll('*')]
  elements.forEach((element) => {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value
      if (
        name.startsWith('on')
        || name === 'style'
        || ((name === 'href' || name === 'xlink:href') && !safeFragmentValue(value))
        || (/url\(/iu.test(value) && !safeFragmentValue(value))
      ) {
        element.removeAttribute(attribute.name)
      }
    }
    if (!paintableTags.has(element.tagName.toLowerCase())) return
    const fill = element.getAttribute('fill')
    if (options.overrideFill && fill?.trim().toLowerCase() !== 'none') {
      element.setAttribute('fill', options.fillColor)
    }
    const stroke = element.getAttribute('stroke')
    if (
      options.overrideStroke
      && stroke !== null
      && stroke.trim().toLowerCase() !== 'none'
    ) {
      element.setAttribute('stroke', options.strokeColor)
    }
  })
  root.setAttribute('width', '100%')
  root.setAttribute('height', '100%')
  return root.outerHTML
}
