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
