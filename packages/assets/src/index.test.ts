import { describe, expect, it, vi } from 'vitest'
import {
  ComposeAssetError,
  createComposeAssetResolver,
  type ComposeAssetProvider,
} from './index'

function provider(
  onSubscribe?: (emit: () => void) => void,
): ComposeAssetProvider {
  const listeners = new Set<() => void>()
  return {
    id: 'library',
    label: 'Library',
    referenceScope: 'persistent',
    root: { id: 'root', parentId: null, name: 'Assets', kind: 'folder' },
    capabilities: {
      createFile: false,
      createFolder: false,
      rename: false,
      move: false,
      delete: false,
      write: false,
      reference: true,
    },
    list: async () => [],
    read: async () => ({ blob: new Blob(), revision: 'tree' }),
    resolveAsset: async ({ assetKey }) => ({
      blob: new Blob([assetKey], { type: 'image/png' }),
      revision: '2',
      mediaType: 'image/png',
    }),
    subscribe(listener) {
      listeners.add(listener)
      onSubscribe?.(() => {
        for (const current of listeners) current()
      })
      return () => listeners.delete(listener)
    },
  }
}

describe('@compose-ui/assets', () => {
  it('OpenSpec: assets / 稳定资源引用与解析 / 解析稳定引用', async () => {
    let emit: () => void = () => undefined
    const source = provider((listener) => {
      emit = listener
    })
    const resolver = createComposeAssetResolver(source)
    const reference = {
      providerId: source.id,
      assetKey: 'immutable-key',
      scope: 'persistent' as const,
    }
    const resolved = await resolver.resolve({ reference })
    expect(await resolved.blob.text()).toBe('immutable-key')
    expect(resolved).toMatchObject({ revision: '2', mediaType: 'image/png' })

    const listener = vi.fn()
    const unsubscribe = resolver.subscribe?.(reference, listener)
    emit()
    expect(listener).toHaveBeenCalledOnce()
    unsubscribe?.()
    emit()
    expect(listener).toHaveBeenCalledOnce()
    expect(unsubscribe).toBeTypeOf('function')
  })

  it('OpenSpec: assets / 稳定资源引用与解析 / 缺失或会话引用', async () => {
    const resolver = createComposeAssetResolver(provider())
    await expect(resolver.resolve({
      reference: {
        providerId: 'another-provider',
        assetKey: 'hero',
        scope: 'session',
      },
    })).rejects.toMatchObject({
      code: 'not-found',
    })
  })

  it('OpenSpec: assets / Provider 引用能力 / 禁用不可引用资源', () => {
    const source = provider()
    expect(() => createComposeAssetResolver({
      ...source,
      capabilities: { ...source.capabilities, reference: false },
    })).toThrow(ComposeAssetError)
  })

  it('OpenSpec: assets / 可选的直接资源 URL / 缺席时退回 Blob', () => {
    // Provider 给不出 URL 时，resolver 上这个方法整个不存在——消费方一个 in 判断就分流完。
    const resolver = createComposeAssetResolver(provider())
    expect(resolver.resolveUrl).toBeUndefined()
  })

  it('OpenSpec: assets / 可选的直接资源 URL / URL 过期前重取', async () => {
    const source: ComposeAssetProvider = {
      ...provider(),
      capabilities: { ...provider().capabilities, directUrl: true },
      resolveUrl: async ({ assetKey }) => ({
        url: `https://cdn.example.com/${assetKey}?sig=1`,
        revision: '2',
        mediaType: 'image/png',
        expiresAt: 1_700_000_000_000,
      }),
    }
    const resolver = createComposeAssetResolver(source)
    const reference = {
      providerId: 'library',
      assetKey: 'symbol-1',
      scope: 'persistent',
    } as const
    const resolved = await resolver.resolveUrl?.({ reference })
    // 失效时刻必须交出来：不带它，消费方无从知道该什么时候重取，症状是图集体变成裂图。
    expect(resolved?.expiresAt).toBe(1_700_000_000_000)
    expect(resolved?.url).toContain('symbol-1')
  })

  it('OpenSpec: assets / 可选的直接资源 URL / 别的 Provider 的引用解析不到', async () => {
    const source: ComposeAssetProvider = {
      ...provider(),
      resolveUrl: async () => ({ url: 'https://x', revision: '1', mediaType: 'image/png' }),
    }
    const resolver = createComposeAssetResolver(source)
    await expect(resolver.resolveUrl?.({
      reference: { providerId: 'other', assetKey: 'a', scope: 'persistent' },
    })).rejects.toBeInstanceOf(ComposeAssetError)
  })
})
