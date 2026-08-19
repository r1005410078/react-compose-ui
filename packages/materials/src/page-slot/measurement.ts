import type { ComposeRendererMeasurementDefinition } from '@compose-ui/component-registry'
import {
  getComposeFrame,
  readComposePageReference,
  resolveComposePageActiveFrameId,
  type ComposeDocument,
} from '@compose-ui/core'
import { constrainIntrinsicSize } from '../renderer-measurement/intrinsic-size'

/**
 * 读取一份页面文档中指定 Frame 的尺寸。
 *
 * @remarks
 * v7 没有文档级输出：页面的"输出尺寸"就是它激活场景的尺寸。
 */
function readPageFrameSize(
  document: ComposeDocument,
  frameId: string | null,
): { readonly width: number; readonly height: number } | null {
  const frame = frameId ? getComposeFrame(document.entities[frameId]) : null
  return frame ? { width: frame.size.width, height: frame.size.height } : null
}

/** Page Slot Renderer 的目标页面激活场景尺寸测量。 @internal */
export const PAGE_SLOT_RENDERER_MEASUREMENT: ComposeRendererMeasurementDefinition = {
  async prepare({ props, pageDocumentPort, signal }) {
    const reference = readComposePageReference(props.page)
    if (!reference || !pageDocumentPort) throw new Error('Page Slot 文档加载器不可用')
    const page = await pageDocumentPort.load(reference, signal)
    const size = readPageFrameSize(page.document, resolveComposePageActiveFrameId(page))
    if (!size) throw new Error('被引用页面没有激活场景')
    return size
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
