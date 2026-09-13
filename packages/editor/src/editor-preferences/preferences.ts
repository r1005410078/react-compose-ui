import {
  normalizeComposeKeybinding,
  serializeComposeKeybinding,
} from '@compose-ui/commands'
import type { ComposeKeybinding } from '@compose-ui/commands'
import { DEFAULT_STAGE_SHORTCUTS } from '@compose-ui/stage'
import type { ComposeCanvasCrosshairStyle } from '@compose-ui/stage'
import type { ComposeComponentLibraryMode } from '@compose-ui/component-library'
import type { ComposeLocale, ComposeTheme } from '@compose-ui/ui-context'
import { formatComposeKeybinding } from '@compose-ui/components'
import type {
  ComposeEditorCustomWorkspace,
  ComposeWorkspaceLayoutSnapshot,
} from '../workspace-layout/workspace-definition'
import { COMPOSE_PAGE_WORKSPACE_ID, DEFAULT_WORKSPACE_SEEDS } from '../workspace-layout/workspace-definition'
import type { ComposeWorkspaceSeeds } from '../workspace-layout/workspace-definition'
import type { ComposeToolbarShelf } from '../stage-toolbar/toolbar-shelf'
import type { ComposeComponentShelf } from '@compose-ui/component-library'

/**
 * 可由设置面板修改的编辑器动作。
 *
 * @public
 */
export type ComposeEditorShortcutAction =
  | 'editor.settings'
  | 'document.save'
  | 'document.toggleAnimationMode'
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
  | 'stage.canvasSettings'
  | 'stage.toggleTransformGizmo'
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
  | 'edit.createComponent'
  | 'scene.create'
  | 'edit.delete'
  | 'history.undo'
  | 'history.redo'
  | 'workspace.next'
  | 'workspace.previous'
  | 'workspace.focusCanvas'
  | 'workspace.saveAs'
  | 'workspace.reset'

/**
 * 单次键盘按键或组合键。
 *
 * @remarks
 * `@compose-ui/commands` 的 `ComposeKeybinding` 别名。`code` 使用 `KeyboardEvent.code`；
 * `primary` 接受 Command 或 Control，展示时按平台格式化。
 *
 * @public
 */
export type ComposeEditorKeybinding = ComposeKeybinding

/**
 * 当前 ComposeEditor 实例的完整用户偏好。
 *
 * @public
 */
export interface ComposeEditorPreferences {
  /** 明确主题或跟随系统主题。 */
  readonly theme: ComposeTheme
  /** 内建工作区界面语言。 */
  readonly locale: ComposeLocale
  /** 每个可修改动作的单次键位列表；空列表表示禁用动作。 */
  readonly shortcuts: Readonly<
    Record<ComposeEditorShortcutAction, readonly ComposeEditorKeybinding[]>
  >
  /** 工作区：上次用的、按文档的记忆、拖过的布局与用户另存的工作区。 */
  readonly workspace: ComposeEditorWorkspacePreferences
  /**
   * 物料面板的排法：网格还是一行一个。
   *
   * @remarks
   * 与工作区那一半同族——它回答「我想怎么看」，不改变文档里画了什么，因此不写文档、不进撤销
   * 历史。默认网格：物料是图形，扫形状比读一列名字快。
   */
  readonly palette: ComposeEditorPalettePreferences
  /**
   * 十字光标的画笔样式：`fade` 渐隐、`halo` 晕圈。
   *
   * @remarks
   * 与主题、语言同一档的**用户偏好**，不是工作区会话开关：晕圈在页面与绘图里都是晕圈，
   * 没有按工作区分歧的场景；做成会话开关会让每个另存的工作区多抄一个字段。它不写文档、
   * 不进撤销历史。臂长（`crosshairSize`）仍归工作区。
   *
   * @defaultValue `'fade'`
   */
  readonly crosshairStyle: ComposeEditorCrosshairStyle
  /**
   * 是否显示世界坐标轴与原点标记。
   *
   * @remarks
   * 与十字光标样式同一档的**用户偏好**，不是工作区会话开关：三个内建工作区的画布表现刚刚
   * 被统一过，再加一个按工作区分叉的开关会重演同一个困惑。
   *
   * 坐标轴贯穿全图且永远在，而十字光标只在取点时出现——两者在屏幕上难以区分，这正是本开关
   * 存在的理由。它同时管两条轴线与原点标记：两者回答同一个问题。
   *
   * @defaultValue true
   */
  readonly showWorldAxes: boolean
  /**
   * 十字光标单侧长度占图面短边的百分比，**1 到 100 的整数**。
   *
   * @remarks
   * **整条照抄 AutoCAD 的 `CURSORSIZE`**：同样的取值范围、同样的「占屏幕尺寸的百分比」
   * 语义、同样的默认值 5，选项对话框里同样配一个数值框加滑块。5 是几十年密集图纸用出来的
   * 值，而十字线的长度是观感问题——照抄那个久经使用的默认值比自己推一个更可靠。
   *
   * 它是长度的**唯一**事实来源——工作区会话开关不再携带臂长。同一个数有两处来源时，界面上
   * 改了一处而另一处覆盖回去，用户读到的是「设置没生效」。
   *
   * 与画笔样式（`crosshairStyle`）是**两个正交的维度**：画笔管线怎么画，长度管线多长。设置
   * 面板里必须分成两组各自带说明——把它们混在一组里，用户会把「渐隐 / 晕圈」读成长短。
   *
   * @defaultValue 5
   */
  readonly crosshairSize: number
}

/** 十字光标长度的取值范围，与 AutoCAD `CURSORSIZE` 相同。 @public */
export const COMPOSE_CROSSHAIR_SIZE_RANGE = { min: 1, max: 100 } as const

/** 十字光标长度的默认值，同样照抄 AutoCAD `CURSORSIZE`。 @public */
export const COMPOSE_CROSSHAIR_SIZE_DEFAULT = 5

/** 十字光标样式；与 Stage 的 prop 同一个联合。 @public */
export type ComposeEditorCrosshairStyle = ComposeCanvasCrosshairStyle

/** 偏好里的物料面板那一半。 @public */
export interface ComposeEditorPalettePreferences {
  /** 排法；默认 `'grid'`。 */
  readonly mode: ComposeComponentLibraryMode
}

/**
 * 偏好里的工作区那一半。
 *
 * @remarks
 * 全部是「我怎么看」：不进文档、不进撤销历史，经 `onPreferencesChange` 交给宿主持久化。
 * 引用了不存在工作区的条目在规范化时**保留**、在使用时回退——宿主换掉注入的列表不该让整份
 * 偏好作废。
 *
 * @public
 */
export interface ComposeEditorWorkspacePreferences {
  /** 上次激活的工作区 id；找不到时回退列表第一个。 */
  readonly lastUsed: string
  /** 文档 key → 上次在哪个工作区里编辑它。 */
  readonly byDocument: Readonly<Record<string, string>>
  /** 工作区 id → 用户拖过之后的布局快照；缺席即定义自带的布局。 */
  readonly layouts: Readonly<Record<string, ComposeWorkspaceLayoutSnapshot>>
  /** 工作区 id → 用户改过的工具栏货架；缺席即定义自带的那条。 */
  readonly toolbars: Readonly<Record<string, ComposeToolbarShelf>>
  /** 工作区 id → 用户改过的物料货架；缺席即定义自带的那份。 */
  readonly palettes: Readonly<Record<string, ComposeComponentShelf>>
  /** 用户「另存为」的工作区。 */
  readonly custom: readonly ComposeEditorCustomWorkspace[]
}

export type ComposeEditorShortcutScope = 'editor' | 'stage' | 'history'

export const COMPOSE_EDITOR_SHORTCUT_ACTIONS = [
  'editor.settings',
  'document.save',
  'document.toggleAnimationMode',
  'stage.temporaryPan',
  'stage.selectTool',
  'stage.drawContainerTool',
  'stage.drawTextTool',
  'stage.fitSelection',
  'stage.fitContainer',
  'stage.zoomReset',
  'stage.zoomIn',
  'stage.zoomOut',
  'stage.toggleGridSnap',
  'stage.canvasSettings',
  'stage.toggleTransformGizmo',
  'stage.toggleSmartSnap',
  'edit.duplicate',
  'edit.copy',
  'edit.cut',
  'edit.paste',
  'edit.bringForward',
  'edit.sendBackward',
  'edit.bringToFront',
  'edit.sendToBack',
  'edit.group',
  'edit.ungroup',
  'edit.createComponent',
  'scene.create',
  'edit.delete',
  'history.undo',
  'history.redo',
  'workspace.next',
  'workspace.previous',
  'workspace.focusCanvas',
  'workspace.saveAs',
  'workspace.reset',
] as const satisfies readonly ComposeEditorShortcutAction[]

export const COMPOSE_EDITOR_SHORTCUT_SCOPES: Readonly<
  Record<ComposeEditorShortcutAction, ComposeEditorShortcutScope>
> = {
  'editor.settings': 'editor',
  'document.save': 'editor',
  'document.toggleAnimationMode': 'editor',
  'stage.temporaryPan': 'stage',
  'stage.selectTool': 'stage',
  'stage.drawContainerTool': 'stage',
  'stage.drawTextTool': 'stage',
  'stage.fitSelection': 'stage',
  'stage.fitContainer': 'stage',
  'stage.zoomReset': 'stage',
  'stage.zoomIn': 'stage',
  'stage.zoomOut': 'stage',
  'stage.toggleGridSnap': 'stage',
  'stage.canvasSettings': 'stage',
  'stage.toggleTransformGizmo': 'stage',
  'stage.toggleSmartSnap': 'stage',
  'edit.duplicate': 'stage',
  'edit.copy': 'stage',
  'edit.cut': 'stage',
  'edit.paste': 'stage',
  'edit.bringForward': 'stage',
  'edit.sendBackward': 'stage',
  'edit.bringToFront': 'stage',
  'edit.sendToBack': 'stage',
  'edit.group': 'stage',
  'edit.ungroup': 'stage',
  'edit.createComponent': 'stage',
  'scene.create': 'stage',
  'edit.delete': 'stage',
  'history.undo': 'history',
  'history.redo': 'history',
  'workspace.next': 'editor',
  'workspace.previous': 'editor',
  'workspace.focusCanvas': 'editor',
  'workspace.saveAs': 'editor',
  'workspace.reset': 'editor',
}

/**
 * 创建互不共享引用的默认工作区偏好：上次用的是「页面」，没有任何记忆与快照。
 *
 * @public
 */
export function createDefaultComposeEditorWorkspacePreferences(): ComposeEditorWorkspacePreferences {
  return {
    lastUsed: COMPOSE_PAGE_WORKSPACE_ID,
    byDocument: {},
    layouts: {},
    toolbars: {},
    palettes: {},
    custom: [],
  }
}

/**
 * 创建互不共享引用的默认编辑器偏好。
 *
 * @returns Dark、简体中文及标准平台快捷键配置。
 * @public
 */
export function createDefaultComposeEditorPreferences(): ComposeEditorPreferences {
  return {
    theme: 'dark',
    locale: 'zh-CN',
    // Stage 的 30 项由 Stage 自己给出，这里只补 Editor 独有的动作。此前两份表逐字重复，
    // 靠人工同步维持一致且没有任何测试守住。
    shortcuts: cloneShortcutMap({
      ...DEFAULT_STAGE_SHORTCUTS,
      'editor.settings': [{ code: 'Comma', primary: true }],
      /*
       * 保存过去是硬接在 `compose-editor.tsx` 的按键处理里的：那个键既不出现在命令面板，
       * 用户也没法在键位页里改。它进目录之后这里就是它默认键位的唯一来源。
       */
      'document.save': [{ code: 'KeyS', primary: true }],
      // 模式切换默认不绑键：它有工具栏行尾那个常驻控件，进目录只是为了让键盘够得着。
      'document.toggleAnimationMode': [],
      'edit.createComponent': [],
      'scene.create': [],
      // 画布设置默认不绑键：它是偶尔用一次的入口，而裸字母与常用组合都已经被占着。它进目录
      // 是为了让命令面板够得着——那正是「货架不得成为唯一入口」对网格那一格的要求。
      'stage.canvasSettings': [],
      // 指示器同样默认不绑键：进目录是为了让它有第二条入口，不是为了多一个键位。
      'stage.toggleTransformGizmo': [],
      'history.undo': [{ code: 'KeyZ', primary: true }],
      'history.redo': [
        { code: 'KeyZ', primary: true, shift: true },
        { code: 'KeyY', control: true },
      ],
      // 工作区动作默认不绑键：`Ctrl+PageUp/Down` 在浏览器里是切标签页，拦不住；
      // 一个默认就失效的键位比没有更差。
      'workspace.next': [],
      'workspace.previous': [],
      'workspace.focusCanvas': [],
      'workspace.saveAs': [],
      'workspace.reset': [],
    }),
    workspace: createDefaultComposeEditorWorkspacePreferences(),
    palette: { mode: 'grid' },
    crosshairStyle: 'fade',
    showWorldAxes: true,
    crosshairSize: 5,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSnapshot(value: unknown): value is ComposeWorkspaceLayoutSnapshot {
  return isRecord(value) && value.kind === 'snapshot' && typeof value.format === 'string' && 'data' in value
}

function isCustomWorkspace(value: unknown): value is ComposeEditorCustomWorkspace {
  return isRecord(value)
    && typeof value.id === 'string' && value.id !== ''
    && typeof value.title === 'string'
    && isSnapshot(value.layout)
    && isRecord(value.session)
}

/**
 * 补齐一份可能来自旧偏好的种子。
 *
 * @remarks
 * `seeds` 与它里面的 `smartSnap` 是**分两次**加进来的，因此存量偏好有三种形状：整个 `seeds`
 * 缺席、只有 `grid`、两样都有。逐层回退而不是整份丢弃——用户另存的工作区不该因为多了一个
 * 字段就退回页面的网格步长。
 */
function normalizeSeeds(value: unknown): ComposeWorkspaceSeeds {
  if (!isRecord(value)) return DEFAULT_WORKSPACE_SEEDS
  return {
    grid: isRecord(value.grid)
      ? { ...DEFAULT_WORKSPACE_SEEDS.grid, ...value.grid } as ComposeWorkspaceSeeds['grid']
      : DEFAULT_WORKSPACE_SEEDS.grid,
    smartSnap: isRecord(value.smartSnap)
      ? { ...DEFAULT_WORKSPACE_SEEDS.smartSnap, ...value.smartSnap } as ComposeWorkspaceSeeds['smartSnap']
      : DEFAULT_WORKSPACE_SEEDS.smartSnap,
  }
}

/**
 * 规范化偏好里的工作区那一半：缺席的字段按默认补齐，形状不对的条目丢掉，引用了不存在工作区
 * 的条目保留。
 *
 * @internal
 */
export function normalizeComposeEditorWorkspacePreferences(
  input: unknown,
): ComposeEditorWorkspacePreferences {
  const defaults = createDefaultComposeEditorWorkspacePreferences()
  if (!isRecord(input)) return defaults
  const lastUsed = typeof input.lastUsed === 'string' && input.lastUsed !== ''
    ? input.lastUsed
    : defaults.lastUsed
  const byDocument = isRecord(input.byDocument)
    ? Object.fromEntries(Object.entries(input.byDocument)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== ''))
    : {}
  const layouts = isRecord(input.layouts)
    ? Object.fromEntries(Object.entries(input.layouts)
      .filter((entry): entry is [string, ComposeWorkspaceLayoutSnapshot] => isSnapshot(entry[1])))
    : {}
  const custom = Array.isArray(input.custom)
    ? input.custom.filter(isCustomWorkspace).map((workspace) => ({
        id: workspace.id,
        title: workspace.title,
        layout: workspace.layout,
        // 货架与种子是后加的字段：偏好里没有的那份按页面的默认值补齐，而不是丢掉整个工作区。
        palette: workspace.palette,
        /*
         * 两条货架都要抄。这里逐字段重建而不是整份透传（其余字段要挡形状不对的偏好），因此
         * 漏掉一条的症状很隐蔽：另存为当场看着是对的，直到偏好走一趟归一化，那个工作区的
         * 工具栏就退回**目录全集**——既不是它另存时的样子，也不是任何一条内建货架。
         */
        toolbar: workspace.toolbar,
        session: workspace.session,
        seeds: normalizeSeeds(workspace.seeds),
      }))
    : []
  /*
   * 货架的形状由各自的类型守卫挡：偏好是宿主持久化的，可能来自手写、来自旧版本、来自别人
   * 导出的一份。形状不对的**那一条**丢掉而不是整份作废——用户只该失去自己改坏的那一个工作区
   * 的货架，不是全部。
   */
  const toolbars = isRecord(input.toolbars)
    ? Object.fromEntries(Object.entries(input.toolbars)
      .filter((entry): entry is [string, ComposeToolbarShelf] => (
        Array.isArray(entry[1]) && entry[1].every((id) => typeof id === 'string')
      )))
    : {}
  const palettes = isRecord(input.palettes)
    ? Object.fromEntries(Object.entries(input.palettes)
      .filter((entry): entry is [string, ComposeComponentShelf] => (
        isRecord(entry[1]) && Array.isArray((entry[1] as { sections?: unknown }).sections)
      )))
    : {}
  return { lastUsed, byDocument, layouts, toolbars, palettes, custom }
}


/**
 * 把任意输入钳成合法的十字光标长度。
 *
 * @remarks
 * 缺席或非有限数回落**默认值**而不是钳到范围端点：`NaN` 表达的是「这不是一个数」，把它当成
 * 最小值或最大值都是替用户做了一个他没表达过的选择，而默认值至少是这个字段的既定答案。
 */
function normalizeCrosshairSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return COMPOSE_CROSSHAIR_SIZE_DEFAULT
  return Math.min(
    COMPOSE_CROSSHAIR_SIZE_RANGE.max,
    Math.max(COMPOSE_CROSSHAIR_SIZE_RANGE.min, Math.round(value)),
  )
}

export function normalizeComposeEditorPreferences(
  preferences: ComposeEditorPreferences,
): ComposeEditorPreferences {
  const defaults = createDefaultComposeEditorPreferences()
  const theme = preferences.theme === 'light' || preferences.theme === 'system'
    ? preferences.theme
    : 'dark'
  const locale = preferences.locale === 'en-US' ? 'en-US' : 'zh-CN'
  const inputShortcuts = preferences.shortcuts as Partial<
    Record<ComposeEditorShortcutAction, readonly ComposeEditorKeybinding[]>
  >
  const shortcuts = Object.fromEntries(
    COMPOSE_EDITOR_SHORTCUT_ACTIONS.map((action) => {
      const bindings = inputShortcuts[action] ?? defaults.shortcuts[action]
      const normalized = bindings.map(normalizeComposeEditorKeybinding)
      return [
        action,
        normalized.filter((binding, index) =>
          normalized.findIndex((candidate) =>
            serializeComposeKeybinding(candidate) === serializeComposeKeybinding(binding)) === index),
      ]
    }),
  ) as unknown as ComposeEditorPreferences['shortcuts']

  return {
    theme,
    locale,
    shortcuts,
    workspace: normalizeComposeEditorWorkspacePreferences(
      (preferences as Partial<ComposeEditorPreferences>).workspace,
    ),
    // 存量偏好里没有这一段，缺席即网格。
    palette: {
      mode: (preferences as Partial<ComposeEditorPreferences>).palette?.mode === 'list' ? 'list' : 'grid',
    },
    // 同样是后加的字段：缺席或不认识的值一律回落渐隐。
    crosshairStyle: (preferences as Partial<ComposeEditorPreferences>).crosshairStyle === 'halo'
      ? 'halo'
      : 'fade',
    // 同样是后加的字段：缺席或不是布尔一律回落显示，保持既有画面。
    showWorldAxes: (preferences as Partial<ComposeEditorPreferences>).showWorldAxes !== false,
    // 同样是后加的字段：缺席、非有限数或越界都钳进 [1,100] 并取整，缺席回落贯穿图面。
    crosshairSize: normalizeCrosshairSize(
      (preferences as Partial<ComposeEditorPreferences>).crosshairSize,
    ),
  }
}

export function normalizeComposeEditorKeybinding(
  binding: ComposeEditorKeybinding,
): ComposeEditorKeybinding {
  return normalizeComposeKeybinding(binding)
}

export function isComposeEditorKeybindingMatch(
  event: Pick<
    KeyboardEvent,
    'altKey' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey'
  >,
  binding: ComposeEditorKeybinding,
  platform: string,
) {
  const mac = isMacPlatform(platform)
  const primaryPressed = mac
    ? event.metaKey || event.ctrlKey
    : event.ctrlKey || event.metaKey
  const modifierMatches = binding.primary
    ? primaryPressed && event.ctrlKey !== event.metaKey
    : event.ctrlKey === Boolean(binding.control) && !event.metaKey

  return event.code === binding.code
    && modifierMatches
    && event.shiftKey === Boolean(binding.shift)
    && event.altKey === Boolean(binding.alt)
}

export function formatComposeEditorKeybinding(
  binding: ComposeEditorKeybinding,
  platform: string,
) {
  return formatComposeKeybinding(binding, platform)
}

export function findComposeEditorShortcutConflict(
  shortcuts: ComposeEditorPreferences['shortcuts'],
  action: ComposeEditorShortcutAction,
  binding: ComposeEditorKeybinding,
) {
  const scope = COMPOSE_EDITOR_SHORTCUT_SCOPES[action]
  const serialized = serializeComposeKeybinding(normalizeComposeEditorKeybinding(binding))
  return COMPOSE_EDITOR_SHORTCUT_ACTIONS.find((candidate) =>
    candidate !== action
    && COMPOSE_EDITOR_SHORTCUT_SCOPES[candidate] === scope
    && shortcuts[candidate].some((item) =>
      serializeComposeKeybinding(normalizeComposeEditorKeybinding(item)) === serialized)) ?? null
}

export function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  if (target.closest('input, textarea, select')) return true
  if (target instanceof HTMLElement && target.contentEditable === 'true') return true
  return target.closest('[contenteditable]:not([contenteditable="false"])') !== null
}

function cloneShortcutMap(
  shortcuts: ComposeEditorPreferences['shortcuts'],
): ComposeEditorPreferences['shortcuts'] {
  return Object.fromEntries(
    COMPOSE_EDITOR_SHORTCUT_ACTIONS.map((action) => [
      action,
      shortcuts[action].map((binding) => ({ ...binding })),
    ]),
  ) as unknown as ComposeEditorPreferences['shortcuts']
}


function isMacPlatform(platform: string) {
  return /Mac|iPhone|iPad|iPod/i.test(platform)
}
