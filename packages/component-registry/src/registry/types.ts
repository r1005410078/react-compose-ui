import type { ComponentType, ReactNode } from 'react'
import type { ComposeScriptModuleLoader } from '@compose-ui/script-runtime'
import type {
  ComposeAssetReference,
  ComposeAssetResolver,
  ComposeResolvedAsset,
} from '@compose-ui/assets'
import type {
  ComposeDocument,
  ComposeEntity,
  ComposeLayoutSnapshot,
  ComposeMeasureConstraint,
  ComposeMeasuredSize,
  ComposePageDocumentLoader,
  ComposeRenderer,
  EditorCommand,
  JsonObject,
} from '@compose-ui/core'

/** Inspector 与宿主 Stage Paint 会话之间的无 DOM 桥接。 @public */
export interface ComposePaintEditPort {
  /** 打开指定 Entity 的背景填充编辑，并显示其画布控制柄。 */
  open(input: { readonly entityId: string }): void
  /** 关闭当前 Paint 编辑并清理所有瞬时预览。 */
  close(): void
  /** 原生吸管不可用时，进入当前字段的 Stage 图层取色模式。 */
  sample(input: {
    readonly entityId: string
    readonly field: 'backgroundPaint' | 'borderColor'
  }): void
}

/** Renderer 获得的 Stage/Preview 共享上下文。 @public */
export interface ComposeRendererProps {
  /** 当前只读 Entity。 */
  readonly entity: ComposeEntity
  /** 已通过 Core 校验的 Renderer Component。 */
  readonly renderer: ComposeRenderer
  /** 应用页面绑定后的实际 React Props，可包含 Function。 */
  readonly props: ComposeRuntimeProps
  /** Renderer Component 中未经绑定覆盖的严格 JSON 属性。 */
  readonly authoredProps: JsonObject
  /** 编辑 Stage 与只读 Preview 的渲染语义。 */
  readonly mode: 'editor' | 'preview'
  /**
   * 当前实例的画布内原地文字编辑态；不在编辑中时为 undefined。
   *
   * @remarks
   * 只在 `mode` 为 `editor` 时可能出现——Preview 是只读渲染入口，不提供任何编辑能力。
   */
  readonly textEditing?: ComposeRendererTextEditing
  /** 资源型 Renderer 使用的可选运行时端口。 */
  readonly assetResolver?: ComposeAssetResolver
  /**
   * 页面型 Renderer 使用的可选文档加载端口。
   *
   * @remarks
   * 类型来自 `@compose-ui/core`，Registry 只负责透传，不实现加载，因此 Stage 与 Preview
   * 接受该端口时不会依赖任何页面实现包。
   */
  readonly pageDocumentPort?: ComposePageDocumentLoader
  /** 页面 setup 模块的可替换加载端口；Page Slot 为每个嵌套实例单独使用。 */
  readonly scriptModuleLoader?: ComposeScriptModuleLoader
  /**
   * 当前实例的 Entity Registry。
   *
   * @remarks
   * 只有需要递归渲染其他 Entity 的 Renderer（如页面槽位）才会用到；普通物料可以忽略。
   */
  readonly registry: ComposeEntityRegistry
}

/** 传给宿主 React Renderer 的运行时 Props。 @public */
export type ComposeRuntimeProps = Readonly<Record<string, unknown>>

/**
 * Renderer 处于画布内原地文字编辑时收到的编辑态。
 *
 * @remarks
 * 只有声明了 `editableTextPropName` 的 Renderer、且在 `editor` 模式下才会收到。收到它意味着
 * 该实例应当以可编辑方式渲染那段文本，同时保持字号、字重、颜色、行高与对齐不变——编辑态与
 * 最终呈现必须同源，否则宽度对不上，所见即所得在编辑瞬间就断了。
 * @public
 */
export interface ComposeRendererTextEditing {
  /** 编辑中的纯文本当前值；同时已覆盖进 `props` 中对应的可编辑 Prop。 */
  readonly value: string
  /**
   * 报告用户输入的新纯文本。
   *
   * @remarks
   * 宿主据此更新运行时覆盖，不产生文档事务——逐字符提交会让历史被单个单词撑满。Renderer
   * MUST 只传纯文本，不得传 HTML 标记。提交时机由宿主掌握，Renderer 不得自行派发命令。
   */
  readonly onChange: (value: string) => void
}

/** Renderer Inspector 可用的页面绑定变量快照。 @public */
export interface ComposeRendererInspectorBindingVariable {
  readonly id: string
  readonly label: string
  readonly kind: 'value' | 'method'
  readonly value: unknown
}

/** Renderer Inspector 中一个已保存绑定的状态。 @public */
export interface ComposeRendererInspectorBindingState {
  readonly exportName: string | null
  readonly error?: string
}

/** Editor 向自定义 Renderer Inspector 注入的无 Property Panel 依赖绑定端口。 @public */
export interface ComposeRendererInspectorBindingPort {
  readonly variables: readonly ComposeRendererInspectorBindingVariable[]
  readonly fields: Readonly<Record<string, ComposeRendererInspectorBindingState>>
  readonly inspectorPropNames: readonly string[]
  readonly baseProps: ComposeRuntimeProps
  readonly props: ComposeRuntimeProps
  readonly setField: (propName: string, exportName: string | null) => void
}

/** Renderer Props 在 Entity Inspector 中使用的显式展示分类。 @public */
export interface ComposeRendererPropCategory {
  /** Definition 内唯一且稳定的分类 ID；用于 Contract 归属，不写入文档。 */
  readonly id: string
  /** Inspector 中的用户可读分类名称。 */
  readonly label: string
  /** 分类初次挂载时是否展开。 @defaultValue false */
  readonly inspectorDefaultExpanded?: boolean
}

/** Renderer 可绑定顶层 Prop 的显式运行时契约。 @public */
export type ComposeRendererPropContract =
  | {
      readonly name: string
      readonly kind: 'value'
      readonly label: string
      /** 所属显式分类；省略时 Editor 把 Prop 放入隐式“高级”分类。 */
      readonly category?: string
      readonly validate: (value: unknown) => true | string
      /** @defaultValue true */
      readonly affectsMeasurement?: boolean
    }
  | {
      readonly name: string
      readonly kind: 'method'
      readonly label: string
      /** 所属显式分类；省略时 Editor 把 Prop 放入隐式“高级”分类。 */
      readonly category?: string
      readonly role: 'event-handler'
    }

/** 单个绑定解析失败的非阻断诊断。 @public */
export interface ComposeRendererBindingDiagnostic {
  readonly code:
    | 'binding.unknown-prop'
    | 'binding.missing-export'
    | 'binding.kind-mismatch'
    | 'binding.validation-failed'
    | 'binding.validator-threw'
  readonly entityId: string
  readonly target: { readonly kind: 'field'; readonly propName: string }
  readonly propName: string
  readonly exportName: string
  readonly message: string
  readonly cause?: unknown
}

/**
 * 节点引用属性 editor 与宿主节点目录之间的桥接。
 *
 * @remarks
 * Registry 只负责透传，不解释候选值的领域含义，因此不会因此依赖 `property-panel` 或
 * `editor`。结构与 `ComposePropertyPanelNodeEditorPort` 兼容，物料可直接传给属性面板。
 * @public
 */
export interface ComposeNodeEditPort {
  /** 宿主接受的拖拽媒体类型。 */
  readonly dragMediaTypes: readonly string[]
  /** 当前可选候选。 */
  readonly candidates: readonly {
    readonly id: string
    readonly label: string
    readonly description?: string
    readonly value: unknown
  }[]
  /** 把命中的媒体类型与其文本载荷解析为候选；无法识别时返回 null。 */
  parseDrop: (data: Readonly<Record<string, string>>) => {
    readonly id: string
    readonly label: string
    readonly description?: string
    readonly value: unknown
  } | null
  /** 把已保存的值渲染为人类可读标签。 */
  resolveLabel: (value: unknown) => string
}

/** Registry Inspector 共享的命令派发上下文。 @public */
export interface ComposeEntityInspectorContext {
  /** 当前只读 Entity。 */
  readonly entity: ComposeEntity
  /** 向同一 TransactionRuntime 派发命令。 */
  readonly dispatch: (command: EditorCommand) => unknown
  /** 锁定或宿主只读状态。 */
  readonly readOnly: boolean
  /** Inspector 所属的正式文档；需要判断父子布局语义时使用。 */
  readonly document?: ComposeDocument
  /** 当前正式布局结果；只读计算值和 Flow→Absolute 烘焙必须使用它。 */
  readonly layoutSnapshot?: ComposeLayoutSnapshot
  /** 可选的 Editor Paint 编辑桥接；Registry 与物料包不依赖 Stage。 */
  readonly paintEditPort?: ComposePaintEditPort
  /** 可选的节点目录桥接；物料把它交给属性面板的 node editor。 */
  readonly nodeEditPort?: ComposeNodeEditPort
}

/** Renderer Props Inspector 的上下文。 @public */
export interface ComposeRendererInspectorProps extends ComposeEntityInspectorContext {
  /** 当前 Renderer Component。 */
  readonly renderer: ComposeRenderer
  /** 应用页面绑定后的实际 Props。 */
  readonly props: ComposeRuntimeProps
  /** 未被绑定覆盖的严格 JSON Props。 */
  readonly authoredProps: JsonObject
  /** 当前由 Editor 请求渲染的显式 Prop 分类；省略时表示隐式“高级”分类。 */
  readonly propCategory?: ComposeRendererPropCategory
  /** Editor 注入的可选 Renderer Props 绑定端口。 */
  readonly propsBinding?: ComposeRendererInspectorBindingPort
}

/** 单个 ECS Component Inspector 的上下文。 @public */
export interface ComposeComponentInspectorProps extends ComposeEntityInspectorContext {
  /** 当前 Component Key。 */
  readonly componentKey: string
  /** 当前 Component 的严格 JSON 数据。 */
  readonly value: JsonObject
}

/** Entity 缺少一个可选 Component 时，其 Inspector 入口获得的上下文。 @public */
export interface ComposeMissingComponentInspectorProps extends ComposeEntityInspectorContext {
  /** 当前尚未附加的 Component Key。 */
  readonly componentKey: string
}

/** 缺失 Component 在 Inspector 中的可选添加入口。 @public */
export interface ComposeMissingComponentInspectorDefinition {
  /** 判断当前 Entity 是否应展示添加入口。 */
  readonly isVisible: (entity: ComposeEntity) => boolean
  /** 渲染标题栏操作；具体添加语义由 Component 定义拥有。 */
  readonly actions: ComponentType<ComposeMissingComponentInspectorProps>
  /**
   * 可选的缺失状态引导正文。
   *
   * @remarks
   * 未声明时 Editor 继续使用无正文的 action-only 分组；声明后使用可折叠分组，并向正文透传
   * 与标题操作相同的只读文档上下文。
   */
  readonly content?: ComponentType<ComposeMissingComponentInspectorProps>
}

/** 一个可由 Stage 与 Preview 共同解析的 Renderer 定义。 @public */
export interface ComposeRendererDefinition {
  /** `Renderer.type` 使用的唯一非空标识。 */
  readonly type: string
  /** Inspector 与错误状态中的用户可读名称。 */
  readonly label: string
  /** Stage 与 Preview 共享的宿主 React Renderer。 */
  readonly renderer: ComponentType<ComposeRendererProps>
  /** 可绑定顶层 React Props；省略时 Renderer 只使用 authored Props。 */
  readonly propContracts?: readonly ComposeRendererPropContract[]
  /** Props 的显式 Inspector 分类；未归类 Contract 默认进入隐式“高级”分类。 */
  readonly propCategories?: readonly ComposeRendererPropCategory[]
  /** 由自定义 Inspector 在原字段旁呈现绑定入口的 value Prop 名称。 */
  readonly inspectorPropNames?: readonly string[]
  /**
   * 承载可原地编辑纯文本的 value Prop 名称；声明后该 Renderer 支持画布内文字编辑。
   *
   * @remarks
   * 必须指向同一 Definition 中已声明的 value Contract，否则注册被拒绝。声明它是 Renderer
   * 表达「我的这个 Prop 是一段可以在画布上直接改的纯文本」的唯一方式——Stage 不依赖物料包，
   * 只能凭该声明判断可编辑性，不能按 Renderer type 硬编码。
   *
   * 契约只覆盖纯文本单 Prop，不表达富文本、区段样式或多 Prop 编辑。
   */
  readonly editableTextPropName?: string
  /** 可选 Renderer Props Inspector；声明分类后按 `propCategory` 分次渲染。 */
  readonly inspector?: ComponentType<ComposeRendererInspectorProps>
  /**
   * 未声明 Props 分类时，隐式“高级”分组初次挂载是否展开。
   *
   * @defaultValue false
   */
  readonly inspectorDefaultExpanded?: boolean
  /** 可选的内容固有尺寸定义；不得读取 Stage 或 Preview 的 Scene Entity DOM。 */
  readonly measurement?: ComposeRendererMeasurementDefinition
}

/** Renderer 同步测量获得的稳定输入。 @public */
export interface ComposeRendererMeasureInput {
  readonly entity: ComposeEntity
  readonly renderer: ComposeRenderer
  readonly props: ComposeRuntimeProps
  readonly authoredProps: JsonObject
  readonly width: ComposeMeasureConstraint
  readonly height: ComposeMeasureConstraint
  /** `prepare` 完成后的不透明缓存；没有 prepare 时为 undefined。 */
  readonly prepared: unknown
}

/** Renderer 异步准备获得的运行时端口。 @public */
export interface ComposeRendererPrepareInput {
  readonly entity: ComposeEntity
  readonly renderer: ComposeRenderer
  readonly props: ComposeRuntimeProps
  readonly authoredProps: JsonObject
  readonly assetResolver?: ComposeAssetResolver
  readonly pageDocumentPort?: ComposePageDocumentLoader
  readonly signal: AbortSignal
}

/** Renderer 外部事实变化订阅输入。 @public */
export interface ComposeRendererMeasurementSubscriptionInput {
  readonly entity: ComposeEntity
  readonly renderer: ComposeRenderer
  readonly props: ComposeRuntimeProps
  readonly authoredProps: JsonObject
  readonly assetResolver?: ComposeAssetResolver
  readonly pageDocumentPort?: ComposePageDocumentLoader
  readonly invalidate: () => void
}

/**
 * Renderer 的 Hug 内容测量定义。
 *
 * @remarks
 * `measure` 必须同步；资源与页面等异步事实由 `prepare` 写入 adapter 缓存。抛错、非法尺寸和
 * 迟到的 prepare 结果都会被 adapter 隔离，不会中断其他 Entity 的布局。
 *
 * @public
 */
export interface ComposeRendererMeasurementDefinition {
  measure(input: ComposeRendererMeasureInput): ComposeMeasuredSize | null
  prepare?(input: ComposeRendererPrepareInput): Promise<unknown> | unknown
  subscribe?(input: ComposeRendererMeasurementSubscriptionInput): () => void
  /**
   * 内容高度是否随可用宽度重排，例如文字换行。
   *
   * @remarks
   * 声明后，消费方在缩放这类 Entity 时不会把 Hug 高度钉成 Fixed：被拖窄后内容重新换行
   * 会长高，若高度已被写死，长出来的部分会被自己的框裁掉。
   * @defaultValue false
   */
  readonly heightDependsOnWidth?: boolean
}

/** 一个可校验并展示的 ECS Component 定义。 @public */
export interface ComposeComponentDefinition {
  /** PascalCase Component Key。 */
  readonly key: string
  /** Inspector 中的用户可读名称。 */
  readonly label: string
  /** Inspector 聚合顺序；数值较小的定义优先。 */
  readonly order?: number
  /** 是否从普通 Inspector 区隐藏。 */
  readonly hidden?: boolean
  /** 创建独立默认数据；每次调用必须返回新的合法 JsonObject。 */
  readonly createDefault: () => JsonObject
  /** 可选宿主校验器；返回 false 或字符串表示无效。 */
  readonly validate?: (value: JsonObject) => boolean | string
  /** 可选 Component Inspector。 */
  readonly inspector?: ComponentType<ComposeComponentInspectorProps>
  /**
   * 把当前 Inspector 合并进宿主的基础属性分组。
   *
   * @remarks
   * 该元数据只影响 Inspector 组合，不改变 Component 数据、顺序或命令语义。
   */
  readonly inspectorGroup?: 'basic'
  /**
   * 独立 Inspector 分组初次挂载时是否展开；合并进基础分组时由基础分组统一决定。
   *
   * @defaultValue false
   */
  readonly inspectorDefaultExpanded?: boolean
  /**
   * Entity 尚无此 Component 时显示的可选 Inspector 入口。
   *
   * @remarks
   * Registry 只提供受控上下文与错误隔离，不推断 Component 的添加条件或命令语义。
   */
  readonly missingInspector?: ComposeMissingComponentInspectorDefinition
  /**
   * 可选 Inspector 分组标题栏内容。
   *
   * @remarks
   * 获得与正文 Inspector 相同的受控上下文，由宿主放入分组标题右侧。
   */
  readonly inspectorHeaderActions?: ComponentType<ComposeComponentInspectorProps>
}

/** Asset Browser drop 交给 Preset 的已解析资源。 @public */
export interface ComposeEntityAssetDropInput {
  /** 可持久化的资源引用。 */
  readonly reference: ComposeAssetReference
  /** Provider 已解析的资源内容与元数据。 */
  readonly resolved: ComposeResolvedAsset
  /** 用于 Entity 默认名称的资源文件名。 */
  readonly name: string
}

/** 资源型 Preset 创建 Entity seed 的协议。 @public */
export interface ComposeEntityAssetDropDefinition {
  /** 仅使用稳定元数据判断是否接受资源。 */
  accepts(input: { readonly name: string; readonly mediaType: string }): boolean
  /** 从已解析资源创建初始 Component 组合。 */
  createSeed(
    input: ComposeEntityAssetDropInput,
  ): Promise<ComposeEntitySeed> | ComposeEntitySeed
}

/** Palette 中一个完整 Entity 初始组合。 @public */
export interface ComposeEntityPreset {
  /** Composition.presetId 使用的稳定标识。 */
  readonly id: string
  /** Palette 中的用户可读名称。 */
  readonly label: string
  /** Entity 默认名称；省略时使用 label。 */
  readonly defaultName?: string
  /** Palette 可选图标；不会写入 ComposeDocument。 */
  readonly icon?: ReactNode
  /** 隐藏 Palette 项，但保留资源创建能力。 */
  readonly paletteHidden?: boolean
  /** 创建不含 Composition 的基础 Component 组合。 */
  readonly createComponents: () => Readonly<Record<string, JsonObject>>
  /** 可选资源 drop 匹配与 seed factory。 */
  readonly assetDrop?: ComposeEntityAssetDropDefinition
}

/** 一个由用户添加和移除的命名能力包。 @public */
export interface ComposeCapabilityDefinition {
  /** Composition.capabilityIds 使用的稳定标识。 */
  readonly id: string
  /** 能力菜单中的用户可读名称。 */
  readonly label: string
  /** 能力菜单中的可选简短说明。 */
  readonly description?: string
  /** 能力拥有的 Component 默认值。 */
  readonly createComponents: () => Readonly<Record<string, JsonObject>>
  /** 添加该能力前必须存在的能力 ID。 */
  readonly requires?: readonly string[]
  /** 不能与该能力同时存在的能力 ID。 */
  readonly conflicts?: readonly string[]
}

/** 创建 Entity 所需的可序列化种子。 @public */
export interface ComposeEntitySeed {
  /** 新 Entity 的默认名称。 */
  readonly name: string
  /** 已包含 Composition 的完整初始 Component 组合。 */
  readonly components: Readonly<Record<string, JsonObject>>
}

/** Preset seed 的稳定失败描述。 @public */
export interface ComposeEntitySeedError {
  /** 调用方可稳定分支处理的失败代码。 */
  readonly code:
    | 'preset.unknown'
    | 'preset.invalid'
    | 'preset.asset-unsupported'
    | 'preset.asset-factory-failed'
  /** 面向开发者或宿主错误界面的失败说明。 */
  readonly message: string
}

/** Preset seed 的判别结果。 @public */
export type ComposeEntitySeedResult =
  | { readonly ok: true; readonly seed: ComposeEntitySeed }
  | { readonly ok: false; readonly error: ComposeEntitySeedError }

/** 能力操作不可执行的稳定原因。 @public */
export interface ComposeCapabilityIssue {
  /** 调用方可稳定分支处理的能力失败代码。 */
  readonly code:
    | 'capability.unknown'
    | 'capability.entity-missing'
    | 'capability.already-attached'
    | 'capability.not-attached'
    | 'capability.locked'
    | 'capability.conflict'
    | 'capability.component-exists'
    | 'capability.required'
    | 'capability.protected'
    | 'capability.has-children'
  /** 面向能力菜单或确认流程的失败说明。 */
  readonly message: string
  /** 导致当前操作失败的依赖或冲突能力 ID。 */
  readonly relatedCapabilityIds?: readonly string[]
}

/** 能力菜单中一个候选项的当前状态。 @public */
export interface ComposeCapabilityAvailability {
  /** 当前 Registry 中的定义；未知已附加能力没有该值。 */
  readonly definition?: ComposeCapabilityDefinition
  /** Composition 中使用的稳定能力 ID。 */
  readonly capabilityId: string
  /** Entity 当前是否已附加该能力。 */
  readonly attached: boolean
  /**
   * 当前上下文中能否执行添加或移除。
   *
   * @remarks
   * 已附加项的 disabled 表示移除会被阻止（锁定、被依赖、基础项或含子项容器），
   * 与 planRemoveCapability 使用同一套规则；未附加项表示添加会被阻止。
   */
  readonly disabled: boolean
  /** 禁用时的稳定原因。 */
  readonly issue?: ComposeCapabilityIssue
}

/** 能力添加或移除规划结果。 @public */
export type ComposeCapabilityPlanResult =
  | { readonly ok: true; readonly command: EditorCommand }
  | { readonly ok: false; readonly issue: ComposeCapabilityIssue }

/** 创建 Registry 时的四类定义。 @public */
export interface ComposeEntityRegistryOptions {
  /** Stage 与 Preview 可解析的 Renderer 定义。 */
  readonly renderers?: readonly ComposeRendererDefinition[]
  /** Core 内建项或宿主扩展的 Component 定义。 */
  readonly components?: readonly ComposeComponentDefinition[]
  /** Palette 与资源拖放可创建的 Entity Presets。 */
  readonly presets?: readonly ComposeEntityPreset[]
  /** Inspector 可添加和移除的能力定义。 */
  readonly capabilities?: readonly ComposeCapabilityDefinition[]
}

/**
 * 不拥有文档和 React 状态的实例级 Entity Registry。
 *
 * @public
 */
export interface ComposeEntityRegistry {
  /** 按 Renderer type 查找定义。 */
  getRenderer(type: string): ComposeRendererDefinition | undefined
  /** 按注册顺序列出 Renderer 定义。 */
  listRenderers(): readonly ComposeRendererDefinition[]
  /** 按声明顺序列出一个 Renderer 的显式 Prop Contract。 */
  listRendererPropContracts(type: string): readonly ComposeRendererPropContract[]
  /**
   * 判断 Entity 的内容高度是否随可用宽度重排（例如文字换行）。
   *
   * @remarks
   * 消费方据此决定缩放语义：这类内容被拖窄后会重新换行长高，若把高度一并钉成 Fixed，
   * 长出来的部分会被自己的框裁掉。未声明的 Renderer 一律返回 false。
   */
  getContentReflowsWithWidth(entity: ComposeEntity): boolean
  /**
   * 查出 Entity 可原地编辑的纯文本 Prop 名称；不可编辑时返回 null。
   *
   * @remarks
   * 消费方只需 Entity 与 Registry 即可同时得到「是否可原地编辑」（是否为 null）与
   * 「编辑哪个 Prop」（返回的名称），无需识别具体 Renderer type。Entity 没有 Renderer、
   * Renderer 未注册或该 Definition 未声明契约时一律返回 null。
   */
  getEditableTextPropName(entity: ComposeEntity): string | null
  /** 按 PascalCase Component Key 查找定义。 */
  getComponent(key: string): ComposeComponentDefinition | undefined
  /** 按 order 和注册顺序列出 Component 定义。 */
  listComponents(): readonly ComposeComponentDefinition[]
  /** 按 Preset ID 查找定义。 */
  getPreset(id: string): ComposeEntityPreset | undefined
  /** 按注册顺序列出 Entity Presets。 */
  listPresets(): readonly ComposeEntityPreset[]
  /** 按能力 ID 查找定义。 */
  getCapability(id: string): ComposeCapabilityDefinition | undefined
  /** 按注册顺序列出能力定义。 */
  listCapabilities(): readonly ComposeCapabilityDefinition[]
  /** 从 Preset 创建包含 Composition 的 Entity seed。 */
  createSeed(presetId: string): ComposeEntitySeedResult
  /** 从已解析资源创建包含 Composition 的 Entity seed。 */
  createAssetSeed(input: ComposeEntityAssetDropInput): Promise<ComposeEntitySeedResult>
  /** 列出 Entity 当前可添加或移除的全部能力状态。 */
  listCapabilityAvailability(entity: ComposeEntity): readonly ComposeCapabilityAvailability[]
  /** 将添加能力及其依赖规划为一个原子命令。 */
  planAddCapability(
    document: ComposeDocument,
    entityId: string,
    capabilityId: string,
    idFactory: () => string,
  ): ComposeCapabilityPlanResult
  /** 将移除能力及其拥有的 Components 规划为一个原子命令。 */
  planRemoveCapability(
    document: ComposeDocument,
    entityId: string,
    capabilityId: string,
    idFactory: () => string,
  ): ComposeCapabilityPlanResult
}

/** Registry 定义初始化失败。 @public */
export class ComposeEntityRegistryError extends Error {
  /** Registry 初始化错误的稳定代码。 */
  readonly code: 'registry.invalid'
  /** 无效定义所属的注册类别。 */
  readonly category: 'renderer' | 'component' | 'preset' | 'capability'
  /** 无效定义在输入数组中的索引。 */
  readonly definitionIndex: number

  /** 创建带稳定定位信息的 Registry 初始化错误。 */
  constructor(
    category: ComposeEntityRegistryError['category'],
    definitionIndex: number,
    message: string,
  ) {
    super(message)
    this.name = 'ComposeEntityRegistryError'
    this.code = 'registry.invalid'
    this.category = category
    this.definitionIndex = definitionIndex
  }
}
