import type { HTMLAttributes, ReactNode } from 'react'
import './styles.css'
export { SceneTree } from './scene-tree'
// Public package barrels intentionally export components and hooks together.
// eslint-disable-next-line react-refresh/only-export-components
export { useSceneTreeCommands } from './use-scene-tree-commands'

export interface SceneTreeNode {
  id: string
  label: string
  icon?: ReactNode
  children?: readonly SceneTreeNode[]
  visible?: boolean
  locked?: boolean
  canHaveChildren?: boolean
  canRename?: boolean
  canDelete?: boolean
  canMove?: boolean
  canToggleVisibility?: boolean
  canToggleLocked?: boolean
}

export type SceneTreeOperation =
  | { type: 'create'; parentId: string | null; index: number }
  | { type: 'rename'; nodeId: string; label: string }
  | { type: 'delete'; nodeIds: readonly string[] }
  | {
      type: 'move'
      nodeIds: readonly string[]
      parentId: string | null
      index: number
    }
  | {
      type: 'duplicate'
      sourceNodeIds: readonly string[]
      parentId: string | null
      index: number
    }
  | {
      type: 'set-visibility'
      nodeIds: readonly string[]
      visible: boolean
    }
  | { type: 'set-locked'; nodeIds: readonly string[]; locked: boolean }

export interface SceneTreeProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  nodes: readonly SceneTreeNode[]
  selectedIds: readonly string[]
  expandedIds: readonly string[]
  onSelectionChange?: (nodeIds: readonly string[]) => void
  onExpandedChange?: (nodeIds: readonly string[]) => void
  onOperation?: (operation: SceneTreeOperation) => void
  commands?: SceneTreeCommandController
}

export type SceneTreeCommand =
  | 'create-child'
  | 'create-sibling'
  | 'create-root'
  | 'create-suggested'
  | 'copy'
  | 'cut'
  | 'paste-child'
  | 'paste-sibling'
  | 'paste-root'
  | 'paste-suggested'
  | 'delete'

export interface SceneTreeClipboard {
  readonly kind: 'copy' | 'cut'
  readonly nodeIds: readonly string[]
}

export interface UseSceneTreeCommandsOptions {
  nodes: readonly SceneTreeNode[]
  selectedIds: readonly string[]
  onOperation?: (operation: SceneTreeOperation) => void
}

export interface SceneTreeCommandController {
  readonly clipboard: SceneTreeClipboard | null
  isEnabled(command: SceneTreeCommand, targetId?: string | null): boolean
  execute(command: SceneTreeCommand, targetId?: string | null): void
  clearClipboard(): void
}
