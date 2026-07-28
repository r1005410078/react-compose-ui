/**
 * 提供可被场景树、资源浏览器和宿主工具复用的受控 React 基础组件。
 *
 * @remarks
 * 本包只负责通用 UI 交互和可访问性，不拥有 ComposeDocument、资源 Provider、历史或领域命令。
 *
 * @packageDocumentation
 */
import './styles.css'

export { ComposeButton } from './button'
export type { ComposeButtonProps } from './button'
export { ComposeColorPicker } from './color-picker'
export type { ComposeColorPickerProps } from './color-picker'
export { ComposeConfirmDialog } from './confirm-dialog'
export type { ComposeConfirmDialogProps } from './confirm-dialog'
export { ComposeInput } from './input'
export type { ComposeInputProps } from './input'
export {
  ComposeDialog,
  ComposeDialogBackdrop,
  ComposeDialogClose,
  ComposeDialogContent,
  ComposeDialogDescription,
  ComposeDialogFooter,
  ComposeDialogHeader,
  ComposeDialogPortal,
  ComposeDialogTitle,
  ComposeDialogTrigger,
  ComposeDialogViewport,
} from './dialog'
export type {
  ComposeDialogBackdropProps,
  ComposeDialogCloseProps,
  ComposeDialogContentProps,
  ComposeDialogDescriptionProps,
  ComposeDialogFooterProps,
  ComposeDialogHeaderProps,
  ComposeDialogOpenChange,
  ComposeDialogPortalProps,
  ComposeDialogProps,
  ComposeDialogTitleProps,
  ComposeDialogTriggerProps,
  ComposeDialogViewportProps,
} from './dialog'
export {
  ComposeContextMenu,
  ComposeContextMenuCheckboxItem,
  ComposeContextMenuContent,
  ComposeContextMenuGroup,
  ComposeContextMenuItem,
  ComposeContextMenuLabel,
  ComposeContextMenuRadioGroup,
  ComposeContextMenuRadioItem,
  ComposeContextMenuSeparator,
  ComposeContextMenuShortcut,
  ComposeContextMenuSub,
  ComposeContextMenuSubContent,
  ComposeContextMenuSubTrigger,
  ComposeContextMenuTrigger,
  formatComposeKeybinding,
  formatComposeKeybindings,
  useComposeContextMenu,
} from './context-menu'
export type {
  ComposeContextMenuCheckboxItemProps,
  ComposeContextMenuContentProps,
  ComposeContextMenuController,
  ComposeContextMenuGroupProps,
  ComposeContextMenuItemProps,
  ComposeContextMenuItemVariant,
  ComposeContextMenuLabelProps,
  ComposeContextMenuOpenEvent,
  ComposeContextMenuPoint,
  ComposeContextMenuProps,
  ComposeContextMenuRadioGroupProps,
  ComposeContextMenuRadioItemProps,
  ComposeContextMenuRootProps,
  ComposeContextMenuSeparatorProps,
  ComposeContextMenuShortcutProps,
  ComposeContextMenuSubProps,
  ComposeContextMenuSubContentProps,
  ComposeContextMenuSubTriggerProps,
  ComposeContextMenuTriggerProps,
  ComposeKeybinding,
} from './context-menu'
export { ComposeTree } from './tree'
// 公共入口同时导出组件与纯 Tree 模型工具，因此只针对工具导出豁免 Fast Refresh。
// eslint-disable-next-line react-refresh/only-export-components
export {
  createComposeTreeIndex,
  createComposeTreeMove,
  flattenComposeTree,
  type ComposeIndexedTreeItem,
} from './tree'
export type {
  ComposeTreeItemAdapter,
  ComposeTreeItemRenderContext,
  ComposeTreeMoveOperation,
  ComposeTreeProps,
} from './tree'
