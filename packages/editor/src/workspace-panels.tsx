import { useWorkspaceContent } from './workspace-context'

function Placeholder({ children }: { children: string }) {
  return (
    <div className="compose-editor__placeholder" role="status">
      {children}
    </div>
  )
}

export function SceneGraphPanel() {
  const { sceneGraphPanel } = useWorkspaceContent()

  return (
    <div className="compose-editor__panel" data-workspace-panel="scene-graph">
      {sceneGraphPanel ?? <Placeholder>Scene Graph content</Placeholder>}
    </div>
  )
}

export function CanvasPanel() {
  const { canvasToolbar, children } = useWorkspaceContent()

  return (
    <div
      className="compose-editor__canvas-panel"
      data-workspace-panel="canvas"
    >
      <div className="compose-editor__canvas-toolbar">
        {canvasToolbar ?? <Placeholder>Canvas toolbar</Placeholder>}
      </div>
      <div className="compose-editor__canvas-content">{children}</div>
    </div>
  )
}

export function InspectorPanel() {
  const { inspectorPanel } = useWorkspaceContent()

  return (
    <div className="compose-editor__panel" data-workspace-panel="inspector">
      {inspectorPanel ?? <Placeholder>Component inspector content</Placeholder>}
    </div>
  )
}

export function TransactionLogPanel() {
  const { transactionLogPanel } = useWorkspaceContent()

  return (
    <div
      className="compose-editor__panel"
      data-workspace-panel="transaction-log"
    >
      {transactionLogPanel ?? <Placeholder>Transaction log content</Placeholder>}
    </div>
  )
}

export function CommandPanel() {
  const { commandPanel } = useWorkspaceContent()

  return (
    <div className="compose-editor__panel" data-workspace-panel="command">
      {commandPanel ?? <Placeholder>Command content</Placeholder>}
    </div>
  )
}
