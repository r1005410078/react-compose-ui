import { getComposeFrame, type ComposeDocument } from '@compose-ui/core'
import { createComposeLayoutRuntime } from '@compose-ui/layout-engine'
import { createComposeBasicMaterials } from '@compose-ui/materials'
import { ComposePreview } from '@compose-ui/preview'
import { exportComposeSceneToQml, type ComposeQmlExportResult } from '@compose-ui/qml-export'
import { useEffect, useState, useSyncExternalStore } from 'react'

declare global {
  interface Window {
    /** 由端到端用例在页面加载前注入的夹具文档；只在 `?qt-reference` 模式下读取。 */
    __COMPOSE_QT_REFERENCE__?: ComposeDocument
    /** 本页对同一份夹具的 QML 导出结果，由端到端用例读出写盘。 */
    __COMPOSE_QT_EXPORT__?: ComposeQmlExportResult
  }
}

const { registry } = createComposeBasicMaterials()

/**
 * Qt 像素对比的预览一侧：只渲染一份夹具文档的根场景，并把同一份场景导出成 QML。
 *
 * @remarks
 * 夹具文档由用例在页面加载前注入，示例应用因此**不认识任何夹具**——夹具住在
 * `native/qt/fixtures/`。
 *
 * 预览与导出**共用一个布局 Runtime**：预览画的那一对「已解算文档 + 快照」正是交给导出器的那
 * 一对。各自求解一遍的话，两边的 Hug 文字可能量出不同的盒，像素对比比的就不再是转换本身。
 *
 * `fit` 取 `none`：要比的是场景按真实像素渲染出来的样子，任何缩放都会让两边的光栅化不同。
 * 外面那层盒子按场景尺寸写死并贴在左上角，用例截的就是它。
 */
export function QtReferencePreview() {
  const document = window.__COMPOSE_QT_REFERENCE__
  const [runtime] = useState(() => (document ? createComposeLayoutRuntime({ document }) : null))
  const state = useSyncExternalStore(
    (listener) => runtime?.subscribe(listener) ?? (() => undefined),
    () => runtime?.getState() ?? null,
  )

  useEffect(() => {
    const frameId = document?.rootIds[0]
    if (!frameId || state?.status !== 'ready' || state.sourceDocument !== document) return
    window.__COMPOSE_QT_EXPORT__ = exportComposeSceneToQml({
      document: state.document,
      snapshot: state.snapshot,
      frameId,
    })
  }, [document, state])

  if (document === undefined || runtime === null) {
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
      <ComposePreview document={document} fit="none" layoutRuntime={runtime} registry={registry} />
    </div>
  )
}
