import type { HTMLAttributes } from 'react'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type {
  CommandDispatchResult,
  ComposeDocument,
  EditorCommand,
} from '@compose-ui/core'
import type {
  StageInteractionController,
  StageViewport,
} from '@compose-ui/stage-engine'

/**
 * Stage 的受控工具模式。
 *
 * @public
 */
export type ComposeStageTool = 'select' | 'pan'

/**
 * Stage 可配置的单次键位。
 *
 * @public
 */
export interface ComposeStageKeybinding {
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
export type ComposeStageShortcutAction =
  | 'stage.temporaryPan'
  | 'stage.selectTool'
  | 'stage.panTool'
  | 'stage.fitSelection'
  | 'stage.fitContainer'
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
export type ComposeStageShortcuts = Readonly<
  Partial<Record<ComposeStageShortcutAction, readonly ComposeStageKeybinding[]>>
>

/**
 * Stage 使用的同步命令派发边界。
 *
 * @public
 */
export type ComposeStageDispatch = (command: EditorCommand) => CommandDispatchResult

/**
 * 受控无限 Stage 属性。
 *
 * @public
 */
export interface ComposeStageProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  readonly document: ComposeDocument
  readonly registry: ComposeEntityRegistry
  /** 资源型组件解析节点内稳定引用时使用的运行时端口。 */
  readonly assetResolver?: ComposeAssetResolver
  readonly dispatch: ComposeStageDispatch
  readonly viewport: StageViewport
  readonly onViewportChange: (viewport: StageViewport) => void
  readonly tool: ComposeStageTool
  /** 请求切换选择或平移工具；省略时对应快捷键不改变工具。 */
  readonly onToolChange?: (tool: ComposeStageTool) => void
  /** 覆盖 Stage 默认动作键位；动作空数组表示禁用。 */
  readonly shortcuts?: ComposeStageShortcuts
  readonly selectedIds: readonly string[]
  readonly onSelectedIdsChange: (ids: readonly string[]) => void
  /** 隐式 Canvas 输出区域当前是否为 Inspector 目标。 */
  readonly outputSelected?: boolean
  /** 请求清空节点选择并检查隐式 Canvas 输出属性。 */
  readonly onOutputSelect?: () => void
  /**
   * surface 可视尺寸变化回调。
   *
   * @remarks 标尺和滚动条不计入尺寸；可用于适配 Container 或选择。
   */
  readonly onSurfaceSizeChange?: (
    size: { readonly width: number; readonly height: number },
  ) => void
  /** 共享的 headless 交互 controller；省略时 Stage 创建私有实例。 */
  readonly interactionController?: StageInteractionController
  /** Entity 与命令 ID factory。默认使用 crypto.randomUUID 或时间回退。 */
  readonly idFactory?: () => string
}
