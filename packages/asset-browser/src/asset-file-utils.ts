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

export function isImageAsset(entry: ComposeAssetEntry) {
  return entry.mediaType?.startsWith('image/') === true || imageExtensions.has(extensionOf(entry.name))
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
