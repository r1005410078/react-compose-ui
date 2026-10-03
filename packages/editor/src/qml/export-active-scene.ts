import type { ComposeDocument, ComposeLayoutSnapshot } from '@compose-ui/core'
import {
  exportComposeSceneToQml,
  type ComposeQmlExportDiagnostic,
  type ComposeQmlExportFile,
  type ComposeQmlInstanceContent,
} from '@compose-ui/qml-export'
import { COMPOSE_PORTABLE_RUNTIME_SOURCE } from '@compose-ui/script-runtime'
import { resolveTargetFrameId } from '@compose-ui/stage-engine'
import { strToU8, zipSync } from 'fflate'
import type { ComposeEditorQmlScriptCompiler } from './compile-setup'

/** 导出提示用到的文案；由编辑器的 i18n 注入。 @internal */
export interface QmlExportMessages {
  readonly exporting: string
  readonly exported: string
  readonly exportPartial: string
  readonly exportFailed: string
  readonly fontsNeeded: string
  /** 页面有 setup 但宿主没有注入编译器，脚本没有随导出。 */
  readonly scriptSkipped: string
  /** 页面 setup 降级编译失败。 */
  readonly scriptCompileFailed: string
}

/**
 * 宿主注入的组件实例求解：对场景里的每个实例（含嵌套）准备并求解嵌套文档，按复合地址索引。
 *
 * @remarks
 * 编辑器不依赖物料包——实例的准备管线住在那里，由宿主注入；`@compose-ui/materials` 的
 * `solveComposeComponentInstances` 绑定好 Registry 与资源解析器即是一个实现。缺席时实例导出为
 * 同尺寸占位。
 *
 * @public
 */
export type ComposeEditorQmlInstanceResolver = (input: {
  readonly document: ComposeDocument
  readonly snapshot: ComposeLayoutSnapshot
  readonly rootId: string
}) => Promise<ReadonlyMap<string, ComposeQmlInstanceContent>>

/** 一次导出的结果：要交给用户的文件与一行提示。 @internal */
export type QmlExportOutcome =
  | {
      readonly ok: true
      /** 只有场景文件时是 `.qml`，带页面脚本时是整个产物目录的 `.zip`。 */
      readonly fileName: string
      readonly content: string | Uint8Array
      /** 产物文件清单（zip 里的内容），供测试与宿主检查。 */
      readonly files: readonly ComposeQmlExportFile[]
      readonly notice: string
    }
  | { readonly ok: false; readonly notice: string }

/**
 * 把诊断压成一行：同一类只说一次，后面跟处数。
 *
 * @remarks
 * 一张接线图上几十个图表占位逐条列出来是一堵墙，用户读不出「到底少了哪几类东西」；按类聚合
 * 之后，每一类给出第一条的说明作为代表。
 */
function summarizeDiagnostics(diagnostics: readonly ComposeQmlExportDiagnostic[]) {
  const groups = new Map<string, { readonly message: string; count: number }>()
  for (const diagnostic of diagnostics) {
    const group = groups.get(diagnostic.code)
    if (group) group.count += 1
    else groups.set(diagnostic.code, { message: diagnostic.message, count: 1 })
  }
  return [...groups.values()]
    .map(({ message, count }) => (count > 1 ? `${message}（共 ${count} 处）` : message))
    .join(' ')
}

/** 文件名取场景名；去掉文件系统不接受的字符，空了就退回场景 id。 */
function sceneFileStem(document: ComposeDocument, frameId: string) {
  const name = (document.entities[frameId]?.name ?? '').replace(/[\\/:*?"<>|]/g, '').trim()
  return name || frameId
}

/**
 * 导出当前激活场景。
 *
 * @remarks
 * 输入是编辑器布局 Runtime 交出来的「已解算文档 + 快照」——画布与预览正在画的那一对，因此
 * 导出包含尚未保存的改动，文字盒也是用同一个测量端口量出来的。场景取**激活场景**而不跟选区：
 * 它是「发布目标」，与预览默认目标同一个判据。
 *
 * 组件实例先经宿主注入的 `resolveInstances` 逐个求解再交给导出器；求解是异步的（嵌套 Yoga），
 * 因此整个导出是异步的。
 *
 * @param input - 已解算文档、快照、页面上记录的激活场景、实例求解与提示文案
 * @returns 要下载的文件与提示；失败时只有提示
 */
export async function exportActiveSceneAsQml(input: {
  readonly layoutDocument: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly activeFrameId: string | null
  readonly resolveInstances?: ComposeEditorQmlInstanceResolver
  /** 读当前页面 setup 的源码；没有 setup 的页面返回 `null`。 */
  readonly loadSetupSource?: () => Promise<string | null>
  readonly scriptCompiler?: ComposeEditorQmlScriptCompiler
  readonly messages: QmlExportMessages
}): Promise<QmlExportOutcome> {
  const { layoutDocument, layoutSnapshot, messages } = input
  const frameId = resolveTargetFrameId(layoutDocument, [], input.activeFrameId)
  if (!frameId) return { ok: false, notice: messages.exportFailed }
  try {
    const instances = await input.resolveInstances?.({
      document: layoutDocument,
      snapshot: layoutSnapshot,
      rootId: frameId,
    })
    const setupSource = await input.loadSetupSource?.() ?? null
    let pageScript: { readonly setupModule: string; readonly runtimeModule: string } | undefined
    let scriptNotice = ''
    if (setupSource !== null && input.scriptCompiler) {
      let setupModule: string
      try {
        setupModule = await input.scriptCompiler.compile(setupSource)
      }
      catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        return { ok: false, notice: `${messages.scriptCompileFailed}：${reason}` }
      }
      pageScript = { setupModule, runtimeModule: COMPOSE_PORTABLE_RUNTIME_SOURCE }
    }
    else if (setupSource !== null) {
      // 有脚本而宿主没给编译器：照样交付静态场景，但要说出来——否则用户在 Qt 里看到一张不动的图，
      // 不知道是脚本没跑还是脚本没导出。
      scriptNotice = ` ${messages.scriptSkipped}`
    }
    const result = exportComposeSceneToQml({
      document: layoutDocument,
      snapshot: layoutSnapshot,
      frameId,
      instances,
      pageScript,
    })
    const stem = sceneFileStem(layoutDocument, frameId)
    // 只有场景一个文件时照旧下载 .qml；带脚本时产物是一个目录（setup 与 ComposeRuntime/），打成 zip。
    const archive = result.files.length > 1
    const fileName = archive ? `${stem}.zip` : `${stem}.qml`
    const content = archive
      ? zipSync(Object.fromEntries(result.files.map((file) => [file.path, strToU8(file.content)])))
      : result.qml
    const fonts = result.fontFamilies.length > 0
      ? ` ${messages.fontsNeeded}：${result.fontFamilies.join('、')}。`
      : ''
    const notice = result.diagnostics.length > 0
      ? `${messages.exportPartial}（${fileName}）：${summarizeDiagnostics(result.diagnostics)}${fonts}${scriptNotice}`
      : `${messages.exported}：${fileName}。${fonts}${scriptNotice}`
    return { ok: true, fileName, content, files: result.files, notice: notice.trim() }
  }
  catch (error) {
    return {
      ok: false,
      notice: error instanceof Error ? `${messages.exportFailed}：${error.message}` : messages.exportFailed,
    }
  }
}

/**
 * 让浏览器把一段文本或二进制内容存成文件。
 *
 * @remarks
 * Blob URL 在点击之后立即释放：下载由浏览器接管，URL 留着只会泄漏。
 */
export function downloadFile(fileName: string, content: string | Uint8Array, ownerDocument: Document = document) {
  const blob = typeof content === 'string'
    ? new Blob([content], { type: 'text/plain;charset=utf-8' })
    : new Blob([content as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const anchor = ownerDocument.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  ownerDocument.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
