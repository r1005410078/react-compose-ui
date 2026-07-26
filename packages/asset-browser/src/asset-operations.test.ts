import { describe, expect, it } from 'vitest'
import { ComposeAssetError } from '@compose-ui/assets'
import {
  executeAssetBatch,
  normalizeComposeAssetError,
  validateAssetName,
} from '@compose-ui/assets'

describe('asset operations', () => {
  it('OpenSpec: asset-browser / Provider 能力与错误 / 规范化 Provider 错误', () => {
    expect(normalizeComposeAssetError(new DOMException('Denied', 'NotAllowedError')).code)
      .toBe('permission-denied')
    expect(normalizeComposeAssetError(new Error('disk')).code).toBe('io')
    const conflict = new ComposeAssetError('conflict', 'changed')
    expect(normalizeComposeAssetError(conflict)).toBe(conflict)
  })

  it('OpenSpec: asset-browser / 资源写操作与部分成功 / 保留逐项结果', async () => {
    const result = await executeAssetBatch([1, 2, 3], async (item) => {
      if (item === 2) throw new ComposeAssetError('conflict', 'exists')
    })
    expect(result).toMatchObject({ succeeded: 2, failed: 1 })
    expect(result.results.map((item) => item.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
    ])
  })

  it('OpenSpec: asset-browser / 资源写操作与部分成功 / 拒绝路径和空名称', () => {
    expect(validateAssetName(' image.png ')).toBe('image.png')
    expect(() => validateAssetName('../image.png')).toThrowError(ComposeAssetError)
    expect(() => validateAssetName(' ')).toThrowError(ComposeAssetError)
  })
})
