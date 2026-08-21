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
  'stage.moveTool': [{ code: 'KeyM' }],
  'stage.scaleTool': [{ code: 'KeyS' }],
  'stage.rotateTool': [{ code: 'KeyR', shift: true }],
  'stage.panTool': [{ code: 'KeyH' }],
  'stage.drawContainerTool': [{ code: 'KeyF' }],
  'stage.drawRectangleTool': [{ code: 'KeyR' }],
  'stage.drawLineTool': [{ code: 'KeyL' }],
  'stage.drawArrowTool': [{ code: 'KeyL', shift: true }],
  'stage.drawCircleTool': [{ code: 'KeyO' }],
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
}

export const LAYER_ORDER_SHORTCUTS = [
  ['edit.bringForward', 'bring-forward'],
  ['edit.sendBackward', 'send-backward'],
  ['edit.bringToFront', 'bring-to-front'],
  ['edit.sendToBack', 'send-to-back'],
] as const satisfies readonly (readonly [ComposeStageShortcutAction, ComposeLayerOrderOperation])[]

export function keyboardEventCode(event: {
  code: string
  key: string
}) {
  if (event.code) return event.code
  if (/^[a-z]$/i.test(event.key)) return `Key${event.key.toUpperCase()}`
  if (/^[0-9]$/.test(event.key)) return `Digit${event.key}`
  const codes: Record<string, string> = {
    ' ': 'Space',
    ',': 'Comma',
    '=': 'Equal',
    '-': 'Minus',
    '[': 'BracketLeft',
    ']': 'BracketRight',
  }
  return codes[event.key] ?? event.key
}

export function isStageShortcutMatch(
  event: {
    altKey: boolean
    code: string
    ctrlKey: boolean
    key: string
    metaKey: boolean
    shiftKey: boolean
  },
  binding: ComposeStageKeybinding,
) {
  const modifierMatches = binding.primary
    ? event.ctrlKey !== event.metaKey
    : event.ctrlKey === Boolean(binding.control) && !event.metaKey
  return keyboardEventCode(event) === binding.code
    && modifierMatches
    && event.shiftKey === Boolean(binding.shift)
    && event.altKey === Boolean(binding.alt)
}

/** 渲染受控 DOM/SVG 无限 Stage，并显式呈现 Layout Runtime 加载或失败状态。 @public */