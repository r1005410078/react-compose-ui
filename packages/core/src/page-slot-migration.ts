/**
 * 已删除的 Page Slot Entity 的显式降级迁移。
 *
 * @remarks
 * 页面嵌套已被 Component Instance 取代，`page-slot` Renderer 不再存在。本模块只负责把
 * 文档里遗留的 Slot Entity 降级成保留几何与外观的空 Container，并把它原来指向的页面
 * 报告给宿主——纯函数迁移不能写 Provider，因此**不能**把被内嵌页面转成组件资产。
 * @packageDocumentation
 */

import {
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  type ComposeDocument,
  type ComposeEntity,
  type DocumentValidationIssue,
  type JsonObject,
} from './document-types'
import { readComposePageReference } from './page/page-graph'
import type { ComposePageReference } from './page/page-types'

/** 已删除的 Page Slot Renderer 类型。 @public */
export const COMPOSE_LEGACY_PAGE_SLOT_RENDERER_TYPE = 'page-slot'

/** 一个被降级的 Page Slot Entity。 @public */
export interface ComposePageSlotMigrationEntry {
  readonly entityId: string
  readonly name: string
  /** 原来引用的页面；未设置引用或引用不完整时为 null。 */
  readonly page: ComposePageReference | null
}

/** Page Slot 降级迁移的结果。 @public */
export interface ComposePageSlotMigrationResult {
  /** 降级后的文档；输入不含 Slot 时是输入本身。 */
  readonly document: ComposeDocument
  /** 逐条列出被降级的 Entity 与它原本引用的页面。 */
  readonly migrated: readonly ComposePageSlotMigrationEntry[]
  /** 与 `migrated` 一一对应的稳定 issue，供宿主提示用户改用组件实例。 */
  readonly issues: readonly DocumentValidationIssue[]
}

/** 判断一个 Entity 是否是遗留的 Page Slot。 @public */
export function isComposeLegacyPageSlotEntity(entity: ComposeEntity | undefined): boolean {
  const renderer = entity?.components[COMPOSE_BUILTIN_COMPONENT_KEYS.renderer]
  return renderer?.type === COMPOSE_LEGACY_PAGE_SLOT_RENDERER_TYPE
}

function downgrade(entity: ComposeEntity): ComposeEntity {
  const { components } = entity
  const next: Record<string, JsonObject> = {}
  for (const [key, value] of Object.entries(components)) {
    // Renderer 与它的 Props 绑定一起走：Bindings 要求与 Renderer 组合，留下就是非法组合。
    if (key === COMPOSE_BUILTIN_COMPONENT_KEYS.renderer) continue
    if (key === COMPOSE_BUILTIN_COMPONENT_KEYS.bindings) continue
    next[key] = value
  }
  // 校验要求 Renderer 或 Hierarchy 至少有一个；降级后的占位是个空容器。
  next[COMPOSE_BUILTIN_COMPONENT_KEYS.hierarchy] = { childIds: [] }
  const composition = components[COMPOSE_BUILTIN_COMPONENT_KEYS.composition]
  const baseKeys = Array.isArray(composition?.baseComponentKeys)
    ? composition.baseComponentKeys.filter(
        (key): key is string => typeof key === 'string'
          && key !== COMPOSE_BUILTIN_COMPONENT_KEYS.renderer
          && key !== COMPOSE_BUILTIN_COMPONENT_KEYS.bindings,
      )
    : []
  next[COMPOSE_BUILTIN_COMPONENT_KEYS.composition] = {
    ...composition,
    presetId: 'container',
    baseComponentKeys: baseKeys.includes(COMPOSE_BUILTIN_COMPONENT_KEYS.hierarchy)
      ? baseKeys
      : [...baseKeys, COMPOSE_BUILTIN_COMPONENT_KEYS.hierarchy],
  }
  return { ...entity, components: next }
}

/**
 * 把文档中遗留的 Page Slot Entity 显式降级为占位 Container。
 *
 * @remarks
 * 迁移不修改输入，也不产生任何 Provider 写入。Transform、LayoutItem、Appearance、
 * Visibility、Lock 与动画轨道全部原地保留，因此降级后的占位停在原来的位置与尺寸上，
 * 用户能看见"这里原来有东西"，而不是内容凭空消失。
 *
 * @returns 降级后的文档、被降级的条目与对应的稳定 issue。
 * @public
 */
export function migrateComposeDocumentPageSlots(
  input: ComposeDocument,
): ComposePageSlotMigrationResult {
  const migrated: ComposePageSlotMigrationEntry[] = []
  const issues: DocumentValidationIssue[] = []
  const entities: Record<string, ComposeEntity> = {}
  for (const [id, entity] of Object.entries(input.entities)) {
    if (!isComposeLegacyPageSlotEntity(entity)) {
      entities[id] = entity
      continue
    }
    const renderer = entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.renderer]
    const page = readComposePageReference(
      (renderer?.props as JsonObject | undefined)?.page,
    )
    migrated.push({ entityId: id, name: entity.name, page })
    issues.push({
      code: 'renderer.legacy-page-slot',
      path: ['entities', id],
      message: page
        ? `Page Slot ${entity.name} 已降级为占位容器，原引用页面 ${page.assetKey}；请改用组件实例`
        : `Page Slot ${entity.name} 已降级为占位容器；请改用组件实例`,
    })
    entities[id] = downgrade(entity)
  }
  if (migrated.length === 0) return { document: input, migrated, issues }
  return { document: { ...input, entities }, migrated, issues }
}
