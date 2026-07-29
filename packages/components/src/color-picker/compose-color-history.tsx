import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { normalizeComposeColor, type ComposeColor } from '@compose-ui/core'
import { ComposeColorHistoryContext } from './color-history-context'

/** ComposeColorHistoryProvider 的会话型控制属性。 @public */
export interface ComposeColorHistoryProviderProps {
  /** 受控的 MRU 颜色列表。 */
  readonly colors?: readonly ComposeColor[]
  /** 非受控模式的初始 MRU 列表。 */
  readonly defaultColors?: readonly ComposeColor[]
  /** 每次规范化后的 MRU 变化回调；Provider 不写入 localStorage。 */
  readonly onColorsChange?: (colors: readonly ComposeColor[]) => void
  /** 最大保留数量。 @defaultValue 16 */
  readonly maxEntries?: number
  readonly children: ReactNode
}

function normalizeHistory(colors: readonly ComposeColor[], maxEntries: number): readonly ComposeColor[] {
  const result: ComposeColor[] = []
  for (const candidate of colors) {
    const normalized = normalizeComposeColor(candidate)
    if (normalized && !result.includes(normalized)) result.push(normalized)
    if (result.length === maxEntries) break
  }
  return result
}

/**
 * 为一个 Editor 或宿主区域提供短暂颜色 MRU。
 *
 * @remarks
 * History 只属于 React 会话：不进入 ComposeDocument、事务历史或 Operation Log。Editor 应为
 * 每个实例放置一个 Provider；宿主若需要跨挂载保存，可采用受控 `colors`。
 *
 * @public
 */
export function ComposeColorHistoryProvider({
  children,
  colors,
  defaultColors = [],
  maxEntries = 16,
  onColorsChange,
}: ComposeColorHistoryProviderProps) {
  const capacity = Math.max(1, Math.floor(maxEntries))
  const [uncontrolledColors, setUncontrolledColors] = useState(() => normalizeHistory(defaultColors, capacity))
  const current = normalizeHistory(colors ?? uncontrolledColors, capacity)
  const record = useCallback((color: ComposeColor) => {
    const normalized = normalizeComposeColor(color)
    if (!normalized) return
    const next = normalizeHistory([normalized, ...current], capacity)
    if (colors === undefined) setUncontrolledColors(next)
    onColorsChange?.(next)
  }, [capacity, colors, current, onColorsChange])
  const value = useMemo(() => ({ colors: current, record }), [current, record])
  return <ComposeColorHistoryContext.Provider value={value}>{children}</ComposeColorHistoryContext.Provider>
}
