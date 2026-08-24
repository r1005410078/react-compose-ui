import type { ComposeAssetContextMenuItem } from '@compose-ui/asset-browser'
import type { ComposeAssetProvider } from '@compose-ui/assets'
import {
  composeCadFileName,
  createEmptyCadDocument,
  type ComposeCadDescriptor,
  type ComposeCadStore,
} from '@compose-ui/cad'
import type { EditorMessages } from '../editor-i18n'

/** CAD 上下文菜单项的稳定 ID。 @internal */
export const CAD_CONTEXT_MENU_ITEM_IDS = {
  createDocument: 'compose.cad.create',
} as const

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
  provider,
  store,
}: {
  readonly messages: EditorMessages
  /** 创建成功后由调用方打开该文档。 */
  readonly onDocumentCreated: (descriptor: ComposeCadDescriptor) => void
  readonly onError: (message: string) => void
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
  ]
}
