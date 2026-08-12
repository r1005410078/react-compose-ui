import { describe, expect, it } from 'vitest'
import {
  migrateLegacyComposeInstanceOverrides,
  parseComposeInstanceOverrides,
  resolveComposeInstanceOverrides,
} from './index'
import type { ComposeComponentOverrideOperation } from './index'
import { createComposeGroupEntitySeed } from './group'
import { documentFixture } from './test-fixtures'
import type { ComposeDocument } from './document-types'

/**
 * 组件解析文档必须是单 Group 根；复用 documentFixture 获得合法 canvas/output 默认值，
 * 否则失败会来自夹具而不是被测行为。
 */
function snapshotDocument(): ComposeDocument {
  return documentFixture({ root: createComposeGroupEntitySeed({ id: 'root', name: 'Group' }) }, ['root'])
}

describe('实例覆盖分区模型', () => {
  it('解析只含结构操作的 instanceOverrides', () => {
    const operations: ComposeComponentOverrideOperation[] = [
      { id: 'op-1', kind: 'remove-field', entityId: 'root', componentKey: 'Visibility', fieldPath: ['visible'] },
    ]
    const result = parseComposeInstanceOverrides({ operations })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.overrides.operations).toHaveLength(1)
  })

  it('仍含 properties 分区的对象判为未迁移', () => {
    const result = parseComposeInstanceOverrides({ properties: {}, operations: [] })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0]?.code).toBe('component-asset.legacy')
  })

  it('拒绝未迁移的旧 propertyOverrides 字段', () => {
    const result = parseComposeInstanceOverrides({ 'prop-a': 'hello' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0]?.code).toBe('component-asset.legacy')
  })

  it('显式迁移在缺少属性定义时丢弃无法还原目标的覆盖', () => {
    // 没有定义就无法还原字段目标，保留一条无目标覆盖会在解析期整体失败。
    const migrated = migrateLegacyComposeInstanceOverrides({ 'prop-a': 1, 'prop-b': false })
    expect(migrated.operations).toEqual([])
  })

  it('结构操作按顺序应用', () => {
    const resolved = resolveComposeInstanceOverrides({
      document: snapshotDocument(),
      overrides: {
        operations: [
          { id: 'op-1', kind: 'add-component', entityId: 'root', componentKey: 'Name', value: { value: '先写' } },
          { id: 'op-2', kind: 'set-field', entityId: 'root', componentKey: 'Name', fieldPath: ['value'], value: '后写' },
        ],
      },
    })
    // 后一条依赖前一条创建的 Component；顺序颠倒会直接失败。
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.document.entities.root?.components.Name).toEqual({ value: '后写' })
  })

  it('拒绝把实体 reparent 出实例子树', () => {
    // 实例文档即组件文档，宿主实体不在其中，越界 parentId 表现为父级不存在。
    const resolved = resolveComposeInstanceOverrides({
      document: snapshotDocument(),
      overrides: {
        operations: [{
          id: 'op-1',
          kind: 'move-entity',
          entityId: 'root',
          parentId: 'host-entity',
          beforeEntityId: null,
        }],
      },
    })
    expect(resolved.ok).toBe(false)
    if (resolved.ok) return
    expect(resolved.issues[0]?.code).toBe('component-asset.invalid-operation')
  })

  it('解析后文档不合法时不返回半应用结果', () => {
    const resolved = resolveComposeInstanceOverrides({
      document: snapshotDocument(),
      overrides: { operations: [{ id: 'op-1', kind: 'remove-entity', entityId: 'root' }] },
    })
    expect(resolved.ok).toBe(false)
  })
})
