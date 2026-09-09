import {
  normalizeComposeKeybinding,
  serializeComposeKeybinding,
} from '@compose-ui/commands'
import type { ComposeKeybinding } from '@compose-ui/commands'
import { DEFAULT_STAGE_SHORTCUTS } from '@compose-ui/stage'
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
