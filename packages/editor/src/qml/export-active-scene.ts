import type { ComposeDocument, ComposeLayoutSnapshot } from '@compose-ui/core'
import {
  exportComposeSceneToQml,
  type ComposeQmlExportDiagnostic,
} from '@compose-ui/qml-export'
import { resolveTargetFrameId } from '@compose-ui/stage-engine'

/** 导出提示用到的文案；由编辑器的 i18n 注入。 @internal */
export interface QmlExportMessages {
  readonly exported: string
  readonly exportPartial: string
  readonly exportFailed: string
  readonly fontsNeeded: string
}

/** 一次导出的结果：要交给用户的文件与一行提示。 @internal */
export type QmlExportOutcome =
  | { readonly ok: true; readonly fileName: string; readonly qml: string; readonly notice: string }
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
function qmlFileName(document: ComposeDocument, frameId: string) {
  const name = (document.entities[frameId]?.name ?? '').replace(/[\\/:*?"<>|]/g, '').trim()
  return `${name || frameId}.qml`
}

/**
 * 导出当前激活场景。
 *
 * @remarks
 * 输入是编辑器布局 Runtime 交出来的「已解算文档 + 快照」——画布与预览正在画的那一对，因此
 * 导出包含尚未保存的改动，文字盒也是用同一个测量端口量出来的。场景取**激活场景**而不跟选区：
 * 它是「发布目标」，与预览默认目标同一个判据。
 *
 * @param input - 已解算文档、快照、页面上记录的激活场景与提示文案
 * @returns 要下载的文件与提示；失败时只有提示
 */
export function exportActiveSceneAsQml(input: {
  readonly layoutDocument: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly activeFrameId: string | null
  readonly messages: QmlExportMessages
}): QmlExportOutcome {
  const { layoutDocument, layoutSnapshot, messages } = input
  const frameId = resolveTargetFrameId(layoutDocument, [], input.activeFrameId)
  if (!frameId) return { ok: false, notice: messages.exportFailed }
  try {
    const result = exportComposeSceneToQml({ document: layoutDocument, snapshot: layoutSnapshot, frameId })
    const fileName = qmlFileName(layoutDocument, frameId)
    const fonts = result.fontFamilies.length > 0
      ? ` ${messages.fontsNeeded}：${result.fontFamilies.join('、')}。`
      : ''
    const notice = result.diagnostics.length > 0
      ? `${messages.exportPartial}（${fileName}）：${summarizeDiagnostics(result.diagnostics)}${fonts}`
      : `${messages.exported}：${fileName}。${fonts}`
    return { ok: true, fileName, qml: result.qml, notice: notice.trim() }
  }
  catch (error) {
    return {
      ok: false,
      notice: error instanceof Error ? `${messages.exportFailed}：${error.message}` : messages.exportFailed,
    }
  }
}

/**
 * 让浏览器把一段文本存成文件。
 *
 * @remarks
 * Blob URL 在点击之后立即释放：下载由浏览器接管，URL 留着只会泄漏。
 */
export function downloadTextFile(fileName: string, text: string, ownerDocument: Document = document) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const anchor = ownerDocument.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  ownerDocument.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
