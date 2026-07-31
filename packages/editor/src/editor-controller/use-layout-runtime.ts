import {
  createComposeLayoutRuntime,
  type ComposeLayoutRuntimeState,
} from '@compose-ui/layout-engine'
import type { ComposeDocument } from '@compose-ui/core'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

/** Editor 会话拥有的 LayoutRuntime React 适配。 */
export function useComposeEditorLayout(document: ComposeDocument): ComposeLayoutRuntimeState {
  const [runtime] = useState(() => createComposeLayoutRuntime({ document }))
  const state = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)
  const generation = useRef(0)

  useLayoutEffect(() => runtime.updateDocument(document), [document, runtime])
  useEffect(() => {
    generation.current += 1
    const mounted = generation.current
    return () => queueMicrotask(() => {
      if (generation.current === mounted) runtime.dispose()
    })
  }, [runtime])
  return state
}
