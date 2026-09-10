import type { HTMLAttributes, ReactNode } from 'react'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import type { ComposeCommandDefinition, ComposeKeybinding } from '@compose-ui/commands'
import type { ComposeAngleConstraint, ComposeLayoutMeasurementPort } from '@compose-ui/core'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type { ComposePageScriptScope, ComposeScriptModuleLoader } from '@compose-ui/script-runtime'
import type {
  CommandDispatchResult,
  ComposeDocument,
  ComposeLayoutSnapshot,
  EditorCommand,
} from '@compose-ui/core'
import type {
  StageDraftingContext,
  StageDraftingEffect,
  StageEditablePath,
  StageInteractionController,
  StageInteractionModifiers,
  StageInteractionTool,
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
  /**
   * 这次按下的连击计数；只有 `start` 阶段带它。
   *
   * @remarks
   * 用来分辨「用户点了这个夹点」与「这一下只是连击中的一员」——双击进入几何编辑之后紧接着
   * 的那一下就落在刚显形、正好压在光标底下的中点夹点上。
   */
  readonly clickCount?: number
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
  | 'stage.drawContainerTool'
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
  | 'drafting.line'
  | 'drafting.polyline'
  | 'drafting.rectangle'
  | 'drafting.circle'
  | 'drafting.arc'
  | 'drafting.arrow'
  | 'drafting.wire'

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
   * 宿主级「锁定原父级」：为 true 时画布 move 手势不产生跨父级 reparent 落点高亮与
   * 结构命令，同容器重排照常；缺省时行为与既有一致。
   */
  readonly lockGestureParent?: boolean
  /** 是否显示会话级网格；不会修改文档中的网格吸附设置。 @defaultValue true */
  readonly gridVisible?: boolean
  /**
   * 是否显示变换指示器（轴把手 + 旋转圆环 + 基点标记）。
   *
   * @remarks
   * 它是 **chrome 的可见性而不是模式**：关掉时把手根本不渲染，因此那条命中永远不会到达，
   * 别处任何一次拖动的含义一个字节不变。
   *
   * Stage 不认识「动画模式」这个词——宿主在动画模式下把它打开，与 `lockGestureParent` 是同
   * 一条边界。
   *
   * @defaultValue false
   */
  readonly transformGizmo?: boolean
}

/**
 * Stage 的命令式句柄。
 *
 * @remarks
 * 只暴露**动作**，状态仍由 `onActiveCommandChange` 单向上报，两个方向因此各自单一。
 *
 * 不做成受控 prop（`pendingCommandId` + 消费握手）：那把一个事件建模成状态，同一个按钮
 * 连点两次要靠 nonce 才能再次触发，而「当前挂着一个待启动的命令」这个中间态在任何时刻都
 * 不描述真实世界的任何东西。
 *
 * @public
 */
export interface ComposeStageHandle {
  /**
   * 把视口适配到激活场景。
   *
   * @remarks
   * 与首次进入的自动适配（`autoFitActiveFrame`）走**同一条**求解：激活场景缺省或已失效时
   * 回退第一块根 Frame，留白与缩放钳制来自同一个 `fitViewportTo`。宿主自己按文档算一遍的话，
   * 同一块场景会在「居中视图」与刚进入时取到不同的取景。
   *
   * 目标缺失或求解宽高为 0 时不改变视口。
   */
  fitActiveFrame(): void
  /**
   * 启动一条命令会话。
   *
   * @remarks
   * 与在命令行里键入这个名字**完全等价**：同一条解析、同一份可用性检查、同一个会话。
   * 实现就是把 id 喂给命令行已经在用的那个启动函数——另写一份必然只实现三种拒绝里的
   * 一两种，同一条命令就会在两个入口给出不同结果。
   *
   * @param commandId - 命令 id 或别名；解析不到时命令行显示「未知命令」。
   */
  startCommand(commandId: string): void
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
   * 画布右键「添加组件」的二级菜单，由宿主注入。
   *
   * @remarks
   * Stage **不认识组件目录协议**——它不依赖 `@compose-ui/component-library`，因此注入的是
   * 「能列出什么」，菜单的呈现与落点仍住 Stage。这与既有的命令注入是同一种形状，不引入第二种
   * 机制。宿主 MUST 用喂给物料面板的**同一份**货架模型生成它，否则会出现「面板里有、菜单里
   * 没有」而用户读不出原因。
   *
   * 缺省时菜单里不出现「添加组件」这一项。
   */
  readonly addComponentMenu?: readonly ComposeStageAddComponentGroup[]
  /**
   * 用户在「添加组件」里选了一项。
   *
   * @remarks
   * `clientPoint` 是**右键那一下**的视口坐标。交给宿主而不是自己换算成世界坐标，是为了让它
   * 走与「从物料面板拖进来」完全相同的落点路径——同一件事两套实现迟早漂移。
   */
  readonly onAddComponent?: (itemId: string, clientPoint: { readonly x: number, readonly y: number }) => void
  /**
   * 宿主注入的命令定义。
   *
   * @remarks
   * 与内建的绘图/编辑命令合成**一份**词汇表：用户在命令行键入的名称在合并后的注册表里解析，
   * 因此不存在「面板里有、命令行敲不出来」的动作。
   *
   * 注入的是**定义**而不是会话：解析、启动、推进与提示渲染仍住在 Stage。合并的是「能敲
   * 什么」，不是「谁在跑」——把会话搬给宿主意味着提示文本、预览几何与捕捉标记这三种同一份
   * 状态的呈现要逐帧回传。
   *
   * 命令所需的依赖 MUST 在构造这些定义时闭包捕获，不经由启动上下文传入：上下文保持窄（文案
   * 与选择集），否则每加一条命令就要往它上面加一个绝大多数命令用不到的字段。
   *
   * 名称与内建命令重复时注册表**抛错**：重名的含义是「敲这个词该执行哪条命令无法从注册处
   * 读出」，在运行期没有正确答案，兜底只会让它推迟到用户敲下那个词时才暴露。
   */
  readonly commands?: readonly ComposeCommandDefinition<
    StageDraftingContext,
    StageDraftingEffect
  >[]
  /**
   * 当前正在跑的那条命令的 id；没有命令在跑时报 `null`。
   *
   * @remarks
   * 宿主用它渲染自己 chrome 上的按下态。事实来源在 Stage：命令会被 `Escape`、被并发文档
   * 变化、被另一条命令取代而结束，宿主自己记「我刚点了哪个」的那一份只会停在过去。
   *
   * 由手势启动的夹点会话不上报：它没有名字，也不进「重复上一条命令」的序列。
   */
  readonly onActiveCommandChange?: (commandId: string | null) => void
  /**
   * 角度约束：关 / 正交 / 极轴，三者互斥。
   *
   * @remarks
   * 它们回答的是同一个问题——这一步的方向怎么被约束。做成两个独立布尔会造出一个「都开」的
   * 第四态，而那一态没有正确答案。
   *
   * **给出即受控**，由宿主持有：工具栏要画按下态，而事实来源只能有一份，Stage 记一份、
   * 工具栏记一份必然漂移。不给时由 Stage 自己持有，默认**极轴**——它只在光标靠近某条射线时
   * 才吸，不挡任何画法，因此可以默认开着；正交无条件投影，一开就画不了斜线。
   *
   * 它是会话级视图状态，MUST NOT 写进文档：这是「怎么画」而不是「画了什么」。
   */
  readonly angleConstraint?: ComposeAngleConstraint
  readonly onAngleConstraintChange?: (next: ComposeAngleConstraint) => void
  /**
   * 极轴的增量角（度）；射线按它成族生成。
   *
   * @remarks
   * 默认 45°。这是对 AutoCAD 默认值（90°）的有意偏离，理由是前提不同：AutoCAD 的极轴默认
   * 是关的，我们默认是开的——默认开着时增量角要覆盖用户真会画的方向，而 90° 漏掉的正是接线
   * 图上那条斜引线。
   *
   * @defaultValue 45
   */
  readonly polarIncrement?: number
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
  /**
   * 是否绘制十字光标并在绘制期间隐藏系统光标。
   *
   * @remarks
   * 隐藏系统光标会一并丢掉操作系统的光标辅助设置（放大光标、高对比光标），而这一需求无法被
   * 探测——没有对应的媒体查询。因此必须留一个出口。关闭时不隐藏系统光标。
   *
   * @defaultValue true
   */
  readonly showCrosshair?: boolean
  /**
   * 十字线单侧长度占图面较短边的百分比。
   *
   * @remarks
   * 与 AutoCAD 的 `CURSORSIZE` 同义，取 100 时贯穿整个图面。
   *
   * 默认 5 直接取 AutoCAD 的 `CURSORSIZE` 默认值。曾经的 15 是为了与一块已经删掉的画布保持
   * 一致，那个理由已经不在。
   *
   * 中间试过按「臂长与拾取框的比例」去推一个值，理由是拾取框在两边都是十几个 CSS 像素的
   * 固定量、比图面百分比更可比。**那条推理没站住**：比例是从一张截图上目测的，而按它推出来
   * 的 10% 在实机上仍然明显偏长。留这段是为了让下一个想重推的人知道这条路走过了——十字光标
   * 的长度是观感问题，照抄那个久经使用的默认值比自己推一个更可靠。
   *
   * 本值是**百分比**而不是像素：AutoCAD 允许把 `CURSORSIZE` 调到 100 做跨图对齐，那条用法
   * 只有百分比表达得了。
   *
   * @defaultValue 5
   */
  readonly crosshairSize?: number
  /**
   * 拾取框的半边长（CSS 像素）。
   *
   * @remarks
   * **它只表达靶区位置，不参与任何命中判定**——判定始终由物料的 stroke 完成，框只是把同一个
   * 数画出来。
   *
   * 默认值就是 `COMPOSE_CURVE_PICK_TOLERANCE`：这一档用户选的就是曲线，而曲线的命中层宽度
   * 正是由它推出的。`PICKBOX` 在 AutoCAD 里本来也是这两件事的同一个数。框比真实容差大好几倍
   * 等于教用户瞄错。
   *
   * 它与顶点模式那一档**不为了看起来一样大而互相迁就**：那个框由夹点的命中半径派生，两档
   * 各自表达自己那一档真实抓得到的范围。夹点本来就是比发丝线更大的目标，两个框不一样大是
   * 对的。
   *
   * @defaultValue COMPOSE_CURVE_PICK_TOLERANCE
   */
  readonly pickRadius?: number
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

/**
 * 「添加组件」菜单里的一条。
 *
 * @remarks
 * `id` 由宿主定义，Stage 原样回传——它不解释这个字符串的含义。
 *
 * @public
 */
export interface ComposeStageAddComponentItem {
  readonly id: string
  readonly label: string
  /** 行首图标；省略时只有名字。 */
  readonly icon?: ReactNode
}

/**
 * 「添加组件」菜单里的一组。
 *
 * @remarks
 * 一组对应物料面板里的一段或一个子文件夹。**没有第三级**：面板里文件夹本来就是平级的一段，
 * 菜单里多套一层会让同一棵树在两处长得不一样，鼠标还要多走一次悬停。
 *
 * @public
 */
export interface ComposeStageAddComponentGroup {
  readonly id: string
  readonly title: string
  readonly items: readonly ComposeStageAddComponentItem[]
}
