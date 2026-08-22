import type { ComposeAssetContextMenuItem } from '@compose-ui/asset-browser'
import type { ComposeAssetProvider } from '@compose-ui/assets'
import {
  composeCadFileName,
  createEmptyCadDocument,
  importDxfDocument,
  type ComposeCadDescriptor,
  type ComposeCadStore,
  type DxfDiagnostic,
} from '@compose-ui/cad'
import type { EditorMessages } from '../editor-i18n'

/** CAD 上下文菜单项的稳定 ID。 @internal */
export const CAD_CONTEXT_MENU_ITEM_IDS = {
  createDocument: 'compose.cad.create',
  importDxf: 'compose.cad.import-dxf',
} as const

/** 判断一个条目是不是 DXF；只按扩展名，Provider 未必给出 mediaType。 */
function isDxfName(name: string | undefined) {
  return typeof name === 'string' && name.toLowerCase().endsWith('.dxf')
}

/**
 * 构建注入资源浏览器的 CAD 上下文菜单项。
 *
 * @remarks
 * 资源浏览器不认识 CAD，因此可见性与能力门禁都在这里求值。Provider 缺少创建或写入能力时
 * 该项渲染为**禁用**而不是消失——消失会让用户以为编辑器不支持 CAD，而实际原因是当前
 * Provider 只读。
 * @internal
 */
export function createCadContextMenuItems({
  messages,
  onDocumentCreated,
  onError,
  onNotice,
  provider,
  store,
}: {
  readonly messages: EditorMessages
  /** 创建成功后由调用方打开该文档。 */
  readonly onDocumentCreated: (descriptor: ComposeCadDescriptor) => void
  readonly onError: (message: string) => void
  /** 导入完成但有内容没能完整表达时的提示。 */
  readonly onNotice: (message: string) => void
  readonly provider: ComposeAssetProvider | undefined
  readonly store: ComposeCadStore | undefined
}): readonly ComposeAssetContextMenuItem[] {
  if (!store || !provider) return []
  const canCreate = typeof provider.createFile === 'function'
    && provider.capabilities.createFile !== false
    && typeof provider.writeFile === 'function'
    && provider.capabilities.write !== false
  return [
    {
      id: CAD_CONTEXT_MENU_ITEM_IDS.createDocument,
      label: messages.cad.createDocument,
      separatorBefore: true,
      isDisabled: () => !canCreate,
      onSelect: async (context) => {
        const name = await context.promptName({
          title: messages.cad.createDocumentTitle,
          initialValue: messages.cad.defaultDocumentName,
        })
        if (name === null || name.trim().length === 0) return
        try {
          const snapshot = await store.createDocument({
            parentId: context.parentId,
            // 无论用户输入 Topology 还是 Topology.cad.json 都归一化为同一文件名。
            fileName: composeCadFileName(name),
            document: createEmptyCadDocument(),
          })
          context.refresh()
          onDocumentCreated({
            entryId: snapshot.entryId,
            assetKey: snapshot.assetKey,
            displayName: name.trim(),
            revision: snapshot.revision,
          })
        }
        catch (error) {
          onError(error instanceof Error ? error.message : messages.cad.createFailed)
        }
      },
    },
    {
      id: CAD_CONTEXT_MENU_ITEM_IDS.importDxf,
      label: messages.cad.importDxf,
      // 只在 `.dxf` 上出现：这一项对别的文件毫无意义，常驻只会让菜单更长。
      isVisible: (context) => isDxfName(context.entry?.name),
      isDisabled: () => !canCreate,
      onSelect: async (context) => {
        const entry = context.entry
        if (!entry) return
        try {
          const read = await provider.read({ fileId: entry.id })
          const { document, diagnostics } = importDxfDocument(await read.blob.text())
          const name = entry.name.replace(/\.dxf$/i, '')
          const snapshot = await store.createDocument({
            parentId: context.parentId,
            fileName: composeCadFileName(name),
            document,
          })
          context.refresh()
          onDocumentCreated({
            entryId: snapshot.entryId,
            assetKey: snapshot.assetKey,
            displayName: name,
            revision: snapshot.revision,
          })
          // 静默丢弃是不可接受的：用户拿结果与原图一对，发现少了东西却没有解释，只会认为
          // 工具不可靠。
          if (diagnostics.length > 0) {
            onNotice(`${messages.cad.importDxfPartial}: ${summarizeDiagnostics(diagnostics)}`)
          }
        }
        catch (error) {
          onError(error instanceof Error ? error.message : messages.cad.importDxfFailed)
        }
      },
    },
  ]
}

/** 把诊断压成一行；同类已在导入器里聚合过，这里只负责拼。 */
function summarizeDiagnostics(diagnostics: readonly DxfDiagnostic[]) {
  return diagnostics.map(({ subject, count }) => `${subject} × ${count}`).join('、')
}
