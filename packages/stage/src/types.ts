import type { HTMLAttributes } from 'react'
import type { ComponentRegistry } from '@compose-ui/component-registry'
import type { ComposeLocale } from '@compose-ui/ui-context'
import type {
  CommandDispatchResult,
  ComposeDocument,
  EditorCommand,
} from '@compose-ui/core'
import type { StageViewport } from './geometry'
import type { StageDragController } from './drag-controller'

/**
 * Stage 的受控工具模式。
 *
 * @public
 */
export type StageTool = 'select' | 'pan'

/**
 * Stage 内建界面语言。
 *
 * @public
 */
export type StageLocale = ComposeLocale

/**
 * Stage 可配置的单次键位。
 *
 * @public
 */
export interface StageKeybinding {
  /** `KeyboardEvent.code` 物理键位。 */
  readonly code: string
  /** macOS 使用 Command，其他平台使用 Control。 */
  readonly primary?: boolean
  /** 所有平台都明确使用 Control。 */
  readonly control?: boolean
  /** 是否要求 Shift。 */
  readonly shift?: boolean
  /** 是否要求 Alt/Option。 */
  readonly alt?: boolean
}

/**
 * Stage 可修改快捷键动作。
 *
 * @public
 */
export type StageShortcutAction =
  | 'stage.temporaryPan'
  | 'stage.selectTool'
  | 'stage.panTool'
  | 'stage.fitSelection'
  | 'stage.fitFrame'
  | 'stage.zoomReset'
  | 'stage.zoomIn'
  | 'stage.zoomOut'
  | 'stage.toggleGridSnap'
  | 'stage.toggleSmartSnap'
  | 'edit.duplicate'
  | 'edit.group'
  | 'edit.ungroup'
  | 'edit.delete'

/**
 * Stage 动作到一个或多个单次键位的覆盖配置。
 *
 * @public
 */
export type StageShortcuts = Readonly<
  Partial<Record<StageShortcutAction, readonly StageKeybinding[]>>
>

/**
 * Stage 使用的同步命令派发边界。
 *
 * @public
 */
export type StageDispatch = (command: EditorCommand) => CommandDispatchResult

/**
 * 受控无限 Stage 属性。
 *
 * @public
 */
export interface StageProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  readonly document: ComposeDocument
  readonly registry: ComponentRegistry
  readonly dispatch: StageDispatch
  readonly viewport: StageViewport
  readonly onViewportChange: (viewport: StageViewport) => void
  readonly tool: StageTool
  /** 请求切换选择或平移工具；省略时对应快捷键不改变工具。 */
  readonly onToolChange?: (tool: StageTool) => void
  /** 内建 Stage chrome 语言。 @defaultValue `"zh-CN"` */
  readonly locale?: StageLocale
  /** 覆盖 Stage 默认动作键位；动作空数组表示禁用。 */
  readonly shortcuts?: StageShortcuts
  readonly selectedIds: readonly string[]
  readonly onSelectedIdsChange: (ids: readonly string[]) => void
  readonly activeFrameId: string | null
  readonly onActiveFrameIdChange: (frameId: string | null) => void
  /**
   * surface 可视尺寸变化回调。
   *
   * @remarks 标尺和滚动条不计入尺寸；可用于适配 Frame 或选择。
   */
  readonly onSurfaceSizeChange?: (
    size: { readonly width: number; readonly height: number },
  ) => void
  readonly dragController?: StageDragController
  /** 节点与命令 ID factory。默认使用 crypto.randomUUID 或时间回退。 */
  readonly idFactory?: () => string
}
