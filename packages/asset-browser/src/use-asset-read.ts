import { useEffect, useState } from 'react'
import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
import { normalizeComposeAssetError } from '@compose-ui/assets'

export interface LoadedAsset {
  readonly blob: Blob
  readonly revision: string
}

export function useAssetRead(
  provider: ComposeAssetProvider,
  entry: ComposeAssetEntry | undefined,
  reloadKey = 0,
) {
  const [state, setState] = useState<
    {
      key: string
      status: 'ready' | 'error'
      data?: LoadedAsset
      error?: string
    } | null
  >(null)
  const key = entry ? `${entry.id}:${reloadKey}` : null
  useEffect(() => {
    if (!entry || entry.kind !== 'file') return
    const controller = new AbortController()
    void provider.read({ fileId: entry.id, signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setState({
          key: `${entry.id}:${reloadKey}`,
          status: 'ready',
          data,
        })
      },
      (error) => {
        if (!controller.signal.aborted) {
          setState({
            key: `${entry.id}:${reloadKey}`,
            status: 'error',
            error: normalizeComposeAssetError(error).message,
          })
        }
      },
    )
    return () => controller.abort()
  }, [entry, provider, reloadKey])
  if (!key) return { status: 'idle' as const }
  return state?.key === key ? state : { status: 'loading' as const }
}
