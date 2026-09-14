import type { ComposeAssetEntry } from '@compose-ui/assets'

const imageExtensions = new Set(['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp', 'ico'])
const canvasImageMediaTypes = new Set([
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/bmp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
])
const scriptExtensions = new Set(['js', 'jsx', 'ts', 'tsx', 'json', 'css', 'scss', 'html', 'md'])

export function extensionOf(name: string) {
  const position = name.lastIndexOf('.')
  return position < 0 ? '' : name.slice(position + 1).toLowerCase()
}

/**
 * 这个条目能不能**被浏览器当作图片画出来**。
 *
 * @remarks
 * 判据是白名单而不是 `image/` 前缀：CAD 的注册媒体类型正好落在这个前缀下
 * （`image/vnd.dwg`、`image/vnd.dxf`），而浏览器一个都解不了。按前缀判断会让预览走进
 * `<img>` 分支并给出一个**空白框**，比下面那条「暂不支持预览」的兜底糟得多——空白框没有
 * 任何东西解释发生了什么，用户读到的是「这个文件坏了」。
 *
 * 缺少媒体类型时按扩展名，那份清单本来就是白名单。
 */
export function isImageAsset(entry: ComposeAssetEntry) {
  if (entry.mediaType) return canvasImageMediaTypes.has(entry.mediaType.toLowerCase())
  return imageExtensions.has(extensionOf(entry.name))
}

export function canvasImageMediaType(entry: ComposeAssetEntry) {
  if (!isImageAsset(entry)) return null
  if (entry.mediaType) {
    return canvasImageMediaTypes.has(entry.mediaType.toLowerCase())
      ? entry.mediaType
      : null
  }
  const extension = extensionOf(entry.name)
  const types: Readonly<Record<string, string>> = {
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
  }
  return types[extension] ?? null
}

export function isScriptAsset(entry: ComposeAssetEntry) {
  return scriptExtensions.has(extensionOf(entry.name))
}

export function formatAssetSize(size: number | undefined, locale: string) {
  if (size === undefined) return '—'
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: size >= 1024 * 1024 ? 'megabyte' : size >= 1024 ? 'kilobyte' : 'byte',
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(size >= 1024 * 1024 ? size / (1024 * 1024) : size >= 1024 ? size / 1024 : size)
}
