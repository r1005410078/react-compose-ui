import type { ComposeDocument } from '@compose-ui/core'
import type {
  StageProps,
  StageTool,
  StageViewport,
} from '@compose-ui/stage'
import type {
  Dispatch,
  SetStateAction,
} from 'react'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { CanvasSettingsPopover } from './canvas-settings-popover'
import { getEditorMessages } from './editor-i18n'
import { StageToolbarIcon } from './stage-toolbar-icons'

export function DefaultEmptyInspector() {
  const i18n = useComposeI18nContext()
  return (
    <div className="compose-editor__empty-inspector" role="status">
      {getEditorMessages(
        i18n?.locale ?? 'zh-CN',
        i18n?.formatMessage,
      ).workspace.selectNode}
    </div>
  )
}

type DefaultStageToolbarProps = {
  readonly activeFrameId: string | null
  readonly canvasSettingsOpen: boolean
  readonly configureCanvas: (
    gridSnapEnabled: boolean,
    smartEnabled: boolean,
    label: string,
  ) => void
  readonly createFrame: () => void
  readonly dispatch: NonNullable<StageProps['dispatch']>
  readonly document: ComposeDocument
  readonly fitFrame: () => void
  readonly fitSelection: () => void
  readonly nextId: () => string
  readonly selectedIds: readonly string[]
  readonly setCanvasSettingsOpen: Dispatch<SetStateAction<boolean>>
  readonly setTool: (tool: StageTool) => void
  readonly setViewport: Dispatch<SetStateAction<StageViewport>>
  readonly smartSnapEnabled: boolean
  readonly surfaceSize: { readonly width: number; readonly height: number } | null
  readonly tool: StageTool
  readonly viewport: StageViewport
}

export function DefaultStageToolbar({
  activeFrameId,
  canvasSettingsOpen,
  configureCanvas,
  createFrame,
  dispatch,
  document,
  fitFrame,
  fitSelection,
  nextId,
  selectedIds,
  setCanvasSettingsOpen,
  setTool,
  setViewport,
  smartSnapEnabled,
  surfaceSize,
  tool,
  viewport,
}: DefaultStageToolbarProps) {
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(
    i18n?.locale ?? 'zh-CN',
    i18n?.formatMessage,
  ).stageToolbar
  const titled = (label: string) => ({ 'aria-label': label, title: label })

  return (
    <div aria-label={messages.label} className="compose-editor__stage-toolbar" role="toolbar">
      <div
        aria-label={messages.interactionTools}
        className="compose-editor__toolbar-group"
        role="group"
      >
        <button
          {...titled(messages.select)}
          aria-pressed={tool === 'select'}
          type="button"
          onClick={() => setTool('select')}
        >
          <StageToolbarIcon name="select" />
        </button>
        <button
          {...titled(messages.pan)}
          aria-pressed={tool === 'pan'}
          type="button"
          onClick={() => setTool('pan')}
        >
          <StageToolbarIcon name="pan" />
        </button>
      </div>
      <span aria-hidden="true" className="compose-editor__toolbar-divider" />
      <div aria-label={messages.frameTools} className="compose-editor__toolbar-group" role="group">
        <button {...titled(messages.createFrame)} type="button" onClick={createFrame}>
          <StageToolbarIcon name="create-frame" />
        </button>
        <button
          {...titled(messages.fitFrame)}
          disabled={!surfaceSize || !activeFrameId}
          type="button"
          onClick={fitFrame}
        >
          <StageToolbarIcon name="fit-frame" />
        </button>
        <button
          {...titled(messages.fitSelection)}
          disabled={!surfaceSize || selectedIds.length === 0}
          type="button"
          onClick={fitSelection}
        >
          <StageToolbarIcon name="fit-selection" />
        </button>
      </div>
      <span aria-hidden="true" className="compose-editor__toolbar-divider" />
      <div
        aria-label={messages.snapTools}
        className="compose-editor__toolbar-group compose-editor__canvas-tools"
        role="group"
      >
        <button
          {...titled(messages.gridSnap)}
          aria-pressed={document.canvas.grid.snapEnabled}
          type="button"
          onClick={() => configureCanvas(
            !document.canvas.grid.snapEnabled,
            smartSnapEnabled,
            messages.toggleSnapTransaction,
          )}
        >
          <StageToolbarIcon name="grid-snap" />
        </button>
        <button
          {...titled(messages.smartSnap)}
          aria-pressed={smartSnapEnabled}
          type="button"
          onClick={() => configureCanvas(
            document.canvas.grid.snapEnabled,
            !smartSnapEnabled,
            messages.toggleSnapTransaction,
          )}
        >
          <StageToolbarIcon name="smart-snap" />
        </button>
        <button
          {...titled(messages.canvasSettings)}
          aria-expanded={canvasSettingsOpen}
          aria-haspopup="dialog"
          type="button"
          onClick={() => setCanvasSettingsOpen((current) => !current)}
        >
          <StageToolbarIcon name="settings" />
        </button>
        {canvasSettingsOpen ? (
          <CanvasSettingsPopover
            dispatch={dispatch}
            document={document}
            idFactory={nextId}
            onClose={() => setCanvasSettingsOpen(false)}
          />
        ) : null}
      </div>
      <span aria-hidden="true" className="compose-editor__toolbar-divider" />
      <div aria-label={messages.zoomTools} className="compose-editor__toolbar-group" role="group">
        <button
          {...titled(messages.zoomOut)}
          type="button"
          onClick={() => setViewport((current) => ({
            ...current,
            zoom: Math.max(0.1, current.zoom / 1.2),
          }))}
        >
          <StageToolbarIcon name="zoom-out" />
        </button>
        <span aria-label={messages.zoomLevel} className="compose-editor__zoom-value">
          {Math.round(viewport.zoom * 100)}%
        </span>
        <button
          {...titled(messages.zoomIn)}
          type="button"
          onClick={() => setViewport((current) => ({
            ...current,
            zoom: Math.min(8, current.zoom * 1.2),
          }))}
        >
          <StageToolbarIcon name="zoom-in" />
        </button>
      </div>
    </div>
  )
}
