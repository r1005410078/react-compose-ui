import { getComposeFrame, getComposeRenderer, type ComposeDocument, type JsonValue } from '@compose-ui/core'
import { createComposeQmlScriptCompiler } from '@compose-ui/editor'
import { createComposeLayoutRuntime } from '@compose-ui/layout-engine'
import { createComposeBasicMaterials, solveComposeComponentInstances } from '@compose-ui/materials'
import { ComposePreview } from '@compose-ui/preview'
import { exportComposeSceneToQml, type ComposeQmlExportResult } from '@compose-ui/qml-export'
import { COMPOSE_PORTABLE_RUNTIME_SOURCE } from '@compose-ui/script-runtime'
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'

/** 脚本夹具里 setup 跑完之后各对象 Renderer prop 的期望值：Entity id → prop → 值。 */
type QtReferenceExpected = Readonly<Record<string, Readonly<Record<string, JsonValue>>>>

declare global {
  interface Window {
    /** 由端到端用例在页面加载前注入的夹具文档；只在 `?qt-reference` 模式下读取。 */
    __COMPOSE_QT_REFERENCE__?: ComposeDocument
    /** 脚本夹具的 setup 源码；缺席即没有页面脚本。 */
    __COMPOSE_QT_SETUP__?: string
    /** 脚本夹具跑完之后的期望值；预览一侧把它写进文档当参考图。 */
    __COMPOSE_QT_EXPECTED__?: QtReferenceExpected
    /** 本页对同一份夹具的 QML 导出结果，由端到端用例读出写盘。 */
    __COMPOSE_QT_EXPORT__?: ComposeQmlExportResult
    /** 导出是异步的（实例求解、脚本编译）；为 `true` 时结果还没到。 */
    __COMPOSE_QT_EXPORT_PENDING__?: boolean
  }
}

const { registry } = createComposeBasicMaterials()
const compiler = createComposeQmlScriptCompiler({ wasmURL: esbuildWasmUrl })

/** 把期望值写进文档的静态 props：预览不跑脚本，参考图画的就是「脚本跑完之后」的样子。 */
function applyExpected(document: ComposeDocument, expected: QtReferenceExpected | undefined): ComposeDocument {
  if (!expected || Object.keys(expected).length === 0) return document
  const entities = { ...document.entities }
  for (const [entityId, props] of Object.entries(expected)) {
    const entity = entities[entityId]
    const renderer = getComposeRenderer(entity)
    if (!entity || !renderer) continue
    entities[entityId] = {
      ...entity,
      components: { ...entity.components, Renderer: { ...renderer, props: { ...renderer.props, ...props } } },
    }
  }
  return { ...document, entities }
}

function useLayout(document: ComposeDocument | undefined) {
  const [runtime] = useState(() => (document ? createComposeLayoutRuntime({ document }) : null))
  const state = useSyncExternalStore(
    (listener) => runtime?.subscribe(listener) ?? (() => undefined),
    () => runtime?.getState() ?? null,
  )
  return { runtime, state }
}

/**
 * Qt 像素对比的预览一侧：只渲染一份夹具文档的根场景，并把同一份场景导出成 QML。
 *
 * @remarks
 * 夹具文档由用例在页面加载前注入，示例应用因此**不认识任何夹具**——夹具住在
 * `native/qt/fixtures/`。
 *
 * 没有脚本的夹具，预览与导出**共用一个布局 Runtime**：预览画的那一对「已解算文档 + 快照」正是
 * 交给导出器的那一对。各自求解一遍的话，两边的 Hug 文字可能量出不同的盒，像素对比比的就不再是
 * 转换本身。脚本夹具例外：预览画的是**写进期望值**的文档（预览不跑脚本），导出的是原文档加脚本，
 * 两份文档必须各自求解；脚本夹具的文字因此一律用固定尺寸的盒，两次求解给出同一组盒。
 *
 * `fit` 取 `none`：要比的是场景按真实像素渲染出来的样子，任何缩放都会让两边的光栅化不同。
 * 外面那层盒子按场景尺寸写死并贴在左上角，用例截的就是它。
 */
export function QtReferencePreview() {
  const document = window.__COMPOSE_QT_REFERENCE__
  const setupSource = window.__COMPOSE_QT_SETUP__
  const previewDocument = useMemo(
    () => (document ? applyExpected(document, window.__COMPOSE_QT_EXPECTED__) : undefined),
    [document],
  )
  const preview = useLayout(previewDocument)
  const separate = previewDocument !== document
  const exportLayout = useLayout(separate ? document : undefined)
  const exportState = separate ? exportLayout.state : preview.state

  useEffect(() => {
    const frameId = document?.rootIds[0]
    if (!frameId || exportState?.status !== 'ready' || exportState.sourceDocument !== document) return
    let cancelled = false
    window.__COMPOSE_QT_EXPORT_PENDING__ = true
    // 实例与脚本走编辑器导出同一条路径：同一个 Registry 逐个求解实例，同一个编译器降级 setup。
    void Promise.all([
      solveComposeComponentInstances({
        document: exportState.document,
        snapshot: exportState.snapshot,
        rootId: frameId,
        registry,
      }),
      setupSource === undefined ? Promise.resolve(undefined) : compiler.compile(setupSource),
    ]).then(([instances, setupModule]) => {
      if (cancelled) return
      window.__COMPOSE_QT_EXPORT__ = exportComposeSceneToQml({
        document: exportState.document,
        snapshot: exportState.snapshot,
        frameId,
        instances,
        pageScript: setupModule === undefined ? undefined : { setupModule, runtimeModule: COMPOSE_PORTABLE_RUNTIME_SOURCE },
      })
      window.__COMPOSE_QT_EXPORT_PENDING__ = false
    })
    return () => { cancelled = true }
  }, [document, exportState, setupSource])

  if (document === undefined || previewDocument === undefined || preview.runtime === null) {
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
      <ComposePreview document={previewDocument} fit="none" layoutRuntime={preview.runtime} registry={registry} />
    </div>
  )
}
