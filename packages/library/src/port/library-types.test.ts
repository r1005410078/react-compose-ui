import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { COMPOSE_UI_LIBRARY_PACKAGE } from '../index'
import type { ComposeLibraryPort, ComposeLibraryQuery } from './library-types'

const packageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
) as { readonly dependencies?: Readonly<Record<string, string>> }

describe('@compose-ui/library 边界', () => {
  it('OpenSpec: page-library / 独立页面库包边界 / 库端口不依赖任何 React chrome', () => {
    expect(COMPOSE_UI_LIBRARY_PACKAGE).toBe('@compose-ui/library')
    // 依赖表是这条边界唯一可执行的形式：想引用 React chrome 必须先加一条依赖，而这里会拦下它。
    expect(Object.keys(packageJson.dependencies ?? {}).sort()).toEqual([
      '@compose-ui/assets',
      '@compose-ui/core',
    ])
  })

  it('OpenSpec: page-library / 独立页面库包边界 / 端口上没有鉴权参数', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./library-types.ts', import.meta.url)),
      'utf8',
    )
    // 鉴权属于 HTTP 适配器；端口上出现 token 会让本地实现凭空多一个它答不了的参数。
    const fields = source.match(/^\s+readonly (\w+)[?]?:/gmu) ?? []
    const names = fields.map((line) => /readonly (\w+)/u.exec(line)?.[1] ?? '')
    for (const forbidden of ['token', 'accessToken', 'userId', 'authorization', 'credentials']) {
      expect(names).not.toContain(forbidden)
    }
  })

  it('OpenSpec: page-library / 场景类型是标签，未分类是标签为空 / 只看未分类', () => {
    // 未分类在查询里是 `null` 这一档，与标签 id 同在一个数组里：它不可能与任何 id 撞车，
    // 而数组形状让将来的多选是一次加法而不是一次破坏性变更。
    const onlyUncategorized: ComposeLibraryQuery = { categories: [null] }
    const mixed: ComposeLibraryQuery = { categories: ['pcs', null] }
    expect(onlyUncategorized.categories).toEqual([null])
    expect(mixed.categories).toHaveLength(2)
  })

  it('OpenSpec: page-library / 新建与复制由端口一次完成 / 没有可单独调的自增', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./library-types.ts', import.meta.url)),
      'utf8',
    )
    const portBody = source.slice(source.indexOf('export interface ComposeLibraryPort'))
    // 只要出现一条能单独加 useCount 的方法，「哪个画法是大家在用的」这个数就能被刷。
    expect(portBody).not.toMatch(/\b(increment|bumpUse|recordUse|addUseCount)\b/u)
    expect(portBody).toContain('instantiate?')
  })

  it('端口的必选方法恰好是读的那三条', () => {
    // 写的每一条都可以缺席（只读库是合法的），读的三条不能——否则首页那一屏无从渲染。
    const readOnly: ComposeLibraryPort = {
      id: 'test',
      capabilities: {
        create: false,
        update: false,
        trash: false,
        purge: false,
        thumbnail: false,
        recents: false,
      },
      query: async () => ({
        items: [],
        nextCursor: null,
        facets: { byCategory: [], byLocation: { project: 0, template: 0, trash: 0 } },
      }),
      get: async () => {
        throw new Error('not found')
      },
      listCategories: async () => [],
    }
    expect(readOnly.instantiate).toBeUndefined()
  })
})
