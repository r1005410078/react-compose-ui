import { createContext, useContext } from 'react'

/** 页面嵌套渲染的祖先链与深度。 @internal */
export interface ComposePageSlotNestState {
  /** 由外层向内层排列的祖先页面 key；不含当前页面。 */
  readonly ancestorPageKeys: readonly string[]
  /** 当前嵌套深度；根文档为 0。 */
  readonly depth: number
}

/** @internal */
export const ComposePageSlotNestContext = createContext<ComposePageSlotNestState>({
  ancestorPageKeys: [],
  depth: 0,
})

/** 读取当前的页面嵌套状态。 @internal */
export function useComposePageSlotNest(): ComposePageSlotNestState {
  return useContext(ComposePageSlotNestContext)
}
