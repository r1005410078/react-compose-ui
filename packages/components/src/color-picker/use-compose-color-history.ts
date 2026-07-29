import { useContext } from 'react'
import { ComposeColorHistoryContext, type ComposeColorHistoryContextValue } from './color-history-context'

const EMPTY_COLOR_HISTORY: ComposeColorHistoryContextValue = {
  colors: [],
  record: () => {},
}

/** 读取上层会话颜色历史；无 Provider 时返回安全的空历史。 @public */
export function useComposeColorHistory(): ComposeColorHistoryContextValue {
  return useContext(ComposeColorHistoryContext) ?? EMPTY_COLOR_HISTORY
}
