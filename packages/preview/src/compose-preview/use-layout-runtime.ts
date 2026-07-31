import {
  createComposeLayoutRuntime,
  type ComposeLayoutRuntime,
  type ComposeLayoutRuntimeState,
} from '@compose-ui/layout-engine'
import {
  createComposeRendererMeasurementAdapter,
  type ComposeEntityRegistry,
  type ComposeRendererMeasurementAdapter,
} from '@compose-ui/component-registry'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import type { ComposeDocument, ComposePageDocumentLoader } from '@compose-ui/core'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

export function useComposePreviewLayout(
  document: ComposeDocument,
  registry: ComposeEntityRegistry,
  assetResolver?: ComposeAssetResolver,
  pageDocumentPort?: ComposePageDocumentLoader,
  externalRuntime?: ComposeLayoutRuntime,
): ComposeLayoutRuntimeState {
  const [ownedRuntime] = useState(() => createComposeLayoutRuntime({ document }))
  const runtime = externalRuntime ?? ownedRuntime
  const adapter = useMemo(() => createComposeRendererMeasurementAdapter({
    registry,
    assetResolver,
    pageDocumentPort,
  }), [assetResolver, pageDocumentPort, registry])
  const state = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)
  const generation = useRef(0)
  const adapterGenerations = useRef(new WeakMap<ComposeRendererMeasurementAdapter, number>())

  useLayoutEffect(() => {
    adapter.updateDocument(document)
    runtime.setMeasurementPort(adapter)
    runtime.updateDocument(document)
    return () => runtime.setMeasurementPort(undefined)
  }, [adapter, document, runtime])
  useEffect(() => {
    if (runtime !== ownedRuntime) return
    generation.current += 1
    const mounted = generation.current
    return () => queueMicrotask(() => {
      if (generation.current === mounted) runtime.dispose()
    })
  }, [ownedRuntime, runtime])
  useEffect(() => {
    const generations = adapterGenerations.current
    const mounted = (generations.get(adapter) ?? 0) + 1
    generations.set(adapter, mounted)
    return () => queueMicrotask(() => {
      if (generations.get(adapter) !== mounted) return
      adapter.dispose()
      generations.delete(adapter)
    })
  }, [adapter])
  return state.document === document ? state : { status: 'loading', document }
}
