import { describe, expect, it } from 'vitest'
import {
  isProviderImageEntry,
  uniqueProviderAssetName,
} from './paint-image-library'

describe('OpenSpec: redesign-color-image-picker / Editor 图片资源自动适配', () => {
  it('只接受具有稳定引用的图片文件', () => {
    expect(isProviderImageEntry({
      id: 'image',
      parentId: 'root',
      name: 'hero.png',
      kind: 'file',
      mediaType: 'image/png',
      assetKey: 'stable-hero',
    })).toBe(true)
    expect(isProviderImageEntry({
      id: 'fallback',
      parentId: 'root',
      name: 'poster.webp',
      kind: 'file',
      assetKey: 'stable-poster',
    })).toBe(true)
    expect(isProviderImageEntry({
      id: 'script',
      parentId: 'root',
      name: 'scene.ts',
      kind: 'file',
      mediaType: 'text/typescript',
      assetKey: 'stable-script',
    })).toBe(false)
    expect(isProviderImageEntry({
      id: 'temporary',
      parentId: 'root',
      name: 'temporary.png',
      kind: 'file',
      mediaType: 'image/png',
    })).toBe(false)
  })

  it('使用最小可用数字后缀解决同目录重名', () => {
    expect(uniqueProviderAssetName('hero.png', [])).toBe('hero.png')
    expect(uniqueProviderAssetName(
      'hero.png',
      ['hero.png', 'hero-2.png', 'hero-4.png'],
    )).toBe('hero-3.png')
    expect(uniqueProviderAssetName('cover', ['cover', 'cover-2'])).toBe('cover-3')
  })
})
