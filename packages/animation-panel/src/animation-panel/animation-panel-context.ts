import { createContext, useContext } from 'react'
import type { ComposeAnimationPanelSession } from './animation-panel-provider'

export const AnimationPanelContext = createContext<ComposeAnimationPanelSession | null>(null)

export function useAnimationPanelSession() {
  const session = useContext(AnimationPanelContext)
  if (session === null) {
    throw new Error('ComposeAnimationTimeline and ComposeAnimationInspector must be rendered inside ComposeAnimationPanelProvider')
  }
  return session
}
