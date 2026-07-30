import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { ComposePageSlotNestContext } from './nest-state'

/**
 * 向下提供页面嵌套状态。
 *
 * @remarks
 * Page Slot 在渲染被引用页面的内容前把自身的页面 key 追加进祖先链，从而让更深层的
 * Page Slot 能检出循环引用。
 * @internal
 */
export function ComposePageSlotNestProvider({
  ancestorPageKeys,
  children,
  depth,
}: {
  readonly ancestorPageKeys: readonly string[]
  readonly children: ReactNode
  readonly depth: number
}) {
  const value = useMemo(() => ({ ancestorPageKeys, depth }), [ancestorPageKeys, depth])
  return (
    <ComposePageSlotNestContext.Provider value={value}>
      {children}
    </ComposePageSlotNestContext.Provider>
  )
}
