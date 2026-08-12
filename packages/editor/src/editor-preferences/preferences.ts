import type { ComposeLocale, ComposeTheme } from '@compose-ui/ui-context'
import { formatComposeKeybinding } from '@compose-ui/components'

/**
 * 可由设置面板修改的编辑器动作。
 *
 * @public
 */
export type ComposeEditorShortcutAction =
  | 'editor.settings'
  | 'stage.temporaryPan'
  | 'stage.selectTool'
  | 'stage.marqueeTool'
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
  | 'edit.createComponent'
  | 'edit.delete'
  | 'history.undo'
  | 'history.redo'

/**
 * 单次键盘按键或组合键。
 *
 * @remarks
 * `code` 使用 `KeyboardEvent.code`；`primary` 接受 Command 或 Control，展示时按平台格式化。
 *
 * @public
 */
export interface ComposeEditorKeybinding {
  /** 布局无关的物理键位代码。 */
  readonly code: string
  /** 是否要求平台主修饰键。 */
  readonly primary?: boolean
  /** 是否明确要求 Control；用于所有平台通用的 Ctrl+Y 等兼容键位。 */
  readonly control?: boolean
  /** 是否要求 Shift。 */
  readonly shift?: boolean
  /** 是否要求 Alt/Option。 */
  readonly alt?: boolean
}

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
}

export type ComposeEditorShortcutScope = 'editor' | 'stage' | 'history'

export const COMPOSE_EDITOR_SHORTCUT_ACTIONS = [
  'editor.settings',
  'stage.temporaryPan',
  'stage.selectTool',
  'stage.marqueeTool',
  'stage.moveTool',
  'stage.scaleTool',
  'stage.rotateTool',
  'stage.panTool',
  'stage.drawContainerTool',
  'stage.drawRectangleTool',
  'stage.drawLineTool',
  'stage.drawArrowTool',
  'stage.drawCircleTool',
  'stage.drawTextTool',
  'stage.fitSelection',
  'stage.fitContainer',
  'stage.zoomReset',
  'stage.zoomIn',
  'stage.zoomOut',
  'stage.toggleGridSnap',
  'stage.toggleSmartSnap',
  'edit.duplicate',
  'edit.bringForward',
  'edit.sendBackward',
  'edit.bringToFront',
  'edit.sendToBack',
  'edit.group',
  'edit.ungroup',
  'edit.createComponent',
  'edit.delete',
  'history.undo',
  'history.redo',
] as const satisfies readonly ComposeEditorShortcutAction[]

export const COMPOSE_EDITOR_SHORTCUT_SCOPES: Readonly<
  Record<ComposeEditorShortcutAction, ComposeEditorShortcutScope>
> = {
  'editor.settings': 'editor',
  'stage.temporaryPan': 'stage',
  'stage.selectTool': 'stage',
  'stage.marqueeTool': 'stage',
  'stage.moveTool': 'stage',
  'stage.scaleTool': 'stage',
  'stage.rotateTool': 'stage',
  'stage.panTool': 'stage',
  'stage.drawContainerTool': 'stage',
  'stage.drawRectangleTool': 'stage',
  'stage.drawLineTool': 'stage',
  'stage.drawArrowTool': 'stage',
  'stage.drawCircleTool': 'stage',
  'stage.drawTextTool': 'stage',
  'stage.fitSelection': 'stage',
  'stage.fitContainer': 'stage',
  'stage.zoomReset': 'stage',
  'stage.zoomIn': 'stage',
  'stage.zoomOut': 'stage',
  'stage.toggleGridSnap': 'stage',
  'stage.toggleSmartSnap': 'stage',
  'edit.duplicate': 'stage',
  'edit.bringForward': 'stage',
  'edit.sendBackward': 'stage',
  'edit.bringToFront': 'stage',
  'edit.sendToBack': 'stage',
  'edit.group': 'stage',
  'edit.ungroup': 'stage',
  'edit.createComponent': 'stage',
  'edit.delete': 'stage',
  'history.undo': 'history',
  'history.redo': 'history',
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
    shortcuts: cloneShortcutMap({
      'editor.settings': [{ code: 'Comma', primary: true }],
      'stage.temporaryPan': [{ code: 'Space' }],
      'stage.selectTool': [{ code: 'KeyV' }],
      'stage.marqueeTool': [{ code: 'KeyB' }],
      'stage.moveTool': [{ code: 'KeyM' }],
      'stage.scaleTool': [{ code: 'KeyS' }],
      'stage.rotateTool': [{ code: 'KeyR', shift: true }],
      'stage.panTool': [{ code: 'KeyH' }],
      'stage.drawContainerTool': [{ code: 'KeyC' }],
      'stage.drawRectangleTool': [{ code: 'KeyR' }],
      'stage.drawLineTool': [{ code: 'KeyL' }],
      'stage.drawArrowTool': [{ code: 'KeyL', shift: true }],
      'stage.drawCircleTool': [{ code: 'KeyO' }],
      'stage.drawTextTool': [{ code: 'KeyT' }],
      'stage.fitSelection': [{ code: 'KeyF' }],
      'stage.fitContainer': [{ code: 'KeyF', shift: true }],
      'stage.zoomReset': [{ code: 'Digit0', primary: true }],
      'stage.zoomIn': [{ code: 'Equal', primary: true }],
      'stage.zoomOut': [{ code: 'Minus', primary: true }],
      'stage.toggleGridSnap': [{ code: 'KeyG', shift: true }],
      'stage.toggleSmartSnap': [{ code: 'KeyS', shift: true }],
      'edit.duplicate': [{ code: 'KeyD', primary: true }],
      'edit.bringForward': [{ code: 'BracketRight' }],
      'edit.sendBackward': [{ code: 'BracketLeft' }],
      'edit.bringToFront': [{ code: 'BracketRight', primary: true }],
      'edit.sendToBack': [{ code: 'BracketLeft', primary: true }],
      'edit.group': [{ code: 'KeyG', primary: true }],
      'edit.ungroup': [{ code: 'KeyG', primary: true, shift: true }],
      'edit.createComponent': [],
      'edit.delete': [{ code: 'Delete' }, { code: 'Backspace' }],
      'history.undo': [{ code: 'KeyZ', primary: true }],
      'history.redo': [
        { code: 'KeyZ', primary: true, shift: true },
        { code: 'KeyY', control: true },
      ],
    }),
  }
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
            serializeBinding(candidate) === serializeBinding(binding)) === index),
      ]
    }),
  ) as unknown as ComposeEditorPreferences['shortcuts']

  return { theme, locale, shortcuts }
}

export function normalizeComposeEditorKeybinding(
  binding: ComposeEditorKeybinding,
): ComposeEditorKeybinding {
  const code = binding.code.trim()
  if (!code) throw new Error('Shortcut code must not be empty')
  if (binding.primary && binding.control) {
    throw new Error('Shortcut cannot require primary and explicit Control together')
  }

  return {
    code,
    ...(binding.primary ? { primary: true } : {}),
    ...(binding.control ? { control: true } : {}),
    ...(binding.shift ? { shift: true } : {}),
    ...(binding.alt ? { alt: true } : {}),
  }
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
  const serialized = serializeBinding(normalizeComposeEditorKeybinding(binding))
  return COMPOSE_EDITOR_SHORTCUT_ACTIONS.find((candidate) =>
    candidate !== action
    && COMPOSE_EDITOR_SHORTCUT_SCOPES[candidate] === scope
    && shortcuts[candidate].some((item) =>
      serializeBinding(normalizeComposeEditorKeybinding(item)) === serialized)) ?? null
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

function serializeBinding(binding: ComposeEditorKeybinding) {
  return [
    binding.code,
    binding.primary ? 'primary' : '',
    binding.control ? 'control' : '',
    binding.shift ? 'shift' : '',
    binding.alt ? 'alt' : '',
  ].join(':')
}

function isMacPlatform(platform: string) {
  return /Mac|iPhone|iPad|iPod/i.test(platform)
}
