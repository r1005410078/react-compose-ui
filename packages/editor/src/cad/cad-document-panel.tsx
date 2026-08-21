import { useCallback, useSyncExternalStore } from 'react'
import { ComposeCadCanvas } from '@compose-ui/cad-canvas'
import type { EditorCommand } from '@compose-ui/core'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import type { IDockviewPanelProps } from 'dockview-react'
import { getEditorMessages } from '../editor-i18n'
import { useWorkspaceContent } from '../workspace-layout/workspace-context'
import { StageToolbarIcon } from '../stage-toolbar'

/**
 * 渲染中央 Canvas Group 中的 CAD 文档会话。
 *
 * @remarks
 * CAD 标签**不是 Stage 宿主**——Stage 的 surface 是独占的，且 CAD 有自己的编辑范式
 * （命令行驱动、无限图纸）。画布只接收文档与派发入口，撤销历史住在该标签自己的事务运行时上。
 * @internal
 */
export function CadDocumentPanel(props: IDockviewPanelProps) {
  const { documents, saveDocument } = useWorkspaceContent()
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage).cad
  const panelId = props.api?.id
  const candidate = panelId ? documents.get(panelId) : undefined
  const session = candidate?.kind === 'cad' ? candidate : undefined
  const runtime = session?.runtime
  const dispatch = useCallback((command: EditorCommand) => { runtime?.dispatch(command) }, [runtime])
  // 订阅事务运行时而不是依赖会话对象换身份：会话只在 dirty 翻转时被替换，第一次修改之后
  // 后续 dispatch 不再产生新会话，画布会停在第一次修改的状态。
  const document = useSyncExternalStore(
    useCallback((listener: () => void) => runtime?.subscribe(listener) ?? (() => {}), [runtime]),
    () => runtime?.document,
  )
  if (!panelId || !session || !document) return null

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
        <ComposeCadCanvas document={document} onDispatch={dispatch} />
      </div>
    </div>
  )
}
