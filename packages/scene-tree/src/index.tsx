/**
 * 提供受控、虚拟化的 React 场景树，以及可由树和外部工具栏共享的命令控制器。
 *
 * @remarks
 * 本包只描述节点显示状态和操作意图，不拥有文档 Schema、撤销历史或持久化状态。
 *
 * @packageDocumentation
 */
import type { HTMLAttributes, ReactNode } from 'react'
import './styles.css'
export { SceneTree } from './scene-tree'
// 公共入口需要同时导出组件和 Hook，因此只针对这一行豁免 Fast Refresh 的组件导出限制。
// eslint-disable-next-line react-refresh/only-export-components
export { useSceneTreeCommands } from './use-scene-tree-commands'

/**
 * 场景树渲染和交互所需的最小节点描述。
 *
 * @public
 */
export interface SceneTreeNode {
  /** 在当前树实例及其操作意图中稳定且唯一的节点标识。 */
  id: string
  /** 显示名称，同时用于检索和单节点拖拽预览。 */
  label: string
  /** 覆盖默认文档或组件图标的自定义内容。 */
  icon?: ReactNode
  /** 子节点；空数组表示能够包含子节点但当前为空。 */
  children?: readonly SceneTreeNode[]
  /** 当前可见状态。省略时视为可见。 */
  visible?: boolean
  /** 当前锁定状态；锁定节点不能执行结构修改。 */
  locked?: boolean
  /** 是否允许成为父节点。省略时允许。 */
  canHaveChildren?: boolean
  /** 是否允许重命名。省略时允许。 */
  canRename?: boolean
  /** 是否允许删除。省略时允许。 */
  canDelete?: boolean
  /** 是否允许移动或剪切。省略时允许。 */
  canMove?: boolean
  /** 是否允许切换可见状态。省略时允许。 */
  canToggleVisibility?: boolean
  /** 是否允许切换锁定状态。省略时允许。 */
  canToggleLocked?: boolean
}

/**
 * `SceneTree` 发给宿主的受控操作意图。
 *
 * @remarks
 * 组件不会直接修改 `nodes`。宿主必须应用操作并将新树重新传入。`duplicate` 只描述复制
 * 位置，深拷贝业务数据和生成新 ID 仍由宿主负责。
 *
 * @public
 */
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

/**
 * 受控场景树组件的属性。
 *
 * @public
 */
export interface SceneTreeProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** 完整的树数据。 */
  nodes: readonly SceneTreeNode[]
  /** 当前选中节点 ID，顺序用于确定最近选中的命令目标。 */
  selectedIds: readonly string[]
  /** 当前展开节点 ID。 */
  expandedIds: readonly string[]
  /** 请求宿主替换选中状态。 */
  onSelectionChange?: (nodeIds: readonly string[]) => void
  /** 请求宿主替换展开状态。 */
  onExpandedChange?: (nodeIds: readonly string[]) => void
  /** 节点结构或属性操作意图。 */
  onOperation?: (operation: SceneTreeOperation) => void
  /**
   * 外部创建的共享命令控制器。
   *
   * @remarks
   * 省略时组件会创建仅供自身菜单和快捷键使用的控制器。
   */
  commands?: SceneTreeCommandController
}

/**
 * 场景树菜单和快捷键支持的命令名称。
 *
 * @public
 */
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

/**
 * Hook 实例内、不会写入系统剪贴板的场景树剪贴板。
 *
 * @public
 */
export interface SceneTreeClipboard {
  /** 复制可以重复粘贴；剪切在成功移动后自动清空。 */
  readonly kind: 'copy' | 'cut'
  /** 已按树顺序规范化，并去除重复后代的顶层源节点。 */
  readonly nodeIds: readonly string[]
}

/**
 * `useSceneTreeCommands` 的受控输入。
 *
 * @public
 */
export interface UseSceneTreeCommandsOptions {
  /** 用于解析父子关系、能力限制和插入位置的完整树。 */
  nodes: readonly SceneTreeNode[]
  /** 未显式传入命令目标时使用的当前选择。 */
  selectedIds: readonly string[]
  /** 命令执行后发出的操作意图。 */
  onOperation?: (operation: SceneTreeOperation) => void
}

/**
 * 可由 `SceneTree` 和外部工具栏共享的命令控制器。
 *
 * @public
 */
export interface SceneTreeCommandController {
  /** 当前 Hook 实例持有的内存剪贴板。 */
  readonly clipboard: SceneTreeClipboard | null
  /**
   * 判断命令在指定目标上是否可执行。
   *
   * @param command - 要检查的命令。
   * @param targetId - 省略时使用最近选择；`null` 明确表示树根空白区。
   */
  isEnabled(command: SceneTreeCommand, targetId?: string | null): boolean
  /**
   * 执行命令并在需要时发出一个受控操作意图。
   *
   * @param command - 要执行的命令。
   * @param targetId - 省略时使用最近选择；`null` 明确表示树根空白区。
   */
  execute(command: SceneTreeCommand, targetId?: string | null): void
  /** 清空当前 Hook 实例的内存剪贴板。 */
  clearClipboard(): void
}
