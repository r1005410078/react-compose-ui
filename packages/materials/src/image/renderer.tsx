import type { ComposeComponentRendererProps } from '@compose-ui/component-registry'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { readAssetReference, useResolvedAsset } from '../material-inspector-kit/assets'

const fits = new Set(['contain', 'cover', 'fill', 'none', 'scale-down'])

/** Materials 内置 Image renderer。 @internal */
export function ImageRenderer({
  assetResolver,
  node,
  props,
}: ComposeComponentRendererProps) {
  const reference = readAssetReference(props.asset)
  const resolved = useResolvedAsset(reference, assetResolver)
  const [resolvedUrl, setResolvedUrl] = useState<{
    readonly blob: Blob
    readonly url: string
  } | null>(null)

  useEffect(() => {
    if (resolved.status !== 'ready') return
    const next = URL.createObjectURL(resolved.value.blob)
    let active = true
    void Promise.resolve().then(() => {
      if (active) setResolvedUrl({ blob: resolved.value.blob, url: next })
    })
    return () => {
      active = false
      URL.revokeObjectURL(next)
    }
  }, [resolved])

  const currentUrl = resolved.status === 'ready'
    && resolvedUrl?.blob === resolved.value.blob
    ? resolvedUrl.url
    : null
  if (!currentUrl) {
    return (
      <div
        aria-label={`资源不可用 ${node.name}`}
        className="compose-material compose-material--asset-missing"
        role="status"
      >
        {reference?.scope === 'session' ? '请重新连接本地资源' : '资源不可用'}
      </div>
    )
  }
  const alt = typeof props.alt === 'string' ? props.alt : node.name
  const fit = (
    typeof props.fit === 'string' && fits.has(props.fit) ? props.fit : 'contain'
  ) as CSSProperties['objectFit']
  return (
    <img
      alt={alt}
      className="compose-material compose-material--image"
      data-testid="compose-material-image"
      src={currentUrl}
      style={{ objectFit: fit }}
    />
  )
}
