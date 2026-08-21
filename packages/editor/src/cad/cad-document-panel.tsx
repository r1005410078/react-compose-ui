import { useComposeI18nContext } from '@compose-ui/ui-context'
import type { IDockviewPanelProps } from 'dockview-react'
import { getEditorMessages } from '../editor-i18n'
import { useWorkspaceContent } from '../workspace-layout/workspace-context'
import { StageToolbarIcon } from '../stage-toolbar'

/**
 * 渲染中央 Canvas Group 中的 CAD 文档会话。
 *
 * @remarks
 * 本步不含任何绘图能力，画布区域只呈现空态说明。CAD 标签**不是 Stage 宿主**——Stage 的
 * surface 是独占的，且 CAD 有自己的编辑范式（命令行驱动、无限图纸）。
 * @internal
 */
export function CadDocumentPanel(props: IDockviewPanelProps) {
  const { documents, saveDocument } = useWorkspaceContent()
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage).cad
  const panelId = props.api?.id
  const candidate = panelId ? documents.get(panelId) : undefined
  const session = candidate?.kind === 'cad' ? candidate : undefined
  if (!panelId || !session) return null

  return (
    <div
      className="compose-editor__cad-document"
      data-cad-asset-key={session.assetKey}
      data-workspace-panel="cad-document"
    >
      <div className="compose-editor__canvas-toolbar">
        <span
          aria-label={`${messages.documentLabel} ${session.displayName}`}
          className="compose-editor__cad-kind-label"
        >
          {messages.documentLabel}
          {' · '}
          {session.displayName}
        </span>
        <button
          aria-label={`${messages.save} ${session.displayName}`}
          className="compose-editor__page-save"
          disabled={!session.dirty}
          type="button"
          onClick={() => { saveDocument(panelId) }}
        >
          <StageToolbarIcon name="save" />
        </button>
      </div>
      <div className="compose-editor__canvas-content">
        <p className="compose-editor__cad-empty" data-testid="cad-empty-hint">
          {messages.emptyHint}
        </p>
      </div>
    </div>
  )
}
