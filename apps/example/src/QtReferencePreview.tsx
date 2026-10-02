import { getComposeFrame, type ComposeDocument } from '@compose-ui/core'
import { createComposeBasicMaterials } from '@compose-ui/materials'
import { ComposePreview } from '@compose-ui/preview'

declare global {
  interface Window {
    /** 由端到端用例在页面加载前注入的夹具文档；只在 `?qt-reference` 模式下读取。 */
    __COMPOSE_QT_REFERENCE__?: ComposeDocument
  }
}

const { registry } = createComposeBasicMaterials()

/**
 * Qt 像素对比的预览一侧：只渲染一份夹具文档的根场景，别的什么都不画。
 *
 * @remarks
 * 夹具文档由用例在页面加载前注入，示例应用因此**不认识任何夹具**——夹具住在
 * `native/qt/fixtures/`，与 Qt 一侧读的是同一份文件。
 *
 * `fit` 取 `none`：要比的是场景按真实像素渲染出来的样子，任何缩放都会让两边的光栅化不同。
 * 外面那层盒子按场景尺寸写死并贴在左上角，用例截的就是它。
 */
export function QtReferencePreview() {
  const document = window.__COMPOSE_QT_REFERENCE__
  if (document === undefined) {
    return <p role="status">未注入 Qt 对照夹具文档。</p>
  }
  const frameId = document.rootIds[0]
  const frameSize = getComposeFrame(frameId === undefined ? undefined : document.entities[frameId])?.size
  return (
    <div
      data-testid="qt-reference-frame"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: frameSize?.width,
        height: frameSize?.height,
        overflow: 'hidden',
      }}
    >
      <ComposePreview document={document} fit="none" registry={registry} />
    </div>
  )
}
