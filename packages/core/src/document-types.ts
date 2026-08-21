/**
 * ComposeDocument v7 的严格 JSON、ECS Entity/Component 与派生布局公共协议。
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

/** ComposeDocument v7 内建 Component Key。 @public */
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
  frame: 'Frame',
  animations: 'Animations',
  appearance: 'Appearance',
  renderer: 'Renderer',
  bindings: 'Bindings',
} as const

/** ComposeDocument v7 内建 Component Key 联合。 @public */
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

/**
 * 一条 Frame 局部坐标辅助线。
 *
 * @remarks
 * v7 起辅助线归属 Frame 而不是文档：Frame 是坐标原点边界，世界坐标辅助线在多画板下没有意义。
 * `position` 使用所属 Frame 的局部坐标，因此移动 Frame 不会改写任何 guide。
 *
 * @public
 */
export interface ComposeFrameGuide extends JsonObject {
  readonly id: string
  readonly axis: 'x' | 'y'
  readonly position: number
}

/**
 * 编辑器视口的持久化设置。
 *
 * @remarks
 * v7 起这里只剩网格与吸附——它们是编辑辅助，不是内容。辅助线随 Frame 走，见
 * {@link ComposeFrameGuide}；输出尺寸与背景由根 Frame 自身承载。
 *
 * @public
 */
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
}

/**
 * 把 Entity 提升为独立作用域边界的 Component。
 *
 * @remarks
 * Frame 是 v7 唯一的"有尺寸的结构单元"：页面根、画板、组件根、Page Slot 目标都是 Frame。
 * 它不是新的 Entity 类型而是一个 Component——"把容器升格为画板/组件根"因此只是加一个
 * Component，Entity ID、子级与动画轨道全部原地保留，不需要换类型式的结构搬迁。
 *
 * 拥有 Frame 的 Entity MUST 同时拥有 {@link ComposeHierarchy}，并构成六重隔离边界：
 * 坐标原点、独立布局求解 Runtime、裁剪、动画时间轴、脚本作用域、预览/导出单位。
 *
 * `size` 是该 Entity 尺寸的唯一事实来源，覆盖 LayoutItem 的推导结果；因此 Frame 上不允许
 * 使用 Hug。
 *
 * @public
 */
export type ComposeFrame = JsonObject & {
  readonly size: ComposeSize
  /**
   * 该 Frame 局部坐标下的辅助线；缺省等价于空数组。
   *
   * @remarks
   * 使用 `JsonObject &` 交叉而不是 `extends JsonObject`，因为索引签名的 `JsonValue`
   * 不接受 `undefined`；{@link ComposeAppearance} 出于同样原因采用这种写法。
   */
  readonly guides?: readonly ComposeFrameGuide[]
}

/** 动画到达边界后的推进方式。 @public */
export type ComposeAnimationPlaybackMode = 'play-once' | 'loop' | 'ping-pong'

/**
 * 整条动画的播放控制到页面 setup 导出的绑定。
 *
 * @remarks
 * 播放与当前时间是**整条动画**的属性，不属于任何单个 Entity，因此挂在文档清单条目上而不是
 * Entity 的 `Animation` Component 上。引用格式复用 {@link ComposePageExportReference}，
 * 使属性面板的绑定入口与 `script-runtime` 的订阅原样可用。
 *
 * 用命名空间而不是把字段平铺到清单条目上，是为了后续加事件（`onComplete`、`onLoop`）
 * 时不再改动清单条目的顶层形状。
 *
 * @public
 */
export type ComposeAnimationBindings = JsonObject & {
  /** 布尔导出：`true` 播放、`false` 停止。 */
  readonly playing?: ComposePageExportReference
  /** 毫秒数值导出；绑定后脚本完全接管时间轴。 */
  readonly currentTime?: ComposePageExportReference
}

/**
 * 文档动画清单中的一条动画。
 *
 * @remarks
 * 这里只有动画的身份与时间属性。关键帧轨道存放在被动画 Entity 的 `Animation` Component 上，
 * 由 `@compose-ui/animation` 定义——这样复制、删除、Group 与组件继承都自动带上动画，
 * 不需要任何补偿逻辑。
 *
 * 使用 `JsonObject &` 交叉而不是 `extends JsonObject`，因为索引签名的 `JsonValue`
 * 不接受 `undefined`，而 `bindings` 是可选的；{@link ComposeAppearance} 出于同样原因
 * 采用这种写法。
 *
 * @public
 */
export type ComposeAnimation = JsonObject & {
  /** 在文档内稳定且唯一的标识。 */
  readonly id: string
  /** 用户可见的动画名称。 */
  readonly name: string
  /** 动画总时长，有限正数毫秒。 */
  readonly durationMs: number
  readonly playbackMode: ComposeAnimationPlaybackMode
  /**
   * 预览与发布输出挂载后是否自动播放。
   *
   * @remarks
   * 缺省等价于 false。`bindings.playing` 存在时脚本绑定优先，本字段被忽略——
   * 手动勾选与变量驱动是互斥的两种播放来源。
   */
  readonly autoplay?: boolean
  /** 缺省表示该动画不受任何脚本导出驱动。 */
  readonly bindings?: ComposeAnimationBindings
}

/**
 * Frame 的动画清单 Component。
 *
 * @remarks
 * v7 起动画归属 Frame 而不是文档：Frame 是动画时间轴边界，因此组件根 Frame 天然拥有自己的
 * 时间线，实例播放自己的动画。关键帧轨道仍存放在被动画 Entity 的 `Animation` Component 上，
 * 由 `@compose-ui/animation` 定义——轨道随 Entity 复制与删除的既有语义完全不变。
 *
 * 轨道所属 Entity 与清单所属 Frame 之间不得跨越任何嵌套 Frame 边界，该不变量由
 * `@compose-ui/animation` 的校验入口负责。
 *
 * @public
 */
export type ComposeAnimations = JsonObject & {
  readonly items: readonly ComposeAnimation[]
  /**
   * 该 Frame 绑定的动画文件稳定引用；未绑定时缺省。
   *
   * @remarks
   * 动画文件是静态权威：宿主打开页面时把文件里的清单水合进 `items`，保存时把 `items` 的
   * 变化回写文件。解除引用不删除文件资源。
   */
  readonly source?: {
    readonly providerId: string
    readonly assetKey: string
    readonly scope: 'persistent' | 'session'
  }
}

/** 编辑器、Stage 与 Preview 共享的 v7 ECS 文档。 @public */
export interface ComposeDocument {
  /** 当前且唯一支持的文档协议版本。 @defaultValue 7 */
  readonly schemaVersion: 7
  readonly canvas: ComposeCanvasSettings
  /**
   * 文档的根 Frame，至少一个。
   *
   * @remarks
   * v7 起根层级只接受拥有 {@link ComposeFrame} 的 Entity——多个根即多画板。v6 的隐式
   * Canvas 根与文档级 `output` 已被删除：输出尺寸、背景与原点全部由根 Frame 自身承载。
   */
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
  | 'document.empty-root'
  | 'document.root-not-frame'
  | 'canvas.invalid'
  | 'canvas.invalid-step'
  | 'canvas.invalid-offset'
  | 'canvas.invalid-primary-interval'
  | 'frame.invalid'
  | 'frame.invalid-size'
  | 'frame.invalid-guide'
  | 'frame.duplicate-guide'
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
  | 'animation.invalid'
  | 'animation.duplicate-id'
  | 'animation.invalid-duration'
  | 'animation.invalid-binding'
  | 'animation.orphan-group'

/** 一个可定位的文档校验问题。 @public */
export interface DocumentValidationIssue {
  readonly code: DocumentValidationIssueCode
  readonly path: readonly (string | number)[]
  readonly message: string
}

/** 文档校验判别结果。 @public */
export type DocumentValidationResultOf<TDocument> =
  | { readonly valid: true; readonly document: TDocument }
  | { readonly valid: false; readonly issues: readonly DocumentValidationIssue[] }

/** ComposeDocument 上的校验结果。 @public */
export type DocumentValidationResult = DocumentValidationResultOf<ComposeDocument>

/**
 * 判定并规范化一份文档。
 *
 * @remarks
 * 校验器**同时承担规范化职责**：调用方 MUST 采用返回的 `document` 而不是送入校验的那一份。
 * 事务运行时据此保存基线并计算后续 Patch，用错哪一份会让规范化在第一次 dispatch 时被
 * 悄悄回退。
 *
 * @public
 */
export type DocumentValidator<TDocument> = (input: unknown) => DocumentValidationResultOf<TDocument>

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
