import { describe, expect, it } from 'vitest'
import {
  COMPOSE_PAGE_NEST_DEPTH_LIMIT,
  readComposePageReference,
  resolveComposePageNestState,
} from './page-graph'

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

describe('OpenSpec: compose-document / 页面嵌套护栏', () => {
  it('检出自环与间接环', () => {
    expect(resolveComposePageNestState({
      pageKey: 'a',
      ancestorPageKeys: ['a'],
    })).toBe('cycle')
    expect(resolveComposePageNestState({
      pageKey: 'a',
      ancestorPageKeys: ['a', 'b', 'c'],
    })).toBe('cycle')
  })

  it('循环检测优先于深度检测', () => {
    // 祖先链已超限且含目标页面时必须报 cycle，否则调用方会以为只是层数太多。
    const ancestors = Array.from({ length: COMPOSE_PAGE_NEST_DEPTH_LIMIT + 2 }, (_, i) => `p${i}`)
    expect(resolveComposePageNestState({
      pageKey: 'p0',
      ancestorPageKeys: ancestors,
    })).toBe('cycle')
  })

  it('在深度上限边界上正确切换', () => {
    const chain = (length: number) => Array.from({ length }, (_, i) => `p${i}`)
    expect(resolveComposePageNestState({
      pageKey: 'leaf',
      ancestorPageKeys: chain(COMPOSE_PAGE_NEST_DEPTH_LIMIT - 1),
    })).toBe('ok')
    expect(resolveComposePageNestState({
      pageKey: 'leaf',
      ancestorPageKeys: chain(COMPOSE_PAGE_NEST_DEPTH_LIMIT),
    })).toBe('depth-exceeded')
    expect(resolveComposePageNestState({
      pageKey: 'leaf',
      ancestorPageKeys: chain(COMPOSE_PAGE_NEST_DEPTH_LIMIT + 1),
    })).toBe('depth-exceeded')
  })

  it('根页面下的第一层嵌套为 ok', () => {
    expect(resolveComposePageNestState({ pageKey: 'a', ancestorPageKeys: [] })).toBe('ok')
  })

  it('允许调用方收紧深度上限', () => {
    expect(resolveComposePageNestState({
      pageKey: 'leaf',
      ancestorPageKeys: ['a'],
      depthLimit: 1,
    })).toBe('depth-exceeded')
  })
})
