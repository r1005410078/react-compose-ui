/**
 * ComposeDocument v6 的严格 JSON、ECS Entity/Component 与派生布局公共协议。
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

/** Entity 在布局盒之后应用的二维变换 Component。 @public */
export interface ComposeTransform extends JsonObject {
  readonly rotation: number
}

/** 编辑命令与 Stage 适配使用的完整局部盒变换；不是持久化 Component。 @public */
export interface ComposeSpatialTransform extends JsonObject {
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

/** Stage 几何编辑规则；尺寸上下限由 LayoutItem 保存。 @public */
export interface ComposeGeometryConstraints extends JsonObject {
  readonly movable: boolean
  readonly resize: ComposeResizeMode
  readonly rotatable: boolean
}

/** 四条物理边的连续逻辑像素值。 @public */
export interface ComposeEdges extends JsonObject {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

/** Figma 式单轴尺寸意图。 @public */
export interface ComposeAxisSizing extends JsonObject {
  readonly mode: 'fixed' | 'fill' | 'hug'
  /** Fixed 值；在 Fill/Hug 下作为切换或测量失败的 fallback。 */
  readonly value: number
  readonly min: number | null
  readonly max: number | null
}

/** Entity 相对 parent 的布局参与方式与盒模型意图。 @public */
export interface ComposeLayoutItem extends JsonObject {
  readonly positioning: 'flow' | 'absolute'
  /** Absolute 坐标；Flow 时保留但不参与求解。 */
  readonly offset: ComposePosition
  readonly width: ComposeAxisSizing
  readonly height: ComposeAxisSizing
  readonly margin: ComposeEdges
  readonly alignSelf: 'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'
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

/**
 * 让容器同一时刻只显示一个直接子项的切换语义。
 *
 * @remarks
 * 对标 UMG `UWidgetSwitcher`：全部子项照常参与布局求解，只有 `activeIndex` 指向的那个被渲染。
 * 只在同时拥有 {@link ComposeHierarchy} 的 Entity 上有意义，是可选 Component。
 *
 * @public
 */
export interface ComposeWidgetSwitcher extends JsonObject {
  /**
   * 活动子项在 `Hierarchy.childIds` 中的下标。
   *
   * @remarks
   * 允许越界：子项被删除后不回写索引，读取侧统一钳制，避免一次删除产生两条语义无关的补丁。
   */
  readonly activeIndex: number
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
  | 'flex-start'
  | 'center'
  | 'flex-end'
  | 'space-between'
  | 'space-around'
  | 'stretch'

/** Flex 容器的主轴对齐方式。 @public */
export type ComposeJustifyContent =
  | 'flex-start'
  | 'center'
  | 'flex-end'
  | 'space-between'
  | 'space-around'
  | 'space-evenly'

/** Flex 容器的交叉轴对齐方式。 @public */
export type ComposeAlignItems =
  | 'flex-start'
  | 'center'
  | 'flex-end'
  | 'stretch'
  | 'baseline'

/**
 * 容器可选的 Flex 布局 Authoring 数据。
 *
 * @remarks
 * 所有数值都是连续逻辑像素；Runtime 会映射为 Yoga point。
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
  readonly padding: ComposeEdges
  readonly rowGap: number
  readonly columnGap: number
}

/** 容器可选的布局数据；当前仅支持 Flex。 @public */
export type ComposeLayout = ComposeFlexLayout

/** Container 单轴的溢出行为。 @public */
export type ComposeOverflowMode = 'visible' | 'clip' | 'scroll'

/** Container 解析后的完整分轴溢出行为。 @public */
export interface ComposeResolvedOverflow {
  /** 横向溢出行为。 */
  readonly horizontal: ComposeOverflowMode
  /** 纵向溢出行为。 */
  readonly vertical: ComposeOverflowMode
}

/**
 * 后代裁剪与滚动状态。
 *
 * @remarks
 * `horizontal` 与 `vertical` 必须同时提供或同时省略。省略时保留旧版 `enabled` 语义。
 *
 * @public
 */
export type ComposeClip = JsonObject & {
  readonly enabled: boolean
  readonly horizontal?: ComposeOverflowMode
  readonly vertical?: ComposeOverflowMode
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

/** 页面 setup 返回成员的稳定引用。 @public */
export interface ComposePageExportReference extends JsonObject {
  readonly scope: 'page'
  readonly exportName: string
}

/** Renderer 顶层字段的持久化绑定。 @public */
export interface ComposeRendererPropsBindings extends JsonObject {
  /** 顶层 Prop 到页面返回成员的映射。 */
  readonly fields: Readonly<Record<string, ComposePageExportReference>>
}

/** Renderer Props 到页面返回成员的持久化绑定。 @public */
export interface ComposeBindings extends JsonObject {
  readonly version: 1
  readonly rendererProps: ComposeRendererPropsBindings
}

/** ComposeDocument v6 内建 Component Key。 @public */
export const COMPOSE_BUILTIN_COMPONENT_KEYS = {
  composition: 'Composition',
  transform: 'Transform',
  layoutItem: 'LayoutItem',
  geometryConstraints: 'GeometryConstraints',
  visibility: 'Visibility',
  lock: 'Lock',
  hierarchy: 'Hierarchy',
  widgetSwitcher: 'WidgetSwitcher',
  layout: 'Layout',
  clip: 'Clip',
  appearance: 'Appearance',
  renderer: 'Renderer',
  bindings: 'Bindings',
} as const

/** ComposeDocument v6 内建 Component Key 联合。 @public */
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

/** 编辑器、Stage 与 Preview 共享的 v6 ECS 文档。 @public */
export interface ComposeDocument {
  /** 当前且唯一支持的文档协议版本。 @defaultValue 6 */
  readonly schemaVersion: 6
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
  | 'layout-item.invalid'
  | 'geometry-constraints.invalid'
  | 'layout.invalid'
  | 'appearance.invalid'
  | 'appearance.invalid-paint'
  | 'renderer.invalid'
  | 'bindings.invalid'

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

/** Runtime 为一个 Entity 解析出的 parent-local border box。 @public */
export interface ComposeResolvedLayoutBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly positioning: ComposeLayoutItem['positioning']
}

/** Layout Runtime 不阻断渲染的稳定诊断。 @public */
export interface ComposeLayoutDiagnostic {
  readonly code: string
  readonly entityId: string
  readonly axis?: 'width' | 'height'
  readonly message: string
}

/** 一次完整布局求解的不可变结果。 @public */
export interface ComposeLayoutSnapshot {
  readonly revision: number
  readonly boxes: Readonly<Record<string, ComposeResolvedLayoutBox>>
  readonly diagnostics: readonly ComposeLayoutDiagnostic[]
}

/** Yoga Measure Function 对单轴施加的约束。 @public */
export type ComposeMeasureConstraint =
  | { readonly mode: 'undefined' }
  | { readonly mode: 'exactly' | 'at-most'; readonly value: number }

/** Renderer 内容测量的同步结果。 @public */
export interface ComposeMeasuredSize {
  readonly width: number
  readonly height: number
  readonly baseline?: number
}

/** Renderer 测量端口为 fallback 提供的可恢复原因。 @public */
export interface ComposeLayoutMeasurementDiagnostic {
  readonly code:
    | 'measurement.unregistered'
    | 'measurement.preparing'
    | 'measurement.prepare-failed'
    | 'measurement.failed'
    | 'measurement.invalid'
  readonly message: string
}

/** Layout Engine 消费的无框架同步测量端口。 @public */
export interface ComposeLayoutMeasurementPort {
  readonly revision: number
  measure(input: {
    readonly entity: ComposeEntity
    readonly width: ComposeMeasureConstraint
    readonly height: ComposeMeasureConstraint
  }): ComposeMeasuredSize | null
  /** 最近一次同步读取失败的稳定原因；省略时 Runtime 使用通用 fallback 诊断。 */
  getDiagnostic?(entityId: string): ComposeLayoutMeasurementDiagnostic | undefined
  /**
   * 订阅测量缓存变化。
   *
   * @param listener - Entity ID 集合表示精确失效；省略表示全部测量节点失效。
   */
  subscribe(listener: (entityIds?: readonly string[]) => void): () => void
}
