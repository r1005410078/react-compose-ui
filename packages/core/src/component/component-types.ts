import type {
  ComposeDocument,
  ComposeEntity,
  DocumentValidationIssueCode,
  JsonObject,
  JsonValue,
} from '../document-types'

/** 组件文件的命名后缀。 @public */
export const COMPOSE_COMPONENT_FILE_SUFFIX = '.component.json' as const

/** 组件文件的媒体类型。 @public */
export const COMPOSE_COMPONENT_MEDIA_TYPE = 'application/vnd.compose-ui.component+json' as const

/** 当前 Component Asset 协议版本。 @public */
export const COMPOSE_COMPONENT_SCHEMA_VERSION = 1 as const

/** Variant 继承和 component-instance 嵌套各自允许的最大资源层数。 @public */
export const COMPOSE_COMPONENT_NEST_DEPTH_LIMIT = 8 as const

/** 稳定组件资源引用；结构兼容 assets 的稳定引用。 @public */
export interface ComposeComponentReference extends JsonObject {
  readonly [key: string]: string
  readonly kind: 'component'
  readonly providerId: string
  readonly assetKey: string
  readonly scope: 'persistent' | 'session'
}

/** 暴露属性支持的首期 JSON 值分类。 @public */
export type ComposeComponentPropertyValueType = 'string' | 'number' | 'boolean' | 'json'

/** 暴露属性的稳定文档目标。 @public */
export interface ComposeComponentPropertyTarget extends JsonObject {
  readonly entityId: string
  readonly componentKey: string
  readonly fieldPath: readonly string[]
}

/** 只由 Base 声明、Variant 与实例继承的可覆盖属性。 @public */
export interface ComposeComponentPropertyDefinition extends JsonObject {
  readonly id: string
  readonly name: string
  readonly valueType: ComposeComponentPropertyValueType
  readonly target: ComposeComponentPropertyTarget
}

/** 一条已应用资源及其 revision。 @public */
export interface ComposeComponentLineageEntry extends JsonObject {
  readonly reference: ComposeComponentReference
  readonly componentId: string
  readonly kind: 'base' | 'variant'
  readonly revision: string
}

interface ComposeComponentOperationBase {
  readonly id: string
}

/** 设置 Component 内的稳定对象字段；数组作为字段值整体替换。 @public */
export interface ComposeComponentSetFieldOperation extends ComposeComponentOperationBase {
  readonly kind: 'set-field'
  readonly entityId: string
  readonly componentKey: string
  readonly fieldPath: readonly string[]
  readonly value: JsonValue
}

/** 移除 Component 内的可选对象字段。 @public */
export interface ComposeComponentRemoveFieldOperation extends ComposeComponentOperationBase {
  readonly kind: 'remove-field'
  readonly entityId: string
  readonly componentKey: string
  readonly fieldPath: readonly string[]
}

/** 添加非基础 Component。 @public */
export interface ComposeComponentAddComponentOperation extends ComposeComponentOperationBase {
  readonly kind: 'add-component'
  readonly entityId: string
  readonly componentKey: string
  readonly value: JsonObject
}

/** 移除非基础 Component。 @public */
export interface ComposeComponentRemoveComponentOperation extends ComposeComponentOperationBase {
  readonly kind: 'remove-component'
  readonly entityId: string
  readonly componentKey: string
}

/** 添加包含稳定 ID 的完整 Entity 子树。 @public */
export interface ComposeComponentAddEntityOperation extends ComposeComponentOperationBase {
  readonly kind: 'add-entity'
  readonly rootEntityId: string
  readonly entities: Readonly<Record<string, ComposeEntity>>
  readonly parentId: string | null
  /** null 表示追加。 */
  readonly beforeEntityId: string | null
}

/** 移除非根 Entity 子树。 @public */
export interface ComposeComponentRemoveEntityOperation extends ComposeComponentOperationBase {
  readonly kind: 'remove-entity'
  readonly entityId: string
}

/** 以稳定锚点 reparent 或 reorder 一个 Entity。 @public */
export interface ComposeComponentMoveEntityOperation extends ComposeComponentOperationBase {
  readonly kind: 'move-entity'
  readonly entityId: string
  readonly parentId: string | null
  /** null 表示追加。 */
  readonly beforeEntityId: string | null
}

/** Variant 持久化的规范语义操作。 @public */
export type ComposeComponentOverrideOperation =
  | ComposeComponentSetFieldOperation
  | ComposeComponentRemoveFieldOperation
  | ComposeComponentAddComponentOperation
  | ComposeComponentRemoveComponentOperation
  | ComposeComponentAddEntityOperation
  | ComposeComponentRemoveEntityOperation
  | ComposeComponentMoveEntityOperation

/** 离线和历史确定渲染使用的完整组件快照。 @public */
export interface ComposeResolvedComponentSnapshot {
  readonly componentId: string
  readonly kind: 'base' | 'variant'
  readonly revision: string
  readonly document: ComposeDocument
  readonly properties: readonly ComposeComponentPropertyDefinition[]
  /** 从 Base 到当前资源的有序链。 */
  readonly appliedLineage: readonly ComposeComponentLineageEntry[]
}

/** 不依赖父资源的 Base Component 文件。 @public */
export interface ComposeBaseComponentAsset {
  readonly schemaVersion: typeof COMPOSE_COMPONENT_SCHEMA_VERSION
  readonly kind: 'base'
  readonly componentId: string
  readonly name: string
  readonly document: ComposeDocument
  readonly properties: readonly ComposeComponentPropertyDefinition[]
}

/** 只保存相对直接父源操作的 Variant 文件。 @public */
export interface ComposeVariantComponentAsset {
  readonly schemaVersion: typeof COMPOSE_COMPONENT_SCHEMA_VERSION
  readonly kind: 'variant'
  readonly componentId: string
  readonly name: string
  readonly parentRef: ComposeComponentReference
  /** 从 Base 到直接父源，不包含当前 Variant。 */
  readonly appliedLineage: readonly ComposeComponentLineageEntry[]
  readonly overrides: readonly ComposeComponentOverrideOperation[]
  readonly resolvedSnapshot: ComposeResolvedComponentSnapshot
}

/** Component Asset v1 的严格判别联合。 @public */
export type ComposeComponentAssetV1 = ComposeBaseComponentAsset | ComposeVariantComponentAsset

/** Component Asset 解析问题机器码。 @public */
export type ComposeComponentAssetIssueCode =
  | 'component-asset.invalid-json'
  | 'component-asset.invalid-shape'
  | 'component-asset.unsupported-version'
  | 'component-asset.legacy'
  | 'component-asset.invalid-reference'
  | 'component-asset.invalid-property'
  | 'component-asset.invalid-operation'
  | 'component-asset.invalid-lineage'
  | 'component-asset.invalid-snapshot'
  | 'component-asset.invalid-root'
  | 'component-asset.cycle'
  | 'component-asset.depth-exceeded'
  | 'component-asset.parent-missing'
  | 'component-asset.pending-update'
  | DocumentValidationIssueCode

/** 可定位的 Component Asset 问题。 @public */
export interface ComposeComponentAssetIssue {
  readonly code: ComposeComponentAssetIssueCode
  readonly path: readonly (string | number)[]
  readonly message: string
  readonly operationId?: string
}

/** Component Asset 文本解析结果。 @public */
export type ComposeComponentAssetParseResult =
  | { readonly ok: true; readonly asset: ComposeComponentAssetV1 }
  | { readonly ok: false; readonly issues: readonly ComposeComponentAssetIssue[] }

/** Variant 操作应用结果。 @public */
export type ComposeComponentOverrideApplyResult =
  | { readonly ok: true; readonly document: ComposeDocument }
  | { readonly ok: false; readonly issues: readonly ComposeComponentAssetIssue[] }

/** Resolver 读取父资源时返回的事实。 @public */
export interface ComposeLoadedComponentAsset {
  readonly asset: ComposeComponentAssetV1
  readonly revision: string
}

/** Component Asset Resolver 的输入。 @public */
export interface ResolveComposeComponentAssetInput extends ComposeLoadedComponentAsset {
  readonly reference: ComposeComponentReference
  readonly load: (
    reference: ComposeComponentReference,
    signal?: AbortSignal,
  ) => Promise<ComposeLoadedComponentAsset>
  readonly signal?: AbortSignal
}

/** Component Asset 解析状态。 @public */
export type ComposeComponentResolveResult =
  | { readonly status: 'resolved'; readonly snapshot: ComposeResolvedComponentSnapshot }
  | {
      readonly status: 'orphaned'
      readonly snapshot: ComposeResolvedComponentSnapshot
      readonly issues: readonly ComposeComponentAssetIssue[]
    }
  | { readonly status: 'invalid'; readonly issues: readonly ComposeComponentAssetIssue[] }
  | {
      readonly status: 'pending-update'
      readonly snapshot: ComposeResolvedComponentSnapshot
      readonly issues: readonly ComposeComponentAssetIssue[]
      readonly conflicts: readonly ComposeComponentAssetIssue[]
    }
