import type { ComposeRendererMeasurementDefinition } from '@compose-ui/component-registry'
import { readAssetReference } from '../material-inspector-kit/assets'
import { constrainIntrinsicSize } from '../renderer-measurement/intrinsic-size'
import { readSvgIntrinsicSize } from '../material-inspector-kit/assets'

type PreparedSvg = {
  readonly width: number
  readonly height: number
  readonly revision: string
}

/** SVG Renderer 的 viewBox/width/height 固有尺寸测量。 @internal */
export const SVG_RENDERER_MEASUREMENT: ComposeRendererMeasurementDefinition = {
  async prepare({ props, assetResolver, signal }) {
    const reference = readAssetReference(props.asset)
    if (!reference || !assetResolver) throw new Error('SVG 资源解析器不可用')
    const resolved = await assetResolver.resolve({ reference, signal })
    return { ...readSvgIntrinsicSize(await resolved.blob.text()), revision: resolved.revision }
  },
  measure({ prepared, width, height }) {
    const size = prepared as PreparedSvg | undefined
    if (!size || size.width <= 0 || size.height <= 0) return null
    return constrainIntrinsicSize(size, width, height)
  },
  subscribe({ props, assetResolver, invalidate }) {
    const reference = readAssetReference(props.asset)
    return reference ? assetResolver?.subscribe?.(reference, invalidate) ?? (() => undefined) : () => undefined
  },
}
