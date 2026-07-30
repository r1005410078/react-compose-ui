import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { composeNodePropertySchema } from './node'

const schema = composeNodePropertySchema()

const reference = {
  kind: 'page',
  providerId: 'demo',
  assetKey: 'Pages/Home.page.json',
  scope: 'persistent',
} as const

describe('OpenSpec: basic-materials / 节点引用属性 Schema 工厂', () => {
  it('空值与完整页面引用都通过校验', () => {
    expect(v.safeParse(schema, null).success).toBe(true)
    expect(v.safeParse(schema, reference).success).toBe(true)
  })

  it('字段缺失或类型错误的引用不通过校验', () => {
    expect(v.safeParse(schema, {
      kind: 'page',
      assetKey: reference.assetKey,
      scope: reference.scope,
    }).success).toBe(false)
    expect(v.safeParse(schema, { ...reference, kind: 'asset' }).success).toBe(false)
    expect(v.safeParse(schema, { ...reference, assetKey: '' }).success).toBe(false)
    expect(v.safeParse(schema, { ...reference, scope: 'temporary' }).success).toBe(false)
    expect(v.safeParse(schema, 'Pages/Home.page.json').success).toBe(false)
  })

  it('声明使用 node 基础 editor 并可覆盖显示名', () => {
    expect(v.getMetadata(schema)).toMatchObject({ propertyPanel: { editor: 'node' } })
    expect(v.getTitle(composeNodePropertySchema({ title: '内容页' }))).toBe('内容页')
  })
})
