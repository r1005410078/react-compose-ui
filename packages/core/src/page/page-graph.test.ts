import { describe, expect, it } from 'vitest'
import { readComposePageReference } from './page-graph'

const reference = {
  kind: 'page',
  providerId: 'demo',
  assetKey: 'Pages/Home.page.json',
  scope: 'persistent',
} as const

describe('OpenSpec: compose-document / 页面引用值', () => {
  it('读取完整页面引用', () => {
    expect(readComposePageReference(reference)).toEqual(reference)
  })

  it('拒绝空值、非对象与字段不完整的值', () => {
    expect(readComposePageReference(null)).toBeNull()
    expect(readComposePageReference('Pages/Home.page.json')).toBeNull()
    expect(readComposePageReference({ ...reference, kind: 'asset' })).toBeNull()
    expect(readComposePageReference({ ...reference, assetKey: '' })).toBeNull()
    expect(readComposePageReference({ ...reference, scope: 'temporary' })).toBeNull()
    expect(readComposePageReference({
      kind: 'page',
      assetKey: reference.assetKey,
      scope: reference.scope,
    })).toBeNull()
  })

  it('只保留协议字段，丢弃多余属性', () => {
    expect(readComposePageReference({ ...reference, stale: 'x' })).toEqual(reference)
  })
})
