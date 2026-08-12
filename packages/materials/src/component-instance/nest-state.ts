import { createContext, useContext } from 'react'

/** 组件实例嵌套渲染的祖先链与深度。 @internal */
export interface ComposeComponentInstanceNestState {
  readonly ancestorKeys: readonly string[]
  readonly depth: number
}

/** @internal */
export const ComposeComponentInstanceNestContext = createContext<ComposeComponentInstanceNestState>({
  ancestorKeys: [],
  depth: 0,
})

/** 读取当前 component-instance 嵌套上下文。 @internal */
export function useComposeComponentInstanceNest(): ComposeComponentInstanceNestState {
  return useContext(ComposeComponentInstanceNestContext)
}
