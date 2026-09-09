import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { useEffect, useReducer } from 'react'
import type { PointerEventHandler } from 'react'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { WORKSPACE_PANEL_IDS } from './workspace-layout'
import { getEditorMessages } from '../editor-i18n'

type WorkspaceTabProps = IDockviewPanelHeaderProps & {
  onPointerDown?: PointerEventHandler<HTMLDivElement>
  onPointerLeave?: PointerEventHandler<HTMLDivElement>
  onPointerUp?: PointerEventHandler<HTMLDivElement>
}

/** Dockview 组里的文字标签；文档不再是 Dockview 面板，它们的标签在 `WorkspaceDocumentTabs`。 */
export function WorkspaceTab(props: WorkspaceTabProps) {
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(
    i18n?.locale ?? 'zh-CN',
    i18n?.formatMessage,
  ).workspace
  const titles: Record<string, string> = {
    [WORKSPACE_PANEL_IDS.scene]: messages.sceneGraph,
    [WORKSPACE_PANEL_IDS.componentLibrary]: messages.componentLibrary,
    [WORKSPACE_PANEL_IDS.history]: messages.history,
    [WORKSPACE_PANEL_IDS.canvas]: messages.canvas,
    [WORKSPACE_PANEL_IDS.inspector]: messages.inspector,
    [WORKSPACE_PANEL_IDS.transactionLog]: messages.transactionLog,
    [WORKSPACE_PANEL_IDS.command]: messages.command,
    [WORKSPACE_PANEL_IDS.assetBrowser]: messages.assets,
    [WORKSPACE_PANEL_IDS.animation]: messages.animation,
  }
  // 物料面板的标签名由**工作区**给（页面「基础组件」/ 绘图「符号库」），属性面板的由**选区**
  // 给（`属性 · 矩形`），因此这两个读面板自己的标题而不是这张按 id 查的表；其余面板的名字只
  // 随语言变。标题是从外面 `setTitle` 改的，
  // React 不会因此重渲染：订阅到变化就催一帧，标题本身仍在渲染期从 api 上现读——把它复制进
  // state 会多出一份可能过期的事实。
  const [, repaint] = useReducer((count: number) => count + 1, 0)
  useEffect(() => {
    const subscription = props.api.onDidTitleChange?.(() => { repaint() })
    return () => { subscription?.dispose() }
  }, [props.api])
  const dynamicTitle = props.api.id === WORKSPACE_PANEL_IDS.componentLibrary
    || props.api.id === WORKSPACE_PANEL_IDS.inspector
  const title = dynamicTitle
    ? props.api.title ?? titles[props.api.id]
    : titles[props.api.id] ?? props.api.title

  return (
    <div
      className="compose-editor__text-tab"
      data-workspace-tab={props.api.id}
      onPointerDown={props.onPointerDown}
      onPointerLeave={props.onPointerLeave}
      onPointerUp={props.onPointerUp}
      title={title}
    >
      {title}
    </div>
  )
}
