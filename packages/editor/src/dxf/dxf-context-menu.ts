import type { ComposeAssetContextMenuItem } from '@compose-ui/asset-browser'
import type { ComposeAssetProvider } from '@compose-ui/assets'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type { ComposeComponentStore } from '@compose-ui/component-library'
import type { ComposePageDescriptor, ComposePageStore } from '@compose-ui/pages'
import type { DxfDiagnostic } from '@compose-ui/dxf'
import type { EditorMessages } from '../editor-i18n'
import { importDxfAsPage } from './import-dxf-as-page'

/** DXF 上下文菜单项 ID。 @public */
export const DXF_CONTEXT_MENU_ITEM_IDS = {
  importAsPage: 'compose.dxf.import-as-page',
} as const

function isDxfName(name: string | undefined) {
  return typeof name === 'string' && /\.dxf$/i.test(name)
}

/** 把诊断压成一行；同类已在导入器里聚合过，这里只负责拼。 */
function summarizeDiagnostics(diagnostics: readonly DxfDiagnostic[]) {
  return diagnostics.map(({ subject, count }) => `${subject} × ${count}`).join('、')
}

/**
 * 创建 `.dxf` 的资源浏览器上下文菜单项。
 *
 * @remarks
 * 只在 `.dxf` 上出现：这一项对别的文件毫无意义，常驻只会让菜单更长。
 *
 * @public
 */
export function createDxfContextMenuItems({
  componentStore,
  idFactory,
  messages,
  onError,
  onNotice,
  onPageCreated,
  pageStore,
  provider,
  registry,
}: {
  readonly componentStore: ComposeComponentStore | null | undefined
  readonly idFactory: () => string
  readonly messages: EditorMessages
  readonly onError: (message: string) => void
  /** 导入完成但有内容没能完整表达时的提示。 */
  readonly onNotice: (message: string) => void
  readonly onPageCreated: (page: ComposePageDescriptor) => void
  readonly pageStore: ComposePageStore | null | undefined
  readonly provider: ComposeAssetProvider | null | undefined
  readonly registry: ComposeEntityRegistry | null | undefined
}): readonly ComposeAssetContextMenuItem[] {
  if (!provider || !componentStore || !pageStore || !registry) return []
  const canCreate = typeof provider.createFile === 'function'
    && provider.capabilities.createFile !== false
  return [
    {
      id: DXF_CONTEXT_MENU_ITEM_IDS.importAsPage,
      label: messages.dxf.importAsPage,
      isVisible: (context) => isDxfName(context.entry?.name),
      isDisabled: () => !canCreate,
      onSelect: async (context) => {
        const entry = context.entry
        if (!entry) return
        try {
          const read = await provider.read({ fileId: entry.id })
          const { page, diagnostics } = await importDxfAsPage({
            text: await read.blob.text(),
            name: entry.name.replace(/\.dxf$/i, ''),
            parentId: context.parentId,
            componentStore,
            pageStore,
            registry,
            idFactory,
          })
          context.refresh()
          onPageCreated(page)
          // 静默丢弃是不可接受的：用户拿结果与原图一对，发现少了东西却没有解释，只会认为
          // 工具不可靠。
          if (diagnostics.length > 0) {
            onNotice(`${messages.dxf.importPartial}: ${summarizeDiagnostics(diagnostics)}`)
          }
        }
        catch (error) {
          onError(error instanceof Error ? error.message : messages.dxf.importFailed)
        }
      },
    },
  ]
}
