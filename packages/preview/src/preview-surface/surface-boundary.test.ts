import { describe, expect, it } from 'vitest'
import * as publicEntry from '../index'

describe('预览 Surface 的边界', () => {
  /**
   * @remarks
   * 判别性：把 `ComposePreviewSurface` 或 `useComposePreviewSurface` 加进 `src/index.tsx`
   * 这条用例即红。它挡的不是「多导出一个名字」，而是**第三方 chrome 绕开这一层自己画内容**
   * ——那一刻「两个预览一样」就从构造上成立退化成一句承诺。
   */
  it('OpenSpec: compose-preview / 两个预览形态共用同一层实现 / 共同实现不出现在公共入口', () => {
    const exported = Object.keys(publicEntry)
    expect(exported).not.toContain('ComposePreviewSurface')
    expect(exported).not.toContain('useComposePreviewSurface')
    expect(exported.filter((name) => name.includes('Surface'))).toEqual([])
  })
})
