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
  InspectorPanel,
  SceneGraphPanel,
  TransactionLogPanel,
} from './workspace-panels'
import { initializeWorkspace, WORKSPACE_COMPONENT_IDS } from './workspace-layout'
import { WorkspaceHeaderActions, WorkspaceTab } from './workspace-tab'
import './styles.css'

export interface ComposeEditorProps extends HTMLAttributes<HTMLElement> {
  /** 驱动默认场景树的受控节点、选择、展开和操作意图。 */
  sceneTreeProps?: SceneTreeProps
  /** 完整覆盖默认场景树的 React 内容。 */
  sceneGraphPanel?: ReactNode
  /** 驱动默认历史面板和编辑器范围撤销重做快捷键的受控控制器。 */
  history?: HistoryNavigationController
  /** 完整覆盖下方默认历史面板；显式 `null` 仍会启用分栏。 */
  historyPanel?: ReactNode
  /** 显示在 Canvas 内容顶部的宿主工具栏。 */
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
  children = 'Compose Editor',
  sceneTreeProps,
  sceneGraphPanel,
  history,
  historyPanel,
  canvasToolbar,
  inspectorPanel,
  transactionLogPanel,
  commandPanel,
  className,
  onKeyDownCapture,
  ...props
}: ComposeEditorProps) {
  const initializedApi = useRef<DockviewReadyEvent['api'] | null>(null)
  const content = useMemo(
    () => ({
      sceneGraphPanel: sceneGraphPanel !== undefined
        ? sceneGraphPanel
        : <SceneTree {...(sceneTreeProps ?? emptySceneTreeProps)} />,
      history,
      historyPanel,
      canvasToolbar,
      children,
      inspectorPanel,
      transactionLogPanel,
      commandPanel,
    }),
    [
      sceneGraphPanel,
      sceneTreeProps,
      history,
      historyPanel,
      canvasToolbar,
      children,
      inspectorPanel,
      transactionLogPanel,
      commandPanel,
    ],
  )
  const handleHistoryShortcut = useHistoryShortcuts(history ?? disabledHistory)
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
        if (history && !event.defaultPrevented) handleHistoryShortcut(event)
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
