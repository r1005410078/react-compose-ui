import type { ComposeComponentRendererProps } from '@compose-ui/component-registry'
import { useEffect, useState } from 'react'
import { readAssetReference, useResolvedAsset } from '../material-inspector-kit/assets'
import { sanitizeSvg } from './sanitize'

/** Materials 内置安全 SVG renderer。 @internal */
export function SvgRenderer({
  assetResolver,
  node,
  props,
}: ComposeComponentRendererProps) {
  const reference = readAssetReference(props.asset)
  const resolved = useResolvedAsset(reference, assetResolver)
  const [rendered, setRendered] = useState<{
    readonly blob: Blob
    readonly fillColor: string
    readonly markup: string
    readonly overrideFill: boolean
    readonly overrideStroke: boolean
    readonly strokeColor: string
  } | null>(null)
  const overrideFill = props.overrideFill === true
  const overrideStroke = props.overrideStroke === true
  const fillColor = typeof props.fillColor === 'string' ? props.fillColor : '#ffffff'
  const strokeColor = typeof props.strokeColor === 'string' ? props.strokeColor : '#ffffff'

  useEffect(() => {
    let active = true
    if (resolved.status !== 'ready') return
    const blob = resolved.value.blob
    void resolved.value.blob.text().then((source) => {
      if (active) {
        setRendered({
          blob,
          fillColor,
          markup: sanitizeSvg(source, {
            overrideFill,
            fillColor,
            overrideStroke,
            strokeColor,
          }),
          overrideFill,
          overrideStroke,
          strokeColor,
        })
      }
    }, () => undefined)
    return () => {
      active = false
    }
  }, [fillColor, overrideFill, overrideStroke, resolved, strokeColor])

  const markup = resolved.status === 'ready'
    && rendered?.blob === resolved.value.blob
    && rendered.fillColor === fillColor
    && rendered.overrideFill === overrideFill
    && rendered.overrideStroke === overrideStroke
    && rendered.strokeColor === strokeColor
    ? rendered.markup
    : null
  if (!markup) {
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
  const fit = props.fit === 'cover' ? 'xMidYMid slice' : props.fit === 'fill' ? 'none' : 'xMidYMid meet'
  const fitted = markup.replace('<svg ', `<svg preserveAspectRatio="${fit}" `)
  return (
    <div
      aria-label={alt}
      className="compose-material compose-material--svg"
      data-testid="compose-material-svg"
      role="img"
      // 已由 DOMPurify 与第二层属性白名单净化，原始 SVG 永不直接进入此边界。
      dangerouslySetInnerHTML={{ __html: fitted }}
    />
  )
}
