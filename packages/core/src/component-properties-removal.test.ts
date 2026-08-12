import { describe, expect, it } from 'vitest'
import {
  migrateLegacyComposeComponentAsset,
  migrateLegacyComposeInstanceOverrides,
  parseComposeComponentAsset,
  parseComposeInstanceOverrides,
  serializeComposeComponentAsset,
} from './index'
import type { ComposeBaseComponentAsset } from './index'
import { createComposeGroupEntitySeed } from './group'
import { documentFixture } from './test-fixtures'

function baseAsset(): ComposeBaseComponentAsset {
  return {
    schemaVersion: 1,
    kind: 'base',
    componentId: 'card',
    name: 'Card',
    document: documentFixture(
      { root: createComposeGroupEntitySeed({ id: 'root', name: 'Group' }) },
      ['root'],
    ),
  }
}

describe('删除暴露属性', () => {
  it('Base 不再携带 properties 字段', () => {
    const serialized = serializeComposeComponentAsset(baseAsset())
    expect(JSON.parse(serialized)).not.toHaveProperty('properties')
    const parsed = parseComposeComponentAsset(serialized)
    expect(parsed.ok).toBe(true)
  })

  it('含 properties 的旧 Base 被判为 legacy 而不是静默接受', () => {
    const legacy = { ...baseAsset(), properties: [] }
    const parsed = parseComposeComponentAsset(JSON.stringify(legacy))
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.issues.some(({ code }) => code === 'component-asset.legacy')).toBe(true)
  })

  it('显式迁移删除 properties 且不改变文档内容', () => {
    const legacy = {
      ...baseAsset(),
      properties: [{
        id: 'label',
        name: 'Label',
        valueType: 'string',
        target: { entityId: 'root', componentKey: 'Renderer', fieldPath: ['props', 'text'] },
      }],
    }
    const migrated = migrateLegacyComposeComponentAsset(legacy)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    expect(migrated.asset).not.toHaveProperty('properties')
    expect(migrated.asset.kind === 'base' && migrated.asset.document).toEqual(baseAsset().document)
  })

  it('实例覆盖只保留 operations 分区', () => {
    const parsed = parseComposeInstanceOverrides({ operations: [] })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.overrides).not.toHaveProperty('properties')
  })

  it('旧属性分区迁移为指向同一 target 的 set-field 操作', () => {
    const migrated = migrateLegacyComposeInstanceOverrides(
      { properties: { label: 'Danger' }, operations: [] },
      [{
        id: 'label',
        name: 'Label',
        valueType: 'string',
        target: { entityId: 'text', componentKey: 'Renderer', fieldPath: ['props', 'text'] },
      }],
    )
    expect(migrated.operations).toHaveLength(1)
    expect(migrated.operations[0]).toMatchObject({
      kind: 'set-field',
      entityId: 'text',
      componentKey: 'Renderer',
      fieldPath: ['props', 'text'],
      value: 'Danger',
    })
  })
})
