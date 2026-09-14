import { describe, expect, it } from 'vitest'
import { composeComponentFileName, isComposeComponentFileName } from '@compose-ui/core'
import { uniqueComposeAssetFileName, uniqueProviderAssetName } from './asset-naming'

describe('OpenSpec: dxf-import / 资源浏览器上的导入为页面', () => {
  it('复合后缀去重之后仍然是组件文件', () => {
    const taken = new Set(['A3.component.json'])
    const next = uniqueComposeAssetFileName(composeComponentFileName, 'A3', taken)
    expect(next).toBe('A3-2.component.json')
    // `.component.json` 是组件文件的识别依据；按最后一个点切会得到 `A3.component-2.json`，
    // 那个文件不再是组件。
    expect(isComposeComponentFileName(next)).toBe(true)
    expect(uniqueComposeAssetFileName(composeComponentFileName, 'A3', taken))
      .toBe('A3-3.component.json')
  })

  it('单后缀的普通上传仍走原来那条', () => {
    expect(uniqueProviderAssetName('hero.png', ['hero.png'])).toBe('hero-2.png')
  })
})
