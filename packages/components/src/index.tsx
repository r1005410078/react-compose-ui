/* eslint-disable react-refresh/only-export-components -- 库公共入口必须同时导出 React 组件、纯格式化函数和 Tree 模型。 */
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
export {
  ComposeColorHistoryProvider,
  ComposeColorPicker,
  ComposePaintPicker,
  useComposeColorHistory,
} from './color-picker'
export type {
  ComposeColorHistoryProviderProps,
  ComposeColorPickerProps,
  ComposePaintPickerProps,
} from './color-picker'
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
