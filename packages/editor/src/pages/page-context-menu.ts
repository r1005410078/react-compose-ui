import type { ComposeAssetContextMenuItem } from '@compose-ui/asset-browser'
import type { ComposeAssetProvider } from '@compose-ui/assets'
import { composePageFileName, isComposePageFileName } from '@compose-ui/core'
import type { ComposePageStore } from '@compose-ui/pages'
import type { EditorMessages } from '../editor-i18n'

/** 页面上下文菜单项的稳定 ID。 @internal */
export const PAGE_CONTEXT_MENU_ITEM_IDS = {
  createPage: 'compose.page.create',
} as const

/**
 * 构建注入资源浏览器的页面上下文菜单项。
 *
 * @remarks
 * 资源浏览器不认识页面，因此可见性与能力门禁都在这里求值：只有页面文件才显示页面专属操作，
 * Provider 缺少创建或写入能力时对应项渲染为禁用。
 * @internal
 */
export function createPageContextMenuItems({
  messages,
  onPageCreated,
  provider,
  store,
}: {
  readonly messages: EditorMessages
  /** 页面创建成功后由调用方打开该页面。 */
  readonly onPageCreated: (pageKey: string, entryId: string) => void
  readonly provider: ComposeAssetProvider | undefined
  readonly store: ComposePageStore | undefined
}): readonly ComposeAssetContextMenuItem[] {
  if (!store || !provider) return []
  const canCreate = typeof provider.createFile === 'function'
    && provider.capabilities.createFile !== false
    && typeof provider.writeFile === 'function'
    && provider.capabilities.write !== false
  return [
    {
      id: PAGE_CONTEXT_MENU_ITEM_IDS.createPage,
      label: messages.pages.createPage,
      separatorBefore: true,
      isDisabled: () => !canCreate,
      onSelect: async (context) => {
        const name = await context.promptName({
          title: messages.pages.createPageTitle,
          initialValue: messages.pages.defaultPageName,
        })
        if (name === null || name.trim().length === 0) return
        const created = await store.createPage({
          parentId: context.parentId,
          // 无论用户输入 Home 还是 Home.page.json 都归一化为同一文件名。
          fileName: composePageFileName(name),
        })
        context.refresh()
        onPageCreated(created.pageKey, created.entryId)
      },
    },
  ]
}

/** 判断资源条目是否为页面文件。 @internal */
export function isPageEntry(name: string) {
  return isComposePageFileName(name)
}
