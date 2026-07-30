import { describe, expect, it } from 'vitest'
import {
  createEmptyComposeAppManifest,
  parseComposeAppManifest,
  serializeComposeAppManifest,
  setComposeAppManifestHomePage,
} from './page-manifest'

describe('OpenSpec: compose-document / 应用清单与首页指向', () => {
  it('清单缺失或为空时降级为无首页且不报 issue', () => {
    expect(parseComposeAppManifest(undefined)).toEqual({
      manifest: { schemaVersion: 1, homePageKey: null },
      unknownFields: {},
      issues: [],
    })
    expect(parseComposeAppManifest('   ').issues).toEqual([])
  })

  it('解析完整清单', () => {
    const result = parseComposeAppManifest('{"schemaVersion":1,"homePageKey":"Pages/Home.page.json"}')
    expect(result.manifest.homePageKey).toBe('Pages/Home.page.json')
    expect(result.issues).toEqual([])
  })

  it('非法 JSON 降级为无首页并报 invalid-json', () => {
    const result = parseComposeAppManifest('{ not json')
    expect(result.manifest.homePageKey).toBeNull()
    expect(result.issues.map((issue) => issue.code)).toEqual(['invalid-json'])
  })

  it('结构不符降级为无首页并报 invalid-shape', () => {
    expect(parseComposeAppManifest('[]').issues.map((i) => i.code)).toEqual(['invalid-shape'])
    expect(parseComposeAppManifest('{"schemaVersion":1,"homePageKey":7}').issues
      .map((i) => i.code)).toEqual(['invalid-shape'])
  })

  it('版本不受支持降级为无首页并报 unsupported-version', () => {
    const result = parseComposeAppManifest('{"schemaVersion":2,"homePageKey":"a"}')
    expect(result.manifest.homePageKey).toBeNull()
    expect(result.issues.map((issue) => issue.code)).toEqual(['unsupported-version'])
  })

  it('保留未知顶层字段并在设首页时写回', () => {
    const source = '{"schemaVersion":1,"homePageKey":null,"theme":"dark","locales":["zh"]}'
    const parsed = parseComposeAppManifest(source)
    expect(parsed.unknownFields).toEqual({ theme: 'dark', locales: ['zh'] })
    const next = setComposeAppManifestHomePage(parsed.manifest, 'Pages/Home.page.json')
    const written = parseComposeAppManifest(serializeComposeAppManifest(next, parsed.unknownFields))
    expect(written.manifest.homePageKey).toBe('Pages/Home.page.json')
    expect(written.unknownFields).toEqual({ theme: 'dark', locales: ['zh'] })
  })

  it('版本不受支持时仍保留未知字段，避免写回时丢数据', () => {
    const parsed = parseComposeAppManifest('{"schemaVersion":2,"theme":"dark"}')
    expect(parsed.unknownFields).toEqual({ theme: 'dark' })
  })

  it('设首页幂等，未变化时返回原清单引用', () => {
    const manifest = setComposeAppManifestHomePage(createEmptyComposeAppManifest(), 'a')
    expect(setComposeAppManifestHomePage(manifest, 'a')).toBe(manifest)
    expect(setComposeAppManifestHomePage(manifest, null).homePageKey).toBeNull()
    // 空字符串与 null 等价，避免出现指向空 key 的首页。
    expect(setComposeAppManifestHomePage(manifest, '').homePageKey).toBeNull()
  })

  it('协议字段不会被未知字段覆盖', () => {
    const text = serializeComposeAppManifest(
      { schemaVersion: 1, homePageKey: 'real' },
      { homePageKey: 'spoofed' } as never,
    )
    expect(parseComposeAppManifest(text).manifest.homePageKey).toBe('real')
  })
})
