import {
  type ComposeContextMenuController,
  ComposeContextMenu,
  ComposeContextMenuContent,
  ComposeContextMenuItem,
  ComposeContextMenuSeparator,
  ComposeContextMenuShortcut,
} from '@compose-ui/components'
import { Fragment } from 'react'
import type { AssetBrowserMessages } from '../asset-browser-i18n'
import type {
  ComposeAssetContextMenuContext,
  ComposeAssetContextMenuItem,
} from '../asset-browser-types'

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
 * 宿主菜单项始终排在内建项之后，其可见性与禁用状态在每次渲染时按当前上下文求值。
 * @internal
 */
export function AssetContextMenu({
  capabilities,
  contextMenu,
  hostContext,
  hostItems,
  messages,
  onCreateFile,
  onCreateFolder,
  onDelete,
  onRename,
}: {
  readonly capabilities: AssetContextMenuCapabilities
  readonly contextMenu: ComposeContextMenuController<string>
  /** 宿主项求值使用的上下文；无宿主项时可为 undefined。 */
  readonly hostContext?: ComposeAssetContextMenuContext
  readonly hostItems?: readonly ComposeAssetContextMenuItem[]
  readonly messages: AssetBrowserMessages
  readonly onCreateFile: () => void
  readonly onCreateFolder: () => void
  readonly onDelete: () => void
  readonly onRename: () => void
}) {
  const visibleHostItems = hostContext && hostItems
    ? hostItems.filter((item) => item.isVisible?.(hostContext) !== false)
    : []
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
        {hostContext ? visibleHostItems.map((item) => (
          <Fragment key={item.id}>
            {item.separatorBefore === true ? <ComposeContextMenuSeparator /> : null}
            <ComposeContextMenuItem
              disabled={item.isDisabled?.(hostContext) === true}
              variant={item.variant}
              onClick={() => { void item.onSelect(hostContext) }}
            >
              {item.label}
              {item.shortcut === undefined
                ? null
                : <ComposeContextMenuShortcut>{item.shortcut}</ComposeContextMenuShortcut>}
            </ComposeContextMenuItem>
          </Fragment>
        )) : null}
      </ComposeContextMenuContent>
    </ComposeContextMenu>
  )
}
