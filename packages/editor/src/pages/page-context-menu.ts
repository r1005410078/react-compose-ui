import type { ComposeAssetContextMenuItem } from '@compose-ui/asset-browser'
import type { ComposeAssetProvider } from '@compose-ui/assets'
import { composePageFileName, isComposePageFileName } from '@compose-ui/core'
import type { ComposePageDescriptor, ComposePageStore } from '@compose-ui/pages'
import type { EditorMessages } from '../editor-i18n'

/** 页面上下文菜单项的稳定 ID。 @internal */
export const PAGE_CONTEXT_MENU_ITEM_IDS = {
  createPage: 'compose.page.create',
  setHomePage: 'compose.page.set-home',
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
  homePageKey,
  messages,
  onHomePageChange,
  onPageCreated,
  provider,
  store,
}: {
  /** 当前首页的稳定 key；未设置时为 null。 */
  readonly homePageKey: string | null
  readonly messages: EditorMessages
  /** 首页改写成功后通知宿主。 */
  readonly onHomePageChange: (pageKey: string | null) => void
  /**
   * 页面创建成功后由调用方打开该页面。
   *
   * @remarks
   * 传整个描述符而不是只传 key：页面的稳定 key 不一定是路径（内存 Provider 常用 UUID），
   * 无法由它反推出文件名与显示名。
   */
  readonly onPageCreated: (descriptor: ComposePageDescriptor) => void
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
        onPageCreated(created)
      },
    },
    {
      id: PAGE_CONTEXT_MENU_ITEM_IDS.setHomePage,
      label: messages.pages.setAsHomePage,
      // 只对页面文件出现：资源浏览器不认识页面，可见性判定只能在这里做。
      isVisible: (context) => context.entry !== undefined
        && isComposePageFileName(context.entry.name),
      isDisabled: (context) => !store.canWriteManifest()
        || context.entry?.assetKey === undefined
        || context.entry.assetKey === homePageKey,
      onSelect: async (context) => {
        const pageKey = context.entry?.assetKey
        if (pageKey === undefined) return
        const manifest = await store.setHomePage(pageKey)
        onHomePageChange(manifest.homePageKey)
      },
    },
  ]
}

/** 判断资源条目是否为页面文件。 @internal */
export function isPageEntry(name: string) {
  return isComposePageFileName(name)
}
