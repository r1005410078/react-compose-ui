import type { ComposeAssetContextMenuItem } from '@compose-ui/asset-browser'
import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
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

/** 这个条目是不是 `.dxf`。菜单项与双击读同一份判断。 @public */
export function isDxfAssetName(name: string | undefined) {
  return typeof name === 'string' && /\.dxf$/i.test(name)
}

/** 把诊断压成一行；同类已在导入器里聚合过，这里只负责拼。 */
function summarizeDiagnostics(diagnostics: readonly DxfDiagnostic[]) {
  return diagnostics.map(({ subject, count }) => `${subject} × ${count}`).join('、')
}

/** {@link createDxfImportAction} 的依赖。 @internal */
export interface DxfImportActionDeps {
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
}

/**
 * 把一个 `.dxf` 条目导入成页面。
 *
 * @remarks
 * **右键菜单与双击是同一条实现的两个入口**，不是两份代码：双击一份图纸，用户要的就是那块
 * 场景而不是一个打不开的预览标签，而右键那条路早就在做这件事。分开写的话两者迟早在诊断、
 * 刷新或失败处理上分家，而那种差异用户无从解释。
 *
 * 返回 `null` 表示缺 Store、根本无从导入；`canCreate` 为假表示当前目录只读。两者分开是因为
 * 调用方对它们的反应不同：前者不提供入口，后者提供但禁用——消失会让用户以为编辑器不支持
 * DXF，而实际原因是当前 Provider 只读。
 *
 * @internal
 */
export function createDxfImportAction(deps: DxfImportActionDeps) {
  const { componentStore, pageStore, provider, registry } = deps
  if (!provider || !componentStore || !pageStore || !registry) return null
  const canCreate = typeof provider.createFile === 'function'
    && provider.capabilities.createFile !== false
  return {
    canCreate,
    run: async (entry: ComposeAssetEntry, parentId: string | null, refresh: () => void) => {
      try {
        const read = await provider.read({ fileId: entry.id })
        const { page, diagnostics } = await importDxfAsPage({
          text: await read.blob.text(),
          name: entry.name.replace(/\.dxf$/i, ''),
          parentId,
          provider,
          componentStore,
          pageStore,
          registry,
          idFactory: deps.idFactory,
        })
        refresh()
        deps.onPageCreated(page)
        // 静默丢弃是不可接受的：用户拿结果与原图一对，发现少了东西却没有解释，只会认为
        // 工具不可靠。
        if (diagnostics.length > 0) {
          deps.onNotice(`${deps.messages.dxf.importPartial}: ${summarizeDiagnostics(diagnostics)}`)
        }
      }
      catch (error) {
        deps.onError(error instanceof Error ? error.message : deps.messages.dxf.importFailed)
      }
    },
  }
}

/**
 * 创建 `.dxf` 的资源浏览器上下文菜单项。
 *
 * @remarks
 * 只在 `.dxf` 上出现：这一项对别的文件毫无意义，常驻只会让菜单更长。导入本身走
 * {@link createDxfImportAction}，与双击是同一条实现。
 *
 * @public
 */
export function createDxfContextMenuItems(
  deps: DxfImportActionDeps,
): readonly ComposeAssetContextMenuItem[] {
  const action = createDxfImportAction(deps)
  if (!action) return []
  return [
    {
      id: DXF_CONTEXT_MENU_ITEM_IDS.importAsPage,
      label: deps.messages.dxf.importAsPage,
      isVisible: (context) => isDxfAssetName(context.entry?.name),
      isDisabled: () => !action.canCreate,
      onSelect: async (context) => {
        const entry = context.entry
        if (!entry) return
        await action.run(entry, context.parentId, () => { context.refresh() })
      },
    },
  ]
}
