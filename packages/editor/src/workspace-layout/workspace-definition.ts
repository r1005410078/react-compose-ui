import type { ComposeComponentShelf } from '@compose-ui/component-library'
import type { ComposeAngleConstraint } from '@compose-ui/core'
import type { ComposeLocale } from '@compose-ui/ui-context'
import type { ReactNode } from 'react'
import {
  DRAWING_TOOLBAR_SHELF,
  PAGE_TOOLBAR_SHELF,
} from '../stage-toolbar/toolbar-shelf'
import type { ComposeToolbarShelf } from '../stage-toolbar/toolbar-shelf'
import { WORKSPACE_PANEL_IDS } from './workspace-ids'

/**
 * 工作区布局里可以摆放的面板，用宿主看得懂的名字。
 *
 * @remarks
 * 画布不在其中：它永远在中央，宿主摆的是围着它的东西。`history` 只在宿主提供了历史控制器或
 * 显式历史面板时才真的出现，没有时从布局里静默略过。
 *
 * @public
 */
export type ComposeWorkspacePanelName =
  | 'sceneGraph'
  | 'componentLibrary'
  | 'history'
  | 'inspector'
  | 'assetBrowser'
  | 'command'
  | 'transactionLog'

/** 面板名到 Dockview 面板 id 的映射。 @internal */
export const WORKSPACE_PANEL_ID_BY_NAME: Readonly<Record<ComposeWorkspacePanelName, string>> = {
  sceneGraph: WORKSPACE_PANEL_IDS.scene,
  componentLibrary: WORKSPACE_PANEL_IDS.componentLibrary,
  history: WORKSPACE_PANEL_IDS.history,
  inspector: WORKSPACE_PANEL_IDS.inspector,
  assetBrowser: WORKSPACE_PANEL_IDS.assetBrowser,
  command: WORKSPACE_PANEL_IDS.command,
  transactionLog: WORKSPACE_PANEL_IDS.transactionLog,
}

/**
 * 用面板名描述的初始布局：画布左右两侧各一列上下堆叠的组，底部一条边缘组。
 *
 * @remarks
 * 这是宿主与内建工作区给出初始布局的方式——它**不是** Dockview 的序列化格式，因此不暴露任何
 * Dockview 成员，宿主写它也不需要认识 Dockview。用户拖过之后的样子另存为不透明快照
 * （{@link ComposeWorkspaceLayoutSnapshot}）。
 *
 * @public
 */
export interface ComposeWorkspaceLayoutPreset {
  readonly kind: 'preset'
  /** 画布左侧从上到下的组，每组是一列标签。 @defaultValue `[['sceneGraph'], ['componentLibrary', 'history']]` */
  readonly left?: readonly (readonly ComposeWorkspacePanelName[])[]
  /** 画布右侧从上到下的组。 @defaultValue `[['inspector']]` */
  readonly right?: readonly (readonly ComposeWorkspacePanelName[])[]
  /** 底部边缘组里的标签，第一个是活动标签。 @defaultValue `['assetBrowser', 'command', 'transactionLog']` */
  readonly bottom?: readonly ComposeWorkspacePanelName[]
  /** 底部边缘组初始是否折叠。 @defaultValue true */
  readonly bottomCollapsed?: boolean
  /**
   * 左栏各组的高度权重，按顺序对应 `left`；缺省第一组 60%、其余平分 40%。
   *
   * @remarks
   * 只是初值：用户拖过 sash 之后的高度进快照。
   */
  readonly leftWeights?: readonly number[]
}

/**
 * 用户拖过之后的布局快照。
 *
 * @remarks
 * 对宿主**不透明**：`data` 是 Dockview 的序列化结果，`format` 记录它出自哪个 Dockview 大版本。
 * 激活时先校验（格式一致、面板 id 全部已知、画布面板存在），不通过就丢掉快照回到 preset，
 * 不报错不阻塞——快照是「我怎么看」，坏了最多是回到默认样子。
 *
 * @public
 */
export interface ComposeWorkspaceLayoutSnapshot {
  readonly kind: 'snapshot'
  /** 快照格式；与生成它的 Dockview 大版本绑定。 */
  readonly format: string
  /** Dockview 序列化布局；宿主 MUST NOT 读写它的内部结构。 */
  readonly data: unknown
}

/** 工作区的初始布局：内建与宿主注入的多半是 preset，用户另存的是快照。 @public */
export type ComposeWorkspaceLayout = ComposeWorkspaceLayoutPreset | ComposeWorkspaceLayoutSnapshot

/**
 * 工作区持有的画布会话开关。
 *
 * @remarks
 * 这一档很薄：它们都是会话级视图状态（不进文档、不进撤销历史），工作区各记一份、切换时换入
 * 换出，让用户在某个工作区里改过之后切回来还在。网格**步长**不在这里——它是文档字段。
 *
 * @public
 */
export interface ComposeWorkspaceSession {
  readonly angleConstraint: ComposeAngleConstraint
  readonly polarIncrement: number
  readonly gridVisible: boolean
  /** 十字光标臂长，图面短边的百分比；5 是 AutoCAD `CURSORSIZE` 的默认值，100 贯穿图面。 */
  readonly crosshairSize: number
  readonly transformGizmo: boolean
}

/**
 * 新建文档时落下的默认值。
 *
 * @remarks
 * 网格步长是**文档**字段，因此工作区只能给它做种子：切换工作区不碰任何已有文档（那等于在
 * 用户没动手的时候往撤销历史里塞一条），而按下「新建」的这一下本来就在创建文档。新场景
 * 尺寸不进种子——两个内建都是 1920×1080。
 *
 * @public
 */
export interface ComposeWorkspaceSeeds {
  readonly grid: {
    readonly stepX: number
    readonly stepY: number
    readonly snapEnabled: boolean
  }
  /**
   * 对齐吸附（Figma 式参考线）的初值。
   *
   * @remarks
   * 它与**特征点捕捉**是姐妹查询：前者返回 `{axis, value}` 的参考线、后者返回落在端点上的
   * 二维点，而特征点候选**刻意不出盒的角点**正是为了避开对齐吸附的语义——两套同时生效会在
   * 同一次取点里给出互相拉扯的答案。接线图上每一次落笔都在找端子，因此绘图这一档默认关掉。
   *
   * 它只能是种子而不是会话开关：工具栏那个吸附按钮派发的是 `configureCanvas` **事务**，写的是
   * 文档，而工作区的硬边界之一正是「不写文档」。代价是打开一份已有页面再切到绘图时它仍然
   * 开着，要关只能按那个按钮——而那本来就是一次进撤销历史的文档编辑。
   */
  readonly smartSnap: {
    readonly nodes: boolean
    readonly guides: boolean
  }
}

/**
 * 一个工作区：一份布局 + 一组画布会话开关。
 *
 * @remarks
 * 它**不是模式**：定义里没有任何能改变命令集、按钮含义或快捷键的字段——宿主与用户想定制也
 * 定制不出一个模式来。它也**不绑定文档**：任何文档在任何工作区里都能打开。
 *
 * @public
 */
export interface ComposeEditorWorkspaceDefinition {
  /** 稳定标识，不本地化；切换器的动作 id、按文档记忆与偏好都按它寻址。 */
  readonly id: string
  /** 已本地化的显示名。内建两个按界面语言取文案，这里的值只是回退。 */
  readonly title: string
  readonly icon?: ReactNode
  /** hover / focus 时的提示：这个工作区会换的东西。 */
  readonly description?: string
  readonly layout: ComposeWorkspaceLayout
  /** 物料面板铺什么：标题、搜索与货架分段。缺省是面板自己的默认货架。 */
  readonly palette?: ComposeComponentShelf
  /**
   * 工具栏铺什么：按顺序排的目录 id。缺省是目录的全部项。
   *
   * @remarks
   * 它只表达顺序与有无。从货架上拿掉一格 MUST NOT 改变命令可用性——目录里的每一项都还有命令行、
   * 快捷键或命令面板中的至少一条入口，因此这个字段定制不出一个模式来。
   */
  readonly toolbar?: ComposeToolbarShelf
  readonly session: ComposeWorkspaceSession
  /** 在这个工作区里新建文档时落下的默认值。 */
  readonly seeds: ComposeWorkspaceSeeds
}

/**
 * 用户「另存为」得到的工作区：可以放进偏好里持久化的那一半定义（没有 `icon`）。
 *
 * @public
 */
export interface ComposeEditorCustomWorkspace {
  readonly id: string
  readonly title: string
  readonly layout: ComposeWorkspaceLayoutSnapshot
  readonly palette?: ComposeComponentShelf
  readonly toolbar?: ComposeToolbarShelf
  readonly session: ComposeWorkspaceSession
  readonly seeds: ComposeWorkspaceSeeds
}

/** 内建工作区「页面」的 id。 @public */
export const COMPOSE_PAGE_WORKSPACE_ID = 'page'

/** 内建工作区「绘图」的 id。 @public */
export const COMPOSE_DRAWING_WORKSPACE_ID = 'drawing'

/** 内建的默认布局：今天的四区。 @internal */
export const DEFAULT_WORKSPACE_LAYOUT_PRESET: ComposeWorkspaceLayoutPreset = {
  kind: 'preset',
  left: [['sceneGraph'], ['componentLibrary', 'history']],
  right: [['inspector']],
  bottom: ['assetBrowser', 'command', 'transactionLog'],
  bottomCollapsed: true,
}

/**
 * 绘图的默认布局：与页面同一套四区，只把工具组拉高。
 *
 * @remarks
 * 两个内建的**布局**差别只有这一处，因为差别本来就在面板与库上——绘图要铺开的是几十个符号，
 * 页面要铺开的是场景图与属性。
 */
const DRAWING_WORKSPACE_LAYOUT_PRESET: ComposeWorkspaceLayoutPreset = {
  ...DEFAULT_WORKSPACE_LAYOUT_PRESET,
  leftWeights: [0.35, 0.65],
}

/** 内建的默认会话开关：与 controller 的初值逐字相同。 @internal */
export const DEFAULT_WORKSPACE_SESSION: ComposeWorkspaceSession = {
  angleConstraint: 'polar',
  polarIncrement: 45,
  gridVisible: true,
  crosshairSize: 5,
  transformGizmo: false,
}

/**
 * 绘图的画布会话开关。
 *
 * @remarks
 * 盘完账，两个内建真正不同的只有十字光标臂长：网格今天默认就开着，角度约束与 Gizmo 两边同值。
 * 100 是贯穿图面，用于跨图对齐；页面那边的 5 是 AutoCAD `CURSORSIZE` 的默认值。
 */
const DRAWING_WORKSPACE_SESSION: ComposeWorkspaceSession = {
  ...DEFAULT_WORKSPACE_SESSION,
  crosshairSize: 100,
}

/** 页面的新建种子：8×8 网格、对齐吸附开，与 `createDefaultCanvasSettings` 逐字相同。 @internal */
export const DEFAULT_WORKSPACE_SEEDS: ComposeWorkspaceSeeds = {
  grid: { stepX: 8, stepY: 8, snapEnabled: true },
  smartSnap: { nodes: true, guides: true },
}

/**
 * 绘图的新建种子：10×10 网格，**对齐吸附关**。
 *
 * @remarks
 * 步长取 AutoCAD `SNAPUNIT` 的默认值——量过 `app/symbols/` 的 88 个端子，它们不落在任何模数上
 * （两轴同时整除 8 的 13 个、整除 10 的 0 个），因此这份数据决定不了 8 还是 10，取舍回到默认值。
 * 这不构成缺陷：落点管线是「键入 > 捕捉 > 网格 > 角度约束」且**捕捉命中即短路**，接端子靠端口
 * 捕捉，网格从来不需要够着它们。
 *
 * 网格吸附**仍然开着**：它服务的是用户徒手画的那些东西（外框、分区框、导线的自由端），
 * 那里没有任何来自符号库的约束。关掉的是对齐吸附，理由见 {@link ComposeWorkspaceSeeds.smartSnap}。
 */
const DRAWING_WORKSPACE_SEEDS: ComposeWorkspaceSeeds = {
  grid: { stepX: 10, stepY: 10, snapEnabled: true },
  smartSnap: { nodes: false, guides: false },
}

/** 页面的货架：基础组件 + 全部项目组件平铺，不带搜索（只有几项，搜索框只是占地方）。 */
const PAGE_WORKSPACE_PALETTE: ComposeComponentShelf = {
  sections: [
    { kind: 'presets', id: 'basics' },
    { kind: 'folder', id: 'components', folderPath: [] },
  ],
}

/**
 * 绘图的货架：符号库按子文件夹分组打头，项目组件其次，基础组件折叠收底。
 *
 * @remarks
 * `Symbols` 是**约定**而不是协议：项目里没有这个文件夹时那一段渲染成一行「找不到」并可去掉，
 * 与工具栏跳过未知 id 是同一条处理。选文件夹不选文件，因此往里再导十个符号不用改设置。
 */
const DRAWING_WORKSPACE_PALETTE: ComposeComponentShelf = {
  title: '符号库',
  search: true,
  sections: [
    { kind: 'folder', id: 'symbols', folderPath: ['Symbols'], groupBy: 'subfolder' },
    { kind: 'folder', id: 'components', folderPath: [] },
    { kind: 'presets', id: 'basics', collapsed: true },
  ],
}

/**
 * 内建工作区列表：页面与绘图。
 *
 * @remarks
 * 「页面」就是今天的默认布局有了个名字；「绘图」把工具的耗材铺开——符号库拉高、十字光标贯穿
 * 图面、网格种子按 CAD 取 10、对齐吸附关掉。两者的工具栏货架**不同**，因为各自要用的入口不同；
 * 这不违反「工作区不是模式」——收走的是入口，命令行、快捷键与命令面板三条路一条都没少。
 * 宿主经 `workspaces` prop 替换这份列表（`[...COMPOSE_DEFAULT_WORKSPACES, mine]`）。
 *
 * @public
 */
export const COMPOSE_DEFAULT_WORKSPACES: readonly ComposeEditorWorkspaceDefinition[] = [
  {
    id: COMPOSE_PAGE_WORKSPACE_ID,
    title: '页面',
    layout: DEFAULT_WORKSPACE_LAYOUT_PRESET,
    palette: PAGE_WORKSPACE_PALETTE,
    toolbar: PAGE_TOOLBAR_SHELF,
    session: DEFAULT_WORKSPACE_SESSION,
    seeds: DEFAULT_WORKSPACE_SEEDS,
  },
  {
    id: COMPOSE_DRAWING_WORKSPACE_ID,
    title: '绘图',
    layout: DRAWING_WORKSPACE_LAYOUT_PRESET,
    palette: DRAWING_WORKSPACE_PALETTE,
    toolbar: DRAWING_TOOLBAR_SHELF,
    session: DRAWING_WORKSPACE_SESSION,
    seeds: DRAWING_WORKSPACE_SEEDS,
  },
]

/** 内建工作区的本地化标题；定义里的 `title` 只是回退。 */
const BUILTIN_TITLES: Readonly<Record<string, Readonly<Record<ComposeLocale, string>>>> = {
  [COMPOSE_PAGE_WORKSPACE_ID]: { 'zh-CN': '页面', 'en-US': 'Page' },
  [COMPOSE_DRAWING_WORKSPACE_ID]: { 'zh-CN': '绘图', 'en-US': 'Drawing' },
}

/** 内建工作区的本地化说明：hover / focus 时说这个工作区会换的东西。 */
const BUILTIN_DESCRIPTIONS: Readonly<Record<string, Readonly<Record<ComposeLocale, string>>>> = {
  [COMPOSE_PAGE_WORKSPACE_ID]: {
    'zh-CN': '面板：场景图、基础组件、属性、资源。新建页面网格 8。',
    'en-US': 'Panels: scene, basics, inspector, assets. New pages use an 8px grid.',
  },
  [COMPOSE_DRAWING_WORKSPACE_ID]: {
    'zh-CN': '面板：场景图、符号库（拉高）、属性。十字光标贯穿图面，新建页面网格 10。',
    'en-US': 'Panels: scene, symbol library (taller), inspector. Full-canvas crosshair, new pages use a 10px grid.',
  },
}

/** 内建工作区物料面板的本地化标题；宿主注入的用它自己的 `palette.title`。 */
const BUILTIN_PALETTE_TITLES: Readonly<Record<string, Readonly<Record<ComposeLocale, string>>>> = {
  [COMPOSE_DRAWING_WORKSPACE_ID]: { 'zh-CN': '符号库', 'en-US': 'Symbols' },
}

/** 取工作区的显示名：内建按界面语言，其余用定义里的。 @internal */
export function resolveWorkspaceTitle(
  workspace: Pick<ComposeEditorWorkspaceDefinition, 'id' | 'title'>,
  locale: ComposeLocale,
) {
  return BUILTIN_TITLES[workspace.id]?.[locale] ?? workspace.title
}

/** 取工作区的说明；内建按界面语言，其余用定义里的。 @internal */
export function resolveWorkspaceDescription(
  workspace: Pick<ComposeEditorWorkspaceDefinition, 'id' | 'description'>,
  locale: ComposeLocale,
) {
  return BUILTIN_DESCRIPTIONS[workspace.id]?.[locale] ?? workspace.description
}

/**
 * 取物料面板的标题：它同时是面板的可访问名与 Dockview 上的标签名。
 *
 * @remarks
 * 标签上已经写着这个名字，因此面板内部**不再画第二遍**——那正是绘图要省下来给符号的那几行
 * 竖直空间。`fallback` 由调用方给出（页面那份货架不写标题，用的就是它）。
 *
 * @internal
 */
export function resolveWorkspacePaletteTitle(
  workspace: Pick<ComposeEditorWorkspaceDefinition, 'id' | 'palette'>,
  locale: ComposeLocale,
  fallback: string,
) {
  return BUILTIN_PALETTE_TITLES[workspace.id]?.[locale] ?? workspace.palette?.title ?? fallback
}

/**
 * 把宿主注入（或内建）的列表与用户另存的合成一份。
 *
 * @remarks
 * 宿主列表里 `id` 重名 MUST 抛错：丢弃后来的会让宿主工作区静默消失，覆盖先前的会让内建被
 * 意外改写，两者都要等用户去点才暴露；重名的含义是「这个 id 该指向哪个工作区无法从注入处
 * 读出」，运行期没有正确答案。用户另存的与宿主撞 id 时**跳过用户那一个**——它出自偏好，而
 * 偏好里的东西不该让挂载崩掉。
 *
 * @internal
 */
export function resolveWorkspaceList(
  injected: readonly ComposeEditorWorkspaceDefinition[],
  custom: readonly ComposeEditorCustomWorkspace[],
): readonly ComposeEditorWorkspaceDefinition[] {
  const seen = new Set<string>()
  for (const workspace of injected) {
    if (seen.has(workspace.id)) {
      throw new Error(`ComposeEditor: duplicate workspace id "${workspace.id}"`)
    }
    seen.add(workspace.id)
  }
  const result = [...injected]
  for (const workspace of custom) {
    if (seen.has(workspace.id)) continue
    seen.add(workspace.id)
    result.push(workspace)
  }
  return result
}

/** 内建或宿主注入的工作区：不可删、不可重命名，重置回到定义自带的布局。 @internal */
export function isInjectedWorkspace(
  injected: readonly ComposeEditorWorkspaceDefinition[],
  id: string,
) {
  return injected.some((workspace) => workspace.id === id)
}
