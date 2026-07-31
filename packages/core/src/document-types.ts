/**
 * ComposeDocument v5 的严格 JSON 与 ECS Entity/Component 公共协议。
 *
 * @packageDocumentation
 */

import type { ComposeColor, ComposePaint } from './paint'

/** 严格 JSON 标量。 @public */
export type JsonPrimitive = string | number | boolean | null

/** 严格 JSON 数组。 @public */
export type JsonArray = readonly JsonValue[]

/** 严格 JSON 对象。 @public */
export interface JsonObject {
  readonly [key: string]: JsonValue
}

/** 可被文档、命令和 Patch 安全持久化的 JSON 值。 @public */
export type JsonValue = JsonPrimitive | JsonArray | JsonObject

/** 二维位置。 @public */
export interface ComposePosition extends JsonObject {
  readonly x: number
  readonly y: number
}

/** 二维尺寸。 @public */
export interface ComposeSize extends JsonObject {
  readonly width: number
  readonly height: number
}

/** Entity 的局部二维几何 Component。 @public */
export interface ComposeTransform extends JsonObject {
  readonly position: ComposePosition
  readonly size: ComposeSize
  readonly rotation: number
}

/** Resize 约束模式。 @public */
export type ComposeResizeMode =
  | 'free'
  | 'preserve-aspect'
  | 'horizontal'
  | 'vertical'
  | 'none'

/** Stage 几何编辑规则；缺失时使用自由变换默认值。 @public */
export interface ComposeTransformConstraints extends JsonObject {
  readonly movable: boolean
  readonly resize: ComposeResizeMode
  readonly rotatable: boolean
  readonly minSize: ComposeSize
  readonly maxSize: ComposeSize | null
}

/** Preset 基础组合和已附加能力的持久化 Authoring 数据。 @public */
export interface ComposeComposition extends JsonObject {
  readonly presetId: string | null
  readonly baseComponentKeys: readonly string[]
  readonly capabilityIds: readonly string[]
}

/** Entity 可见状态。 @public */
export interface ComposeVisibility extends JsonObject {
  readonly visible: boolean
}

/** Entity 编辑锁定状态。 @public */
export interface ComposeLock extends JsonObject {
  readonly locked: boolean
}

/** 唯一父子关系来源。 @public */
export interface ComposeHierarchy extends JsonObject {
  readonly childIds: readonly string[]
}

/** Flex 容器的主轴方向。 @public */
export type ComposeFlexDirection =
  | 'row'
  | 'row-reverse'
  | 'column'
  | 'column-reverse'

/** Flex 容器的换行方式。 @public */
export type ComposeFlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse'

/** Flex 容器的多行对齐方式。 @public */
export type ComposeAlignContent =
  | 'normal'
  | 'flex-start'
  | 'center'
  | 'flex-end'
  | 'space-between'
  | 'space-around'
  | 'stretch'

/** Flex 容器的主轴对齐方式。 @public */
export type ComposeJustifyContent =
  | 'normal'
  | 'flex-start'
  | 'center'
  | 'flex-end'
  | 'space-between'
  | 'space-around'
  | 'space-evenly'

/** Flex 容器的交叉轴对齐方式。 @public */
export type ComposeAlignItems =
  | 'normal'
  | 'flex-start'
  | 'center'
  | 'flex-end'
  | 'stretch'
  | 'baseline'

/**
 * 容器可选的 Flex 布局 Authoring 数据。
 *
 * @remarks
 * `gap` 是无单位的有限非负数；未来渲染实现会把它解释为 CSS 像素。
 *
 * @public
 */
export interface ComposeFlexLayout extends JsonObject {
  readonly type: 'flex'
  readonly flexDirection: ComposeFlexDirection
  readonly flexWrap: ComposeFlexWrap
  readonly alignContent: ComposeAlignContent
  readonly justifyContent: ComposeJustifyContent
  readonly alignItems: ComposeAlignItems
  readonly gap: number
}

/** 容器可选的布局数据；当前仅支持 Flex。 @public */
export type ComposeLayout = ComposeFlexLayout

/** 后代裁剪状态。 @public */
export interface ComposeClip extends JsonObject {
  readonly enabled: boolean
}

/** 单个结构化阴影。 @public */
export interface ComposeShadow extends JsonObject {
  readonly color: ComposeColor
  readonly offsetX: number
  readonly offsetY: number
  readonly blur: number
  readonly spread: number
}

/** Entity 可选的部分外观数据。 @public */
export type ComposeAppearance = JsonObject & {
  readonly backgroundPaint?: ComposePaint
  readonly borderColor?: ComposeColor
  readonly borderWidth?: number
  readonly borderRadius?: number
  readonly opacity?: number
  readonly shadow?: ComposeShadow | null
}

/** 渲染端使用的完整稳定外观。 @public */
export interface ResolvedComposeAppearance {
  readonly backgroundPaint: ComposePaint
  readonly borderColor: ComposeColor
  readonly borderWidth: number
  readonly borderRadius: number
  readonly opacity: number
  readonly shadow: ComposeShadow | null
}

/** 宿主 Renderer 类型与 JSON 属性。 @public */
export interface ComposeRenderer extends JsonObject {
  readonly type: string
  readonly props: JsonObject
}

/** ComposeDocument v5 内建 Component Key。 @public */
export const COMPOSE_BUILTIN_COMPONENT_KEYS = {
  composition: 'Composition',
  transform: 'Transform',
  transformConstraints: 'TransformConstraints',
  visibility: 'Visibility',
  lock: 'Lock',
  hierarchy: 'Hierarchy',
  layout: 'Layout',
  clip: 'Clip',
  appearance: 'Appearance',
  renderer: 'Renderer',
} as const

/** ComposeDocument v5 内建 Component Key 联合。 @public */
export type ComposeBuiltinComponentKey =
  typeof COMPOSE_BUILTIN_COMPONENT_KEYS[keyof typeof COMPOSE_BUILTIN_COMPONENT_KEYS]

/** 完全由 Components 组合的场景 Entity。 @public */
export interface ComposeEntity {
  /** 文档内稳定且唯一的 Entity ID。 */
  readonly id: string
  /** 面向编辑器用户的 Entity 名称。 */
  readonly name: string
  /** PascalCase Key 到严格 JsonObject 的 Component 映射。 */
  readonly components: Readonly<Record<string, JsonObject>>
}

/** 一条全局世界坐标辅助线。 @public */
export interface ComposeCanvasGuide {
  readonly id: string
  readonly axis: 'x' | 'y'
  readonly position: number
}

/** 编辑器画布的持久化设置。 @public */
export interface ComposeCanvasSettings {
  readonly grid: {
    readonly stepX: number
    readonly stepY: number
    readonly offsetX: number
    readonly offsetY: number
    readonly primaryLineEvery: number
    readonly snapEnabled: boolean
  }
  readonly smartSnap: {
    readonly nodes: boolean
    readonly guides: boolean
  }
  readonly guides: readonly ComposeCanvasGuide[]
}

/** 文档发布与 Preview 使用的固定原点输出设置。 @public */
export interface ComposeOutputSettings {
  readonly width: number
  readonly height: number
  readonly backgroundPaint: ComposePaint
}

/** 编辑器、Stage 与 Preview 共享的 v5 ECS 文档。 @public */
export interface ComposeDocument {
  /** 当前且唯一支持的文档协议版本。 @defaultValue 5 */
  readonly schemaVersion: 5
  readonly canvas: ComposeCanvasSettings
  readonly output: ComposeOutputSettings
  readonly rootIds: readonly string[]
  readonly entities: Readonly<Record<string, ComposeEntity>>
}

/** 文档校验问题稳定机器码。 @public */
export type DocumentValidationIssueCode =
  | 'json.unsupported'
  | 'json.non-finite-number'
  | 'json.cycle'
  | 'document.invalid'
  | 'document.unsupported-version'
  | 'document.invalid-root'
  | 'document.duplicate-root'
  | 'document.missing-child'
  | 'document.multiple-parents'
  | 'document.cycle'
  | 'document.orphan-entity'
  | 'output.invalid'
  | 'output.invalid-size'
  | 'output.invalid-background'
  | 'canvas.invalid'
  | 'canvas.invalid-step'
  | 'canvas.invalid-offset'
  | 'canvas.invalid-primary-interval'
  | 'canvas.invalid-guide'
  | 'canvas.duplicate-guide'
  | 'entity.invalid'
  | 'entity.id-mismatch'
  | 'entity.invalid-field'
  | 'component.invalid-key'
  | 'component.invalid-value'
  | 'component.missing'
  | 'component.invalid-combination'
  | 'composition.invalid'
  | 'transform.invalid'
  | 'transform.invalid-size'
  | 'transform-constraints.invalid'
  | 'layout.invalid'
  | 'appearance.invalid'
  | 'appearance.invalid-paint'
  | 'renderer.invalid'

/** 一个可定位的文档校验问题。 @public */
export interface DocumentValidationIssue {
  readonly code: DocumentValidationIssueCode
  readonly path: readonly (string | number)[]
  readonly message: string
}

/** 文档校验判别结果。 @public */
export type DocumentValidationResult =
  | { readonly valid: true; readonly document: ComposeDocument }
  | { readonly valid: false; readonly issues: readonly DocumentValidationIssue[] }
