/**
 * 提供可嵌入 React 宿主的 Compose UI 编辑器工作区。
 *
 * @packageDocumentation
 */
import { COMPOSE_UI_CORE_PACKAGE } from '@compose-ui/core'
import { useHistoryShortcuts } from '@compose-ui/history'
import { SceneTree } from '@compose-ui/scene-tree'
import { DockviewReact, themeAbyss } from 'dockview-react'
import { useCallback, useMemo, useRef } from 'react'
import type {
  DockviewReadyEvent,
  IDockviewPanelProps,
} from 'dockview-react'
import type { HTMLAttributes, ReactNode } from 'react'
import type { HistoryNavigationController } from '@compose-ui/history'
import type { SceneTreeProps } from '@compose-ui/scene-tree'
import { WorkspaceContentContext } from './workspace-context'
import {
  CanvasPanel,
  CommandPanel,
  ComponentLibraryPanel,
  InspectorPanel,
  SceneGraphPanel,
  TransactionLogPanel,
} from './workspace-panels'
import { initializeWorkspace, WORKSPACE_COMPONENT_IDS } from './workspace-layout'
import { WorkspaceHeaderActions, WorkspaceTab } from './workspace-tab'
import type { ComposeEditorController } from './controller'
import './styles.css'

// 公共入口需要同时导出组件和 Hook，因此只针对这一行豁免 Fast Refresh 的组件导出限制。
// eslint-disable-next-line react-refresh/only-export-components
export { useComposeEditorController, type ComposeEditorController, type ComposeEditorTransactionEvent, type UseComposeEditorControllerOptions } from './controller'

/**
 * 可嵌入工作区的受控内容与默认 controller。
 *
 * @public
 */
export interface ComposeEditorProps extends HTMLAttributes<HTMLElement> {
  /** 提供统一 runtime、registry、会话状态与默认面板组合。 */
  controller?: ComposeEditorController
  /** 驱动默认场景树的受控节点、选择、展开和操作意图。 */
  sceneTreeProps?: SceneTreeProps
  /** 完整覆盖默认场景树的 React 内容。 */
  sceneGraphPanel?: ReactNode
  /** 完整覆盖左侧默认 ComponentPalette。 */
  componentLibraryPanel?: ReactNode
  /** 驱动默认历史面板和编辑器范围撤销重做快捷键的受控控制器。 */
  history?: HistoryNavigationController
  /** 完整覆盖下方默认历史面板；显式 `null` 仍会启用分栏。 */
  historyPanel?: ReactNode
  /** 显示在 Stage 内容顶部的首选宿主工具栏。 */
  stageToolbar?: ReactNode
  /**
   * 显示在 Canvas 内容顶部的旧工具栏别名。
   *
   * @deprecated 使用 `stageToolbar`；二者同时提供时 `stageToolbar` 优先。
   */
  canvasToolbar?: ReactNode
  /** 显示在右侧 Component Inspector 区域的宿主内容。 */
  inspectorPanel?: ReactNode
  /** 显示在底部 Transaction Log 标签中的宿主内容。 */
  transactionLogPanel?: ReactNode
  /** 显示在底部 Command 标签中的宿主内容。 */
  commandPanel?: ReactNode
}

const workspaceComponents = {
  [WORKSPACE_COMPONENT_IDS.scene]: SceneGraphPanel,
  [WORKSPACE_COMPONENT_IDS.componentLibrary]: ComponentLibraryPanel,
  [WORKSPACE_COMPONENT_IDS.canvas]: CanvasPanel,
  [WORKSPACE_COMPONENT_IDS.inspector]: InspectorPanel,
  [WORKSPACE_COMPONENT_IDS.transactionLog]: TransactionLogPanel,
  [WORKSPACE_COMPONENT_IDS.command]: CommandPanel,
} satisfies Record<string, React.FunctionComponent<IDockviewPanelProps>>

const workspaceTabComponents = { workspaceTab: WorkspaceTab }
const emptySceneTreeProps: SceneTreeProps = {
  nodes: [],
  selectedIds: [],
  expandedIds: [],
}
const disabledHistory: HistoryNavigationController = {
  entries: [],
  activeEntryId: null,
  canUndo: false,
  canRedo: false,
  undo: () => undefined,
  redo: () => undefined,
  navigate: () => undefined,
}

/**
 * 渲染固定 Dockview 工作区及可选的场景树、历史、画布、属性和底部工具内容。
 *
 * @param props - 受控面板内容、可选历史控制器和标准 `section` 属性。
 * @returns Compose UI 编辑器工作区。
 * @public
 */
export function ComposeEditor({
  children,
  controller,
  sceneTreeProps,
  sceneGraphPanel,
  componentLibraryPanel,
  history,
  historyPanel,
  stageToolbar,
  canvasToolbar,
  inspectorPanel,
  transactionLogPanel,
  commandPanel,
  className,
  onKeyDownCapture,
  ...props
}: ComposeEditorProps) {
  const initializedApi = useRef<DockviewReadyEvent['api'] | null>(null)
  const resolvedHistory = history ?? controller?.history
  const content = useMemo(
    () => ({
      sceneGraphPanel: sceneGraphPanel !== undefined
        ? sceneGraphPanel
        : <SceneTree {...(sceneTreeProps ?? controller?.sceneTreeProps ?? emptySceneTreeProps)} />,
      componentLibraryPanel: componentLibraryPanel !== undefined
        ? componentLibraryPanel
        : controller?.componentLibraryPanel,
      history: resolvedHistory,
      historyPanel,
      stageToolbar: stageToolbar !== undefined
        ? stageToolbar
        : canvasToolbar !== undefined
          ? canvasToolbar
          : controller?.stageToolbar,
      children: children !== undefined
        ? children
        : controller?.stage ?? 'Compose Editor',
      inspectorPanel: inspectorPanel !== undefined
        ? inspectorPanel
        : controller?.inspectorPanel,
      transactionLogPanel,
      commandPanel: commandPanel !== undefined
        ? commandPanel
        : controller?.commandPanel,
    }),
    [
      sceneGraphPanel,
      sceneTreeProps,
      controller,
      componentLibraryPanel,
      resolvedHistory,
      historyPanel,
      stageToolbar,
      canvasToolbar,
      children,
      inspectorPanel,
      transactionLogPanel,
      commandPanel,
    ],
  )
  const handleHistoryShortcut = useHistoryShortcuts(resolvedHistory ?? disabledHistory)
  const handleReady = useCallback((event: DockviewReadyEvent) => {
    if (initializedApi.current === event.api) {
      return
    }

    initializeWorkspace(event.api)
    initializedApi.current = event.api
  }, [])

  const rootClassName = ['compose-editor', className].filter(Boolean).join(' ')

  return (
    <section
      {...props}
      aria-label={props['aria-label'] ?? 'Compose editor'}
      className={rootClassName}
      data-compose-core={COMPOSE_UI_CORE_PACKAGE}
      data-compose-ui="editor"
      onKeyDownCapture={(event) => {
        onKeyDownCapture?.(event)
        if (resolvedHistory && !event.defaultPrevented) handleHistoryShortcut(event)
      }}
    >
      <WorkspaceContentContext.Provider value={content}>
        <DockviewReact
          className="compose-editor__dockview"
          components={workspaceComponents}
          disableDnd
          disableFloatingGroups
          onReady={handleReady}
          rightHeaderActionsComponent={WorkspaceHeaderActions}
          tabComponents={workspaceTabComponents}
          theme={themeAbyss}
        />
      </WorkspaceContentContext.Provider>
    </section>
  )
}
