import type { HTMLAttributes } from 'react'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import type { ComposeKeybinding } from '@compose-ui/commands'
import type { ComposeLayoutMeasurementPort } from '@compose-ui/core'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type { ComposePageScriptScope, ComposeScriptModuleLoader } from '@compose-ui/script-runtime'
import type {
  CommandDispatchResult,
  ComposeDocument,
  ComposeLayoutSnapshot,
  EditorCommand,
} from '@compose-ui/core'
import type {
  StageEditablePath,
  StageInteractionController,
  StageInteractionModifiers,
  StageInteractionTool,
  StageMarqueeMode,
  StagePaintEditing,
  StagePaintSampling,
  StagePathHandleKind,
  StagePoint,
  StageViewport,
} from '@compose-ui/stage-engine'

/**
 * 路径顶点或切线手柄一次拖动的阶段性结果。
 *
 * @remarks
 * `move` 供宿主更新本地预览几何；`end` 才应写成一条可撤销记录；`cancel` 表示手势被
 * 打断（Esc、并发文档变化、会话关闭），宿主应丢弃预览。坐标为世界坐标。
 * @public
 */
export interface ComposeStageEditablePathChange {
  readonly vertexId: string
  readonly handle: StagePathHandleKind
  readonly phase: 'start' | 'move' | 'end' | 'cancel'
  readonly worldPoint: StagePoint
  readonly modifiers: StageInteractionModifiers
}

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
 * @remarks
 * `@compose-ui/commands` 的 `ComposeKeybinding` 别名。此前 Stage、Editor 与 components
 * 各自声明了字段逐字相同的类型，归一化与匹配也因此分散在不同包里。
 *
 * @public
 */
export type ComposeStageKeybinding = ComposeKeybinding

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
  | 'edit.copy'
  | 'edit.cut'
  | 'edit.paste'
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
 * Stage 会话剪贴板。
 *
 * @remarks
 * 只保存规范化 Entity ID，不写入系统剪贴板。
 *
 * @public
 */
export interface ComposeStageClipboard {
  /** 复制可重复粘贴；剪切在成功移动后清空。 */
  readonly kind: 'copy' | 'cut'
  /** 已按文档顺序规范化的顶层来源。 */
  readonly entityIds: readonly string[]
}

/**
 * Stage 使用的同步命令派发边界。
 *
 * @public
 */
export type ComposeStageDispatch = (command: EditorCommand) => CommandDispatchResult

/** Stage 挂接 Renderer measurement 与手势期实时布局时需要的最小 Layout Runtime 边界。 @public */
export interface ComposeStageLayoutRuntime {
  setMeasurementPort(port: ComposeLayoutMeasurementPort | undefined): void
  /**
   * 以瞬态预览文档求解一帧布局；resize 手势期间由 Stage 以 rAF 合并驱动。
   *
   * @remarks
   * 可选能力：宿主不提供时 resize 退回「只有被拖动目标跟手、兄弟在提交后重排」的行为。
   * 求解结果经宿主回传 {@link ComposeStageProps.layoutPreviewSnapshot} 进入场景渲染，
   * 不得进入交互 Controller 的 context。
   */
  previewDocument?(document: ComposeDocument): void
  /** 结束预览并回到提交态求解结果；与 {@link ComposeStageLayoutRuntime.previewDocument} 成对。 */
  clearPreview?(): void
}

/**
 * 宿主拥有的能力端口集合。
 *
 * @remarks
 * Stage MUST 按字段消费本对象，MUST NOT 以它的引用作为场景子树或 measurement adapter 的
 * 缓存键——因此宿主重新构造 services 不会重建场景。宿主仍应在组合根记忆化，避免逐帧分配。
 *
 * 与 {@link ComposeStagePolicy} 分开是因为二者生命周期不同：端口跟随宿主能力，策略随宿主
 * 模式切换而变。合并后每次模式切换都会牵动端口，反过来也一样。
 *
 * @public
 */
export interface ComposeStageServices {
  readonly dispatch: ComposeStageDispatch
  readonly registry: ComposeEntityRegistry
  /** 资源型组件解析节点内稳定引用时使用的运行时端口。 */
  readonly assetResolver?: ComposeAssetResolver
  /** 透传给组件实例内嵌套文档的模块 Loader。 */
  readonly scriptModuleLoader?: ComposeScriptModuleLoader
  /** Controller 拥有的同会话 Runtime；Stage 用它挂接并卸载 Registry measurement adapter。 */
  readonly layoutRuntime?: ComposeStageLayoutRuntime
  /**
   * 宿主持有的会话剪贴板快照。
   *
   * @remarks
   * 省略时 Stage 使用内建内存剪贴板。Editor 传入共享快照，以便菜单根据场景树复制结果
   * 计算粘贴可用性；写入仍由 `onShortcutAction` 或 `onClipboardChange` 完成。
   */
  readonly clipboard?: ComposeStageClipboard | null
  /** 内建复制/剪切/粘贴写入剪贴板时通知宿主；省略且未提供 clipboard 时写入内部状态。 */
  readonly onClipboardChange?: (clipboard: ComposeStageClipboard | null) => void
}

/**
 * 宿主拥有事实来源、Stage 只消费的开关集合。
 *
 * @remarks
 * Stage MUST NOT 为其中任何一项持有事实来源或提供切换 UI，也不感知宿主启用它们的理由
 * （例如编辑器的动画模式）。宿主模式以组装一份 policy 表达，而不是逐项追加布尔 prop。
 *
 * @public
 */
export interface ComposeStagePolicy {
  /**
   * 框选命中判定模式；`select` 与 `marquee` 两个入口共用同一个值。
   *
   * @defaultValue 'intersect'
   */
  readonly marqueeMode?: ComposeStageMarqueeMode
  /**
   * 宿主级「锁定原父级」：为 true 时画布 move 手势不产生跨父级 reparent 落点高亮与
   * 结构命令，同容器重排照常；缺省时行为与既有一致。
   */
  readonly lockGestureParent?: boolean
  /** 是否显示会话级网格；不会修改文档中的网格吸附设置。 @defaultValue true */
  readonly gridVisible?: boolean
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
  /**
   * 手势期实时布局的预览求解结果；存在时场景按它渲染，兄弟随 resize 实时让位。
   *
   * @remarks
   * 只影响场景渲染层；交互 Controller 的 context 始终使用 `layoutSnapshot`，保证外部并发
   * 变化的手势中止判定与提交几何不受预览影响。
   */
  readonly layoutPreviewSnapshot?: ComposeLayoutSnapshot
  /** Layout Runtime 失败时显示的可读错误。 */
  readonly layoutError?: string
  /** 当前页面实例的 setup 返回作用域；Stage 只消费，不加载脚本。 */
  readonly scriptScope?: ComposePageScriptScope
  /** 宿主拥有的能力端口；引用 MUST 在会话内保持稳定。 */
  readonly services: ComposeStageServices
  /** 宿主拥有事实来源、Stage 只消费的开关；省略时各项取自身缺省值。 */
  readonly policy?: ComposeStagePolicy
  readonly viewport: StageViewport
  readonly onViewportChange: (viewport: StageViewport) => void
  readonly tool: ComposeStageTool
  /** 请求切换选择或平移工具；省略时对应快捷键不改变工具。 */
  readonly onToolChange?: (tool: ComposeStageTool) => void
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
  /**
   * 画布上的容器标题标签提交重命名。
   *
   * @remarks
   * Stage 不持有文档写权限：重命名必须由宿主用与场景树相同的命令提交，否则同一个动作会
   * 产生两种 Undo 语义。省略时标签只读，双击不进入编辑态。
   */
  readonly onEntityRename?: (entityId: string, name: string) => void
  /** 为当前规范化选区打开宿主的项目组件创建流程；省略时菜单不显示该入口。 */
  readonly onCreateComponentIntent?: (entityIds: readonly string[]) => void
  /**
   * 页面的激活场景。
   *
   * @remarks
   * 只承担回退职责：没有选择时 Frame 相关动作与辅助线以它为目标；有选择时目标始终解析为
   * 选中项最近的祖先 Frame，激活场景 MUST NOT 覆盖显式选择。
   */
  readonly activeFrameId?: string | null
  /**
   * 请求把某个场景设为激活。
   *
   * @remarks
   * Stage 不持有页面写权限：激活状态在页面文件里，必须由宿主提交。省略时标签不显示激活标记。
   */
  readonly onSceneActivate?: (frameId: string) => void
  /** 请求以某个场景为目标打开预览；省略时激活场景标签不显示播放按钮。 */
  readonly onScenePreview?: (frameId: string) => void
  /**
   * surface 可视尺寸变化回调。
   *
   * @remarks 标尺和滚动条不计入尺寸；可用于适配 Container 或选择。
   */
  readonly onSurfaceSizeChange?: (
    size: { readonly width: number; readonly height: number },
  ) => void
  /**
   * 首次布局就绪时是否自动把视口适配到激活场景。
   *
   * @remarks
   * Stage 在第一次量到真实 surface 尺寸后适配一次，使激活场景整体可见并居中；
   * `activeFrameId` 缺省或失效时回退第一块根 Frame。适配结果通过
   * {@link ComposeStageProps.onViewportChange} 发出，Stage 仍然不持有视口。
   *
   * 该适配每次挂载只发生一次：随后的编辑、选择变化与窗口缩放都不再自动改视口。
   * 宿主自己恢复上次保存的视口时应传 `false`，否则会被这次适配覆盖。
   *
   * @defaultValue true
   */
  readonly autoFitActiveFrame?: boolean
  /** 共享的 headless 交互 controller；省略时 Stage 创建私有实例。 */
  readonly interactionController?: StageInteractionController
  /** 仅当单选 Entity 的背景 Paint Inspector 打开时传入，Stage 才显示渐变画布控制柄。 */
  readonly paintEditing?: StagePaintEditing | null
  /** 仅在 Inspector 启动图层取色时传入；Stage 会暂时拦截普通选择和拖动。 */
  readonly paintSampling?: StagePaintSampling | null
  /** 图层取色点击完成后通知宿主退出临时采样模式。 */
  readonly onPaintSamplingComplete?: () => void
  /**
   * 宿主算好的世界坐标可编辑路径几何；省略时 Stage 外观与行为完全不变。
   *
   * @remarks
   * Stage 不理解该几何的文档语义（顶点 ID 不透明），只渲染轨迹、采样点与手柄并回报手势。
   * 几何的事实来源始终在宿主：`move` 阶段宿主应以更新后的几何重新传入本属性做预览。
   */
  readonly editablePath?: StageEditablePath | null
  /** 当前活动顶点；corner 顶点被激活时也显示切线手柄。 */
  readonly editablePathActiveVertexId?: string | null
  /** 路径顶点或切线手柄拖动的阶段性世界坐标回调；Stage 不因路径编辑派发任何命令。 */
  readonly onEditablePathChange?: (change: ComposeStageEditablePathChange) => void
  /** 双击路径顶点：宿主据此在 corner 与 smooth 之间切换。 */
  readonly onEditablePathVertexToggle?: (vertexId: string) => void
  /** Entity 与命令 ID factory。默认使用 crypto.randomUUID 或时间回退。 */
  readonly idFactory?: () => string
}
