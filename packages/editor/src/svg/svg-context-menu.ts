import type { ComposeAssetContextMenuItem } from '@compose-ui/asset-browser'
import type { ComposeAssetProvider } from '@compose-ui/assets'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type { ComposeComponentSnapshot, ComposeComponentStore } from '@compose-ui/component-library'
import type { SvgDiagnostic } from '@compose-ui/svg-import'
import type { EditorMessages } from '../editor-i18n'
import { importSvgAsComponent } from './import-svg-as-component'

/** SVG 上下文菜单项 ID。 @public */
export const SVG_CONTEXT_MENU_ITEM_IDS = {
  importAsComponent: 'compose.svg.import-as-component',
} as const

function isSvgName(name: string | undefined) {
  return typeof name === 'string' && /\.svg$/i.test(name)
}

/** 把诊断压成一行；同类已在导入器里聚合过，这里只负责拼。 */
function summarizeDiagnostics(diagnostics: readonly SvgDiagnostic[]) {
  return diagnostics.map(({ subject, count }) => `${subject} × ${count}`).join('、')
}

/**
 * 创建 `.svg` 的资源浏览器上下文菜单项。
 *
 * @remarks
 * 只在 `.svg` 上出现：这一项对别的文件毫无意义，常驻只会让菜单更长。这与 DXF 那一项是同一条
 * 判断。
 *
 * 导入完成后**打开组件文档**：用户接下来要做的是改这个符号（改色、挂端口、打动画），而那要
 * 在组件文档里做。把它摆到图上是另一件事，组件库的拖放入口已经做了。
 *
 * @public
 */
export function createSvgContextMenuItems({
  componentStore,
  idFactory,
  messages,
  onComponentCreated,
  onError,
  onNotice,
  provider,
  registry,
}: {
  readonly componentStore: ComposeComponentStore | null | undefined
  readonly idFactory: () => string
  readonly messages: EditorMessages
  /** 导入成功后交给宿主打开组件文档。 */
  readonly onComponentCreated: (component: ComposeComponentSnapshot) => void
  readonly onError: (message: string) => void
  /** 导入完成但有内容没能完整表达时的提示。 */
  readonly onNotice: (message: string) => void
  readonly provider: ComposeAssetProvider | null | undefined
  readonly registry: ComposeEntityRegistry | null | undefined
}): readonly ComposeAssetContextMenuItem[] {
  if (!provider || !componentStore || !registry) return []
  const canCreate = typeof provider.createFile === 'function'
    && provider.capabilities.createFile !== false
  return [
    {
      id: SVG_CONTEXT_MENU_ITEM_IDS.importAsComponent,
      label: messages.svg.importAsComponent,
      isVisible: (context) => isSvgName(context.entry?.name),
      isDisabled: () => !canCreate,
      onSelect: async (context) => {
        const entry = context.entry
        if (!entry) return
        try {
          const read = await provider.read({ fileId: entry.id })
          const { component, diagnostics } = await importSvgAsComponent({
            text: await read.blob.text(),
            name: entry.name.replace(/\.svg$/i, ''),
            parentId: context.parentId,
            componentStore,
            provider,
            registry,
            idFactory,
          })
          context.refresh()
          onComponentCreated(component)
          // 静默丢弃是不可接受的：用户拿结果与原图一对，发现少了东西却没有解释，只会认为
          // 工具不可靠。
          if (diagnostics.length > 0) {
            onNotice(`${messages.svg.importPartial}: ${summarizeDiagnostics(diagnostics)}`)
          }
        }
        catch (error) {
          onError(error instanceof Error ? error.message : messages.svg.importFailed)
        }
      },
    },
  ]
}
