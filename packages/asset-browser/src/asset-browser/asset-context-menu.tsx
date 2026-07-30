import {
  ComposeContextMenu,
  ComposeContextMenuContent,
  ComposeContextMenuItem,
  ComposeContextMenuShortcut,
  type ComposeContextMenuController,
} from '@compose-ui/components'
import type { AssetBrowserMessages } from '../asset-browser-i18n'

/** 内建菜单项的能力门禁。 @internal */
export interface AssetContextMenuCapabilities {
  readonly canCreateFile: boolean
  readonly canCreateFolder: boolean
  readonly canRename: boolean
  readonly canDelete: boolean
}

/**
 * 渲染资源浏览器的上下文菜单。
 *
 * @remarks
 * 只负责菜单内容；命中条目与选择归一化由调用方在打开菜单前完成，因此本组件不接触资源数据。
 * @internal
 */
export function AssetContextMenu({
  capabilities,
  contextMenu,
  messages,
  onCreateFile,
  onCreateFolder,
  onDelete,
  onRename,
}: {
  readonly capabilities: AssetContextMenuCapabilities
  readonly contextMenu: ComposeContextMenuController<string>
  readonly messages: AssetBrowserMessages
  readonly onCreateFile: () => void
  readonly onCreateFolder: () => void
  readonly onDelete: () => void
  readonly onRename: () => void
}) {
  return (
    <ComposeContextMenu {...contextMenu.rootProps}>
      <ComposeContextMenuContent aria-label={messages.assets}>
        <ComposeContextMenuItem
          disabled={!capabilities.canCreateFile}
          onClick={onCreateFile}
        >{messages.newFile}</ComposeContextMenuItem>
        <ComposeContextMenuItem
          disabled={!capabilities.canCreateFolder}
          onClick={onCreateFolder}
        >{messages.newFolder}</ComposeContextMenuItem>
        <ComposeContextMenuItem
          disabled={!capabilities.canRename}
          onClick={onRename}
        >{messages.rename}<ComposeContextMenuShortcut>F2</ComposeContextMenuShortcut></ComposeContextMenuItem>
        <ComposeContextMenuItem
          disabled={!capabilities.canDelete}
          variant="destructive"
          onClick={onDelete}
        >{messages.delete}<ComposeContextMenuShortcut>Delete</ComposeContextMenuShortcut></ComposeContextMenuItem>
      </ComposeContextMenuContent>
    </ComposeContextMenu>
  )
}
