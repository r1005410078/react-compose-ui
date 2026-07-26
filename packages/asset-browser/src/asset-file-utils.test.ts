import { describe, expect, it } from 'vitest'
import type { ComposeAssetEntry } from '@compose-ui/assets'
import { canvasImageMediaType } from './asset-file-utils'

function file(name: string, mediaType?: string): ComposeAssetEntry {
  return {
    id: name,
    parentId: 'root',
    name,
    kind: 'file',
    ...(mediaType ? { mediaType } : {}),
  }
}

describe('Asset canvas file filtering', () => {
  it('OpenSpec: asset-browser / 资源 Canvas 拖拽意图 / 只接受已支持的 SVG 和位图', () => {
    expect(canvasImageMediaType(file('logo.svg'))).toBe('image/svg+xml')
    expect(canvasImageMediaType(file('hero.png', 'image/png'))).toBe('image/png')
    expect(canvasImageMediaType(file('photo.tiff', 'image/tiff'))).toBeNull()
    expect(canvasImageMediaType(file('main.ts', 'text/typescript'))).toBeNull()
  })
})
