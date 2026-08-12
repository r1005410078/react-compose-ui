import { useMemo, type ReactNode } from 'react'
import {
  ComposeComponentInstanceNestContext,
  type ComposeComponentInstanceNestState,
} from './nest-state'

/** 为嵌套 component-instance 传递循环与深度上下文。 @internal */
export function ComposeComponentInstanceNestProvider({
  ancestorKeys,
  children,
  depth,
}: ComposeComponentInstanceNestState & { readonly children: ReactNode }) {
  const value = useMemo(() => ({ ancestorKeys, depth }), [ancestorKeys, depth])
  return (
    <ComposeComponentInstanceNestContext.Provider value={value}>
      {children}
    </ComposeComponentInstanceNestContext.Provider>
  )
}
