import { describe, expect, it } from 'vitest'
import type { ComposeAssetEntry } from '@compose-ui/assets'
import { canvasImageMediaType, isImageAsset } from './asset-file-utils'

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

describe('OpenSpec: asset-browser / 预览只认浏览器画得出来的图片', () => {
  /*
   * CAD 的注册媒体类型正好落在 `image/` 下（`image/vnd.dwg` / `image/vnd.dxf`），而浏览器
   * 一个都解不了。按前缀判断会让预览走进 `<img>` 分支、给用户一个**空白框**——它比
   * 「暂不支持预览」那条兜底糟得多：空白框没有任何东西解释发生了什么，用户读到的是
   * 「这个文件坏了」。
   */
  it('CAD 文件不算图片', () => {
    expect(isImageAsset({ name: 'Feeder.dwg', mediaType: 'image/vnd.dwg' } as never)).toBe(false)
    expect(isImageAsset({ name: 'Topology.dxf', mediaType: 'image/vnd.dxf' } as never)).toBe(false)
  })

  it('浏览器画得出来的仍然算', () => {
    expect(isImageAsset({ name: 'a.png', mediaType: 'image/png' } as never)).toBe(true)
    expect(isImageAsset({ name: 'a.svg', mediaType: 'image/svg+xml' } as never)).toBe(true)
    // 没有媒体类型时按扩展名，那份清单本来就是白名单。
    expect(isImageAsset({ name: 'a.webp' } as never)).toBe(true)
    expect(isImageAsset({ name: 'a.dwg' } as never)).toBe(false)
  })
})
