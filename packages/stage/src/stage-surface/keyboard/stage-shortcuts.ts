import { composeKeyboardEventCode, matchesComposeKeybinding } from '@compose-ui/commands'
import type { ComposeKeyboardEventShape } from '@compose-ui/commands'
import type { ComposeLayerOrderOperation } from '@compose-ui/stage-engine'
import type {
  ComposeStageDelegatableAction,
  ComposeStageKeybinding,
  ComposeStageShortcutAction,
} from '../../types'

export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  if (target.closest('input, textarea, select')) return true
  if (target instanceof HTMLElement && target.contentEditable === 'true') return true
  return target.closest('[contenteditable]:not([contenteditable="false"])') !== null
}

export const STAGE_SHORTCUT_ACTIONS = [
  'stage.temporaryPan',
  'stage.selectTool',
  'stage.scaleTool',
  'stage.rotateTool',
  'stage.drawContainerTool',
  'stage.drawTextTool',
  'stage.fitSelection',
  'stage.fitContainer',
  'stage.zoomReset',
  'stage.zoomIn',
  'stage.zoomOut',
  'stage.toggleGridSnap',
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
  'edit.delete',
  'drafting.line',
  'drafting.polyline',
  'drafting.rectangle',
  'drafting.circle',
  'drafting.arc',
  'drafting.arrow',
  'drafting.wire',
] as const satisfies readonly ComposeStageShortcutAction[]

/**
 * 可交给宿主接管的动作。
 *
 * 临时平移按下后要等松开才结束，接管方无法表达这段生命周期，因此排除在外。
 */
export const DELEGATABLE_STAGE_ACTIONS = STAGE_SHORTCUT_ACTIONS
  .filter((action) => action !== 'stage.temporaryPan') as readonly ComposeStageDelegatableAction[]

export const DEFAULT_STAGE_SHORTCUTS: Readonly<
  Record<ComposeStageShortcutAction, readonly ComposeStageKeybinding[]>
> = {
  'stage.temporaryPan': [{ code: 'Space' }],
  'stage.selectTool': [{ code: 'KeyV' }],
  'stage.scaleTool': [{ code: 'KeyS' }],
  'stage.rotateTool': [{ code: 'KeyR', shift: true }],
  'stage.drawContainerTool': [{ code: 'KeyF' }],
  'stage.drawTextTool': [{ code: 'KeyT' }],
  'stage.fitSelection': [{ code: 'Digit2', shift: true }],
  'stage.fitContainer': [{ code: 'KeyF', shift: true }],
  'stage.zoomReset': [{ code: 'Digit0', primary: true }],
  'stage.zoomIn': [{ code: 'Equal', primary: true }],
  'stage.zoomOut': [{ code: 'Minus', primary: true }],
  'stage.toggleGridSnap': [{ code: 'KeyG', shift: true }],
  'stage.toggleSmartSnap': [{ code: 'KeyS', shift: true }],
  'edit.duplicate': [{ code: 'KeyD', primary: true }],
  'edit.copy': [{ code: 'KeyC', primary: true }],
  'edit.cut': [{ code: 'KeyX', primary: true }],
  'edit.paste': [{ code: 'KeyV', primary: true }],
  'edit.bringForward': [{ code: 'BracketRight' }],
  'edit.sendBackward': [{ code: 'BracketLeft' }],
  'edit.bringToFront': [{ code: 'BracketRight', primary: true }],
  'edit.sendToBack': [{ code: 'BracketLeft', primary: true }],
  'edit.group': [{ code: 'KeyG', primary: true }],
  'edit.ungroup': [{ code: 'KeyG', primary: true, shift: true }],
  'edit.delete': [{ code: 'Delete' }, { code: 'Backspace' }],
  // 绘图命令按下即开始，没有确认键——AutoCAD 敲 `L` 之后那个空格不携带任何信息。
  // 每个键 MUST 同时是对应命令的一个别名（见 `COMMAND_SHORTCUTS`），用户只记一套词。
  'drafting.line': [{ code: 'KeyL' }],
  'drafting.polyline': [{ code: 'KeyP' }],
  'drafting.rectangle': [{ code: 'KeyR' }],
  'drafting.circle': [{ code: 'KeyC' }],
  'drafting.arc': [{ code: 'KeyA' }],
  // `A` 只能给一条，弧比箭头更接近「基础图形」，因此箭头用空着的 `X`。
  'drafting.arrow': [{ code: 'KeyX' }],
  'drafting.wire': [{ code: 'KeyW' }],
}

/**
 * 绘图命令快捷键到命令 id 的映射；按表内顺序匹配，先命中者生效。
 *
 * @remarks
 * 表里的每个键 MUST 同时是该命令的一个别名（`P`/`R`/`W`/`X` 已补进各自的 `aliases`）：
 * 用户只记一套词，按 `P` 与在命令行敲 `P↵` 指向同一条命令。反向不成立——`REC`、`WI`
 * 这类多字母别名不需要有对应的快捷键。
 *
 * @public
 */
export const COMMAND_SHORTCUTS: readonly (readonly [ComposeStageShortcutAction, string])[] = [
  ['drafting.line', 'LINE'],
  ['drafting.polyline', 'PLINE'],
  ['drafting.rectangle', 'RECTANGLE'],
  ['drafting.circle', 'CIRCLE'],
  ['drafting.arc', 'ARC'],
  ['drafting.arrow', 'ARROW'],
  ['drafting.wire', 'WIRE'],
]

export const LAYER_ORDER_SHORTCUTS = [
  ['edit.bringForward', 'bring-forward'],
  ['edit.sendBackward', 'send-backward'],
  ['edit.bringToFront', 'bring-to-front'],
  ['edit.sendToBack', 'send-to-back'],
] as const satisfies readonly (readonly [ComposeStageShortcutAction, ComposeLayerOrderOperation])[]

/**
 * 把键盘事件归一为物理键码。
 *
 * @remarks
 * 保留 Stage 既有的公共名称；实现住在 `@compose-ui/commands`，与匹配用的是同一份归一化。
 *
 * @public
 */
export function keyboardEventCode(event: ComposeKeyboardEventShape) {
  return composeKeyboardEventCode(event)
}

/**
 * 判定一次按键是否命中某个 Stage 键位。
 *
 * @remarks
 * 归一化与匹配住在 `@compose-ui/commands`：此前匹配只在 Stage 有、归一化只在 Editor 有，
 * 两边都无法独立完成命中判定。本函数只是保留 Stage 既有的公共名称。
 *
 * @public
 */
export function isStageShortcutMatch(
  event: ComposeKeyboardEventShape,
  binding: ComposeStageKeybinding,
) {
  return matchesComposeKeybinding(event, binding)
}

/** 渲染受控 DOM/SVG 无限 Stage，并显式呈现 Layout Runtime 加载或失败状态。 @public */