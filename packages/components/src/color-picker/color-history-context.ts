import { createContext } from 'react'
import type { ComposeColor } from '@compose-ui/core'

/** Color history provider 注入给 Picker 的最小会话端口。 @internal */
export interface ComposeColorHistoryContextValue {
  readonly colors: readonly ComposeColor[]
  readonly record: (color: ComposeColor) => void
}

/** 无 Provider 时保持安全的无历史行为。 @internal */
export const ComposeColorHistoryContext = createContext<ComposeColorHistoryContextValue | null>(null)
