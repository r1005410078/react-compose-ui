import { describe, expect, it } from 'vitest'
import type { ComposeEntity, JsonValue } from './document-types'
import { documentFixture, rendererEntity } from './test-fixtures'
import { validateComposeDocument } from './document'
import {
  isComposeLegacyPageSlotEntity,
  migrateComposeDocumentPageSlots,
} from './page-slot-migration'

const PAGE = {
  kind: 'page',
  providerId: 'demo',
  assetKey: 'pages/detail.page.json',
  scope: 'persistent',
} as const

function slotEntity(id: string, page: JsonValue = PAGE): ComposeEntity {
  const base = rendererEntity(id)
  return {
    ...base,
    name: `${id} slot`,
    components: {
      ...base.components,
      Composition: {
        presetId: 'page-slot',
        baseComponentKeys: ['Transform', 'LayoutItem', 'Visibility', 'Lock', 'Appearance', 'Renderer'],
        capabilityIds: [],
      },
      Renderer: { type: 'page-slot', props: { page } },
    },
  }
}

describe('OpenSpec: page-slot Entity 显式迁移', () => {
  it('降级为占位容器', () => {
    const source = documentFixture({
      first: slotEntity('first'),
      second: slotEntity('second', null),
    })
    const before = structuredClone(source)

    const result = migrateComposeDocumentPageSlots(source)

    for (const id of ['first', 'second'] as const) {
      const migrated = result.document.entities[id]!
      expect(migrated.components.Renderer).toBeUndefined()
      expect(migrated.components.Hierarchy).toEqual({ childIds: [] })
      // 位置、尺寸与外观逐字段保留：占位停在原处，用户能看出这里原来有东西。
      expect(migrated.components.LayoutItem).toEqual(source.entities[id]!.components.LayoutItem)
      expect(migrated.components.Appearance).toEqual(source.entities[id]!.components.Appearance)
      expect(migrated.components.Transform).toEqual(source.entities[id]!.components.Transform)
    }
    expect(result.migrated.map(({ entityId }) => entityId)).toEqual(['first', 'second'])
    expect(result.migrated[0]!.page).toEqual(PAGE)
    expect(result.migrated[1]!.page).toBeNull()
    expect(result.issues).toHaveLength(2)
    expect(result.issues[0]!.code).toBe('renderer.legacy-page-slot')
    expect(result.issues[0]!.message).toContain(PAGE.assetKey)
    // 降级后的文档必须自身合法，否则宿主拿到手仍然打不开。
    expect(validateComposeDocument(result.document).valid).toBe(true)
    // 迁移不修改输入。
    expect(source).toEqual(before)
  })

  it('普通解析返回 legacy issue', () => {
    const result = validateComposeDocument(documentFixture({ slot: slotEntity('slot') }))
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues.map(({ code }) => code)).toContain('renderer.legacy-page-slot')
    // 几何不因为报错而丢失：issue 指向 Entity 自身，文档内容原样留给迁移入口处理。
    expect(result.issues.some(({ path }) => path.includes('slot'))).toBe(true)
  })

  it('迁移不写入资源', () => {
    // 纯函数迁移没有 Provider 依赖：它无法把被内嵌页面转成组件资产，只能降级并报告。
    const result = migrateComposeDocumentPageSlots(documentFixture({ slot: slotEntity('slot') }))
    expect(result.migrated[0]!.page).toEqual(PAGE)
    expect(Object.keys(result.document.entities)).toContain('slot')
  })

  it('不含 Page Slot 时原样返回', () => {
    const source = documentFixture({ rectangle: rendererEntity('rectangle') })
    const result = migrateComposeDocumentPageSlots(source)
    expect(result.document).toBe(source)
    expect(result.migrated).toHaveLength(0)
    expect(result.issues).toHaveLength(0)
  })

  it('判别遗留 Slot', () => {
    expect(isComposeLegacyPageSlotEntity(slotEntity('slot'))).toBe(true)
    expect(isComposeLegacyPageSlotEntity(rendererEntity('rectangle'))).toBe(false)
    expect(isComposeLegacyPageSlotEntity(undefined)).toBe(false)
  })

  it('降级同时丢弃只能与 Renderer 组合的 Bindings', () => {
    const base = slotEntity('slot')
    const withBindings: ComposeEntity = {
      ...base,
      components: {
        ...base.components,
        Bindings: { version: 1, rendererProps: { fields: {} } },
      },
    }
    const result = migrateComposeDocumentPageSlots(documentFixture({ slot: withBindings }))
    expect(result.document.entities.slot!.components.Bindings).toBeUndefined()
    expect(validateComposeDocument(result.document).valid).toBe(true)
  })
})
