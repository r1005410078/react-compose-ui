import { useCallback } from 'react'
import type { KeyboardEventHandler } from 'react'
import type {
  HistoryKeybinding,
  HistoryNavigationController,
  HistoryShortcuts,
} from './types'

const DEFAULT_HISTORY_SHORTCUTS = {
  undo: [{ code: 'KeyZ', primary: true }],
  redo: [
    { code: 'KeyZ', primary: true, shift: true },
    { code: 'KeyY', control: true },
  ],
} satisfies Required<HistoryShortcuts>

function eventCode(event: KeyboardEvent) {
  if (event.code) return event.code
  if (/^[a-z]$/i.test(event.key)) return `Key${event.key.toUpperCase()}`
  return event.key
}

function matches(event: KeyboardEvent, binding: HistoryKeybinding) {
  const modifierMatches = binding.primary
    ? event.ctrlKey !== event.metaKey
    : event.ctrlKey === Boolean(binding.control) && !event.metaKey
  return eventCode(event) === binding.code
    && modifierMatches
    && event.shiftKey === Boolean(binding.shift)
    && event.altKey === Boolean(binding.alt)
}

/**
 * 创建作用于指定 React 容器的撤销重做快捷键处理器。
 *
 * @remarks
 * 识别到快捷键后会阻止浏览器默认文本撤销，即使当前方向没有可用记录。IME 组合输入以及带
 * `Alt` 的组合键不会被拦截。
 *
 * @param controller - 提供能力状态和撤销重做命令的历史控制器。
 * @param shortcuts - 可选的撤销与重做键位覆盖。
 * @returns 可赋给容器 `onKeyDownCapture` 的事件处理器。
 * @public
 */
export function useHistoryShortcuts(
  controller: HistoryNavigationController,
  shortcuts?: HistoryShortcuts,
): KeyboardEventHandler<HTMLElement> {
  return useCallback((event) => {
    if (event.nativeEvent.isComposing) return
    const undo = (shortcuts?.undo ?? DEFAULT_HISTORY_SHORTCUTS.undo)
      .some((binding) => matches(event.nativeEvent, binding))
    const redo = (shortcuts?.redo ?? DEFAULT_HISTORY_SHORTCUTS.redo)
      .some((binding) => matches(event.nativeEvent, binding))
    if (!undo && !redo) return

    event.preventDefault()
    if (undo && controller.canUndo) controller.undo()
    if (redo && controller.canRedo) controller.redo()
  }, [controller, shortcuts])
}
