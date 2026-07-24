import type { HTMLAttributes } from 'react'
import type { ComponentRegistry } from '@compose-ui/component-registry'
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
  readonly selectedIds: readonly string[]
  readonly onSelectedIdsChange: (ids: readonly string[]) => void
  readonly activeFrameId: string | null
  readonly onActiveFrameIdChange: (frameId: string | null) => void
  readonly dragController?: StageDragController
  /** 节点与命令 ID factory。默认使用 crypto.randomUUID 或时间回退。 */
  readonly idFactory?: () => string
}
