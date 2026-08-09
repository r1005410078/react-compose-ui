import type { ComposeAssetContextMenuItem } from '@compose-ui/asset-browser'
import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
import {
  composePageDisplayName,
  composePageFileName,
  isComposePageMediaType,
  type ComposePageSetupReference,
} from '@compose-ui/core'
import type { ComposePageDescriptor, ComposePageStore } from '@compose-ui/pages'
import type { EditorMessages } from '../editor-i18n'

/** 页面上下文菜单项的稳定 ID。 @internal */
export const PAGE_CONTEXT_MENU_ITEM_IDS = {
  createPage: 'compose.page.create',
  setHomePage: 'compose.page.set-home',
  openJson: 'compose.page.open-json',
  createSetup: 'compose.page.setup.create',
  openSetup: 'compose.page.setup.open',
  changeSetup: 'compose.page.setup.change',
  unlinkSetup: 'compose.page.setup.unlink',
} as const

/** 新页面脚本与 Inspector 快捷创建共用的自包含模板。 @internal */
export const DEFAULT_PAGE_SETUP_SCRIPT = `export function setup(ctx) {
  const num = ctx.state(0)

  const onAdd = () => {
    num.value += 1
  }

  return { num, onAdd }
}
`

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
  onOpenPageJson,
  onPageCreated,
  onOpenPageSetup,
  onPageSetupChanged,
  onPageSetupError,
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
  /** 以只读方式查看页面的原始 JSON。 */
  readonly onOpenPageJson: (entry: ComposeAssetEntry) => void
  readonly onOpenPageSetup: (entry: ComposeAssetEntry) => void
  readonly onPageSetupChanged: (
    pageKey: string,
    reference: ComposePageSetupReference | null,
  ) => Promise<void>
  readonly onPageSetupError: (message: string) => void
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
        && isComposePageMediaType(context.entry.mediaType),
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
    {
      id: PAGE_CONTEXT_MENU_ITEM_IDS.openJson,
      label: messages.pages.openJsonConfig,
      isVisible: (context) => context.entry !== undefined
        && isComposePageMediaType(context.entry.mediaType),
      isDisabled: (context) => context.entry?.assetKey === undefined,
      onSelect: (context) => {
        if (context.entry) onOpenPageJson(context.entry)
      },
    },
    {
      id: PAGE_CONTEXT_MENU_ITEM_IDS.createSetup,
      label: messages.pages.createSetupScript,
      isVisible: (context) => context.entry !== undefined
        && isComposePageMediaType(context.entry.mediaType),
      isDisabled: (context) => !canCreate || context.entry?.assetKey === undefined,
      onSelect: async (context) => {
        const page = context.entry
        if (!page?.assetKey || !provider.createFile) return
        let created: ComposeAssetEntry | undefined
        try {
          created = await provider.createFile({
            parentId: page.parentId ?? provider.root.id,
            name: `${composePageDisplayName(page.name)}.setup.js`,
            content: new Blob([DEFAULT_PAGE_SETUP_SCRIPT], { type: 'text/javascript' }),
          })
          if (!created.assetKey) throw new Error('创建的脚本缺少稳定 assetKey')
          await onPageSetupChanged(page.assetKey, {
            providerId: provider.id,
            assetKey: created.assetKey,
            scope: provider.referenceScope ?? 'persistent',
          })
          context.refresh(page.parentId)
          onOpenPageSetup({ ...created, mediaType: created.mediaType ?? 'text/javascript' })
        }
        catch {
          onPageSetupError(created ? messages.pages.setupOrphaned : messages.pages.setupOperationFailed)
        }
      },
    },
    {
      id: PAGE_CONTEXT_MENU_ITEM_IDS.openSetup,
      label: messages.pages.openSetupScript,
      isVisible: (context) => context.entry !== undefined
        && isComposePageMediaType(context.entry.mediaType),
      onSelect: async (context) => {
        const page = context.entry
        if (!page?.assetKey) return
        try {
          const snapshot = await store.readPage(page.assetKey)
          const reference = snapshot.page.setupScript
          if (!reference) return
          const siblings = await provider.list({ folderId: page.parentId ?? provider.root.id })
          const entry = siblings.find((item) => item.assetKey === reference.assetKey)
          onOpenPageSetup(entry ?? {
            id: reference.assetKey,
            parentId: page.parentId,
            name: reference.assetKey.split('/').pop() ?? reference.assetKey,
            kind: 'file',
            mediaType: 'text/javascript',
            assetKey: reference.assetKey,
          })
        }
        catch {
          onPageSetupError(messages.pages.setupOperationFailed)
        }
      },
    },
    {
      id: PAGE_CONTEXT_MENU_ITEM_IDS.changeSetup,
      label: messages.pages.changeSetupScript,
      isVisible: (context) => context.entry !== undefined
        && isComposePageMediaType(context.entry.mediaType),
      isDisabled: (context) => provider.capabilities.write === false
        || typeof provider.writeFile !== 'function'
        || context.entry?.assetKey === undefined,
      onSelect: async (context) => {
        const page = context.entry
        if (!page?.assetKey) return
        const assetKey = await context.promptName({
          title: messages.pages.setupAssetKeyTitle,
          initialValue: '',
        })
        if (!assetKey?.trim()) return
        try {
          await onPageSetupChanged(page.assetKey, {
            providerId: provider.id,
            assetKey: assetKey.trim(),
            scope: provider.referenceScope ?? 'persistent',
          })
        }
        catch {
          onPageSetupError(messages.pages.setupOperationFailed)
        }
      },
    },
    {
      id: PAGE_CONTEXT_MENU_ITEM_IDS.unlinkSetup,
      label: messages.pages.unlinkSetupScript,
      isVisible: (context) => context.entry !== undefined
        && isComposePageMediaType(context.entry.mediaType),
      isDisabled: (context) => provider.capabilities.write === false
        || typeof provider.writeFile !== 'function'
        || context.entry?.assetKey === undefined,
      onSelect: async (context) => {
        const pageKey = context.entry?.assetKey
        if (!pageKey) return
        try {
          await onPageSetupChanged(pageKey, null)
        }
        catch {
          onPageSetupError(messages.pages.setupOperationFailed)
        }
      },
    },
  ]
}

/** 判断资源条目是否为页面。 @internal */
export function isPageEntry(entry: { readonly mediaType?: string }) {
  return isComposePageMediaType(entry.mediaType)
}
