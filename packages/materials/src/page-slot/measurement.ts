import type { ComposeRendererMeasurementDefinition } from '@compose-ui/component-registry'
import { readComposePageReference } from '@compose-ui/core'
import { constrainIntrinsicSize } from '../renderer-measurement/intrinsic-size'

/** Page Slot Renderer 的目标 v6 页面 output 尺寸测量。 @internal */
export const PAGE_SLOT_RENDERER_MEASUREMENT: ComposeRendererMeasurementDefinition = {
  async prepare({ props, pageDocumentPort, signal }) {
    const reference = readComposePageReference(props.page)
    if (!reference || !pageDocumentPort) throw new Error('Page Slot 文档加载器不可用')
    const document = await pageDocumentPort.load(reference, signal)
    return { width: document.output.width, height: document.output.height }
  },
  measure({ prepared, width, height }) {
    const size = prepared as { readonly width: number; readonly height: number } | undefined
    if (!size) return null
    return constrainIntrinsicSize(size, width, height)
  },
  subscribe({ props, pageDocumentPort, invalidate }) {
    const reference = readComposePageReference(props.page)
    return reference
      ? pageDocumentPort?.subscribe?.(reference, invalidate) ?? (() => undefined)
      : () => undefined
  },
}
