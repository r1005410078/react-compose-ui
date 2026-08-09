import { describe, expect, it } from 'vitest'
import { createComposeVirtualTextDocument } from './virtual-text'

describe('OpenSpec: asset-browser / 隐藏脚本智能层 / 虚拟文本映射', () => {
  it('按 UTF-16 offset 应用插入并正反映射可见位置', () => {
    const document = createComposeVirtualTextDocument('a😀c', [
      { offset: 0, text: '// hidden\n' },
      { offset: 3, text: '/** @type {number} */ ' },
    ])

    expect(document?.text).toBe('// hidden\na😀/** @type {number} */ c')
    expect(document?.sourceOffsetToVirtual(0)).toBe(10)
    expect(document?.sourceOffsetToVirtual(3)).toBe(35)
    expect(document?.virtualOffsetToSource(0)).toBe(0)
    expect(document?.virtualOffsetToSource(10)).toBe(0)
    expect(document?.virtualOffsetToSource(13)).toBe(3)
    expect(document?.virtualOffsetToSource(20)).toBeNull()
    expect(document?.virtualOffsetToSource(35)).toBe(3)
  })

  it('映射普通范围并拒绝触及隐藏插入的范围', () => {
    const document = createComposeVirtualTextDocument('const value = 1', [
      { offset: 6, text: '/** hidden */ ' },
    ])
    expect(document?.virtualRangeToSource(20, 5)).toEqual({ offset: 6, length: 5 })
    expect(document?.virtualRangeToSource(6, 14)).toBeNull()
    expect(document?.sourceRangeToVirtual(6, 5)).toEqual({ offset: 20, length: 5 })
    expect(document?.sourceRangeToVirtual(0, 8)).toBeNull()
  })

  it('拒绝无效插入，使调用方可以降级到普通 JavaScript', () => {
    expect(createComposeVirtualTextDocument('abc', [{ offset: -1, text: 'x' }])).toBeNull()
    expect(createComposeVirtualTextDocument('abc', [{ offset: 4, text: 'x' }])).toBeNull()
    expect(createComposeVirtualTextDocument('abc', [
      { offset: 2, text: 'x' },
      { offset: 1, text: 'y' },
    ])).toBeNull()
    expect(createComposeVirtualTextDocument('abc', [{ offset: 1.5, text: 'x' }])).toBeNull()
  })
})
