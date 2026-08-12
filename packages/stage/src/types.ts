import type { HTMLAttributes } from 'react'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import type { ComposeLayoutMeasurementPort, ComposePageDocumentLoader } from '@compose-ui/core'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type { ComposePageScriptScope, ComposeScriptModuleLoader } from '@compose-ui/script-runtime'
import type {
  CommandDispatchResult,
  ComposeDocument,
  ComposeLayoutSnapshot,
  EditorCommand,
} from '@compose-ui/core'
import type {
  StageInteractionController,
  StageInteractionTool,
  StageMarqueeMode,
  StagePaintEditing,
  StagePaintSampling,
  StageViewport,
} from '@compose-ui/stage-engine'

/**
 * Stage 的受控工具模式。
 *
 * @public
 */
export type ComposeStageTool = StageInteractionTool

/**
 * Stage 的受控框选判定模式。
 *
 * @public
 */
export type ComposeStageMarqueeMode = StageMarqueeMode

/**
 * Stage 可配置的单次键位。
 *
 * @public
 */
export interface ComposeStageKeybinding {
  /** `KeyboardEvent.code` 物理键位。 */
  readonly code: string
  /** macOS 使用 Command，其他平台使用 Control。 */
  readonly primary?: boolean
  /** 所有平台都明确使用 Control。 */
  readonly control?: boolean
  /** 是否要求 Shift。 */
  readonly shift?: boolean
  /** 是否要求 Alt/Option。 */
  readonly alt?: boolean
}

/**
 * Stage 可修改快捷键动作。
 *
 * @public
 */
export type ComposeStageShortcutAction =
  | 'stage.temporaryPan'
  | 'stage.selectTool'
  | 'stage.moveTool'
  | 'stage.scaleTool'
  | 'stage.rotateTool'
  | 'stage.panTool'
  | 'stage.drawContainerTool'
  | 'stage.drawRectangleTool'
  | 'stage.drawLineTool'
  | 'stage.drawArrowTool'
  | 'stage.drawCircleTool'
  | 'stage.drawTextTool'
  | 'stage.fitSelection'
  | 'stage.fitContainer'
  | 'stage.zoomReset'
  | 'stage.zoomIn'
  | 'stage.zoomOut'
  | 'stage.toggleGridSnap'
  | 'stage.toggleSmartSnap'
  | 'edit.duplicate'
  | 'edit.bringForward'
  | 'edit.sendBackward'
  | 'edit.bringToFront'
  | 'edit.sendToBack'
  | 'edit.group'
  | 'edit.ungroup'
  | 'edit.delete'

/**
 * 可由宿主接管的 Stage 动作。
 *
 * @remarks
 * 临时平移是按住不放的手势，其按下与松开必须由 Stage 的手势生命周期成对处理，
 * 因此不在可接管范围内。
 *
 * @public
 */
export type ComposeStageDelegatableAction = Exclude<
  ComposeStageShortcutAction,
  'stage.temporaryPan'
>

/**
 * Stage 动作到一个或多个单次键位的覆盖配置。
 *
 * @public
 */
export type ComposeStageShortcuts = Readonly<
  Partial<Record<ComposeStageShortcutAction, readonly ComposeStageKeybinding[]>>
>

/**
 * Stage 使用的同步命令派发边界。
 *
 * @public
 */
export type ComposeStageDispatch = (command: EditorCommand) => CommandDispatchResult

/** Stage 挂接 Renderer measurement 时需要的最小 Layout Runtime 边界。 @public */
export interface ComposeStageLayoutRuntime {
  setMeasurementPort(port: ComposeLayoutMeasurementPort | undefined): void
}

/**
 * 受控无限 Stage 属性。
 *
 * @public
 */
export interface ComposeStageProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  readonly document: ComposeDocument
  /** 与 document 对应的布局结果；加载期间省略并显示禁用态。 */
  readonly layoutSnapshot?: ComposeLayoutSnapshot
  /** Layout Runtime 失败时显示的可读错误。 */
  readonly layoutError?: string
  /** Controller 拥有的同会话 Runtime；Stage 用它挂接并卸载 Registry measurement adapter。 */
  readonly layoutRuntime?: ComposeStageLayoutRuntime
  readonly registry: ComposeEntityRegistry
  /** 资源型组件解析节点内稳定引用时使用的运行时端口。 */
  readonly assetResolver?: ComposeAssetResolver
  /**
   * 页面型物料使用的文档加载端口。
   *
   * @remarks
   * Stage 不实现页面加载或嵌套渲染，只把端口交给物料；未注入时相关实体呈现占位状态。
   */
  readonly pageLoader?: ComposePageDocumentLoader
  /** 当前页面实例的 setup 返回作用域；Stage 只消费，不加载脚本。 */
  readonly scriptScope?: ComposePageScriptScope
  /** 透传给嵌套 Page Slot 的模块 Loader。 */
  readonly scriptModuleLoader?: ComposeScriptModuleLoader
  readonly dispatch: ComposeStageDispatch
  readonly viewport: StageViewport
  readonly onViewportChange: (viewport: StageViewport) => void
  /** 是否显示会话级网格；不会修改文档中的网格吸附设置。 @defaultValue true */
  readonly gridVisible?: boolean
  readonly tool: ComposeStageTool
  /** 请求切换选择或平移工具；省略时对应快捷键不改变工具。 */
  readonly onToolChange?: (tool: ComposeStageTool) => void
  /**
   * 框选命中判定模式；`select` 与 `marquee` 两个入口共用同一个值。
   *
   * @remarks
   * Stage 只消费该值，模式的事实来源由宿主持有——Stage 自身没有切换模式的 UI。
   * @defaultValue 'intersect'
   */
  readonly marqueeMode?: ComposeStageMarqueeMode
  /** 覆盖 Stage 默认动作键位；动作空数组表示禁用。 */
  readonly shortcuts?: ComposeStageShortcuts
  /**
   * 由宿主接管可配置动作的执行。
   *
   * @remarks
   * 命中动作时 Stage 先调用该回调。返回 `true` 表示宿主已执行，Stage 阻止默认行为并停止
   * 内建处理；返回 `false` 或未提供该属性时 Stage 走内建实现。宿主可据此让键盘、工具栏与
   * 命令面板共用同一份动作实现，避免同一动作出现多套行为。
   *
   * 临时平移、Escape 取消与方向键微调不参与接管。
   */
  readonly onShortcutAction?: (action: ComposeStageDelegatableAction) => boolean
  readonly selectedIds: readonly string[]
  readonly onSelectedIdsChange: (ids: readonly string[]) => void
  /** 为当前规范化选区打开宿主的项目组件创建流程；省略时菜单不显示该入口。 */
  readonly onCreateComponentIntent?: (entityIds: readonly string[]) => void
  /** 隐式 Canvas 输出区域当前是否为 Inspector 目标。 */
  readonly outputSelected?: boolean
  /** 请求清空节点选择并检查隐式 Canvas 输出属性。 */
  readonly onOutputSelect?: () => void
  /**
   * surface 可视尺寸变化回调。
   *
   * @remarks 标尺和滚动条不计入尺寸；可用于适配 Container 或选择。
   */
  readonly onSurfaceSizeChange?: (
    size: { readonly width: number; readonly height: number },
  ) => void
  /** 共享的 headless 交互 controller；省略时 Stage 创建私有实例。 */
  readonly interactionController?: StageInteractionController
  /** 仅当单选 Entity 的背景 Paint Inspector 打开时传入，Stage 才显示渐变画布控制柄。 */
  readonly paintEditing?: StagePaintEditing | null
  /** 仅在 Inspector 启动图层取色时传入；Stage 会暂时拦截普通选择和拖动。 */
  readonly paintSampling?: StagePaintSampling | null
  /** 图层取色点击完成后通知宿主退出临时采样模式。 */
  readonly onPaintSamplingComplete?: () => void
  /** Entity 与命令 ID factory。默认使用 crypto.randomUUID 或时间回退。 */
  readonly idFactory?: () => string
}
