import type { ComposeRendererMeasurementDefinition } from '@compose-ui/component-registry'
import { readAssetReference } from '../material-inspector-kit/assets'
import { constrainIntrinsicSize } from '../renderer-measurement/intrinsic-size'

type PreparedImage = {
  readonly width: number
  readonly height: number
  readonly revision: string
}

/** Image Renderer 的资源固有尺寸测量。 @internal */
export const IMAGE_RENDERER_MEASUREMENT: ComposeRendererMeasurementDefinition = {
  async prepare({ props, assetResolver, signal }) {
    const reference = readAssetReference(props.asset)
    if (!reference || !assetResolver) throw new Error('Image 资源解析器不可用')
    const resolved = await assetResolver.resolve({ reference, signal })
    if (typeof createImageBitmap !== 'function') throw new Error('浏览器不支持位图固有尺寸解码')
    const bitmap = await createImageBitmap(resolved.blob)
    try {
      return { width: bitmap.width, height: bitmap.height, revision: resolved.revision }
    }
    finally {
      bitmap.close()
    }
  },
  measure({ prepared, width, height }) {
    const size = prepared as PreparedImage | undefined
    if (!size || size.width <= 0 || size.height <= 0) return null
    return constrainIntrinsicSize(size, width, height)
  },
  subscribe({ props, assetResolver, invalidate }) {
    const reference = readAssetReference(props.asset)
    return reference ? assetResolver?.subscribe?.(reference, invalidate) ?? (() => undefined) : () => undefined
  },
}
