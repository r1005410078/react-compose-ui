import { useCallback } from 'react'
import type { KeyboardEventHandler } from 'react'
import type { HistoryNavigationController } from './types'

/**
 * 创建作用于指定 React 容器的撤销重做快捷键处理器。
 *
 * @remarks
 * 识别到快捷键后会阻止浏览器默认文本撤销，即使当前方向没有可用记录。IME 组合输入以及带
 * `Alt` 的组合键不会被拦截。
 *
 * @param controller - 提供能力状态和撤销重做命令的历史控制器。
 * @returns 可赋给容器 `onKeyDownCapture` 的事件处理器。
 * @public
 */
export function useHistoryShortcuts(
  controller: HistoryNavigationController,
): KeyboardEventHandler<HTMLElement> {
  return useCallback((event) => {
    if (event.nativeEvent.isComposing || event.altKey) return
    const key = event.key.toLowerCase()
    const commandKey = event.metaKey || event.ctrlKey
    const undo = commandKey && key === 'z' && !event.shiftKey
    const redo = (commandKey && key === 'z' && event.shiftKey)
      || (event.ctrlKey && !event.metaKey && key === 'y' && !event.shiftKey)
    if (!undo && !redo) return

    event.preventDefault()
    if (undo && controller.canUndo) controller.undo()
    if (redo && controller.canRedo) controller.redo()
  }, [controller])
}

