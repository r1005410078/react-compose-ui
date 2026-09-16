import { useComposeI18nContext } from '@compose-ui/ui-context'
import { useWorkspaceContent } from './workspace-context'
import type { ComposeWorkspaceDocumentSession } from './workspace-context'
import { WORKSPACE_PANEL_IDS } from './workspace-layout'
import { getEditorMessages } from '../editor-i18n'
import type { getEditorMessages as GetEditorMessages } from '../editor-i18n'

type EditorMessages = ReturnType<typeof GetEditorMessages>

/** 面包屑上的一段。 */
interface TrailCrumb {
  readonly panelId: string
  readonly title: string
}

function crumbTitle(session: ComposeWorkspaceDocumentSession, messages: EditorMessages) {
  switch (session.kind) {
    case 'page':
    case 'component':
      return session.displayName
    case 'asset':
      return session.readOnly
        ? `${session.entry.name}${messages.pages.readOnlySuffix}`
        : session.entry.name
  }
}

/**
 * 画布列头：文档面包屑。
 *
 * @remarks
 * 文档标签条搬进应用顶栏之后，这一行**留了下来**——它回答的是另一个问题：标签回答「我开着
 * 哪几份」（应用作用域），面包屑回答**「我正在编哪一份、哪一层」**（画布那一列的作用域）。
 * 两个问题分两处答，而不是让一行同时说两件事。
 *
 * 它住在画布面板内容的**第一行**：三列在 Dockview 的网格里是同一行的兄弟，左右两组各自画 30px
 * 的组头，而画布组隐藏组头，因此这一行天然从组头那条线开始——与左右面板头逐像素齐平，不需要
 * 任何对齐代码。
 *
 * **这里没有「设计 / 动画」切换器**：那颗切换器已经删掉，它把布局（加时间线、展开底部）与语义
 * （采样、自动记录、锁父级）捆在一颗按钮上；拆开之后布局那一半归工作区，语义那一半是时间线
 * chrome 上的开关。在这里把它装回来就是把那次拆分原样撤销。
 *
 * 进了组件层时面包屑有多段，**除最后一段之外都可点**——点一段就回到那一层，走的是场景树根行
 * 返回的**同一条实现**（`exitEntryLayerTo`）。前几段点下去什么都不发生的面包屑是在撒谎。
 * @internal
 */
export function CanvasDocumentBreadcrumb() {
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)
  const {
    activeDocumentPanelId,
    documents,
    entryLayerPanelIds,
    entryOriginPanelId,
    exitEntryLayerTo,
    stageHostPanelId,
  } = useWorkspaceContent()

  /*
   * 来路是「栈底 + 各层」。没有来路时就只有当前这一份——两种情形因此是同一段代码的两个取值，
   * 而不是两支各自成立的分支。
   */
  const layers = entryLayerPanelIds ?? []
  const trailPanelIds = entryOriginPanelId === undefined || entryOriginPanelId === null
    ? (activeDocumentPanelId === null ? [] : [activeDocumentPanelId])
    : [entryOriginPanelId, ...layers]

  const crumbs: readonly TrailCrumb[] = trailPanelIds.flatMap((panelId) => {
    const session = documents.get(panelId)
    if (session) return [{ panelId, title: crumbTitle(session, messages) }]
    // 未启用页面系统时固定画布没有会话，它在这一行上仍然要有名字。
    return panelId === stageHostPanelId && panelId === WORKSPACE_PANEL_IDS.canvas
      ? [{ panelId, title: messages.workspace.canvas }]
      : []
  })

  return (
    <div className="compose-editor__canvas-head">
      <nav aria-label={messages.workspace.documentTrail} className="compose-editor__document-trail">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1
          return (
            <span className="compose-editor__trail-item" key={crumb.panelId}>
              {index === 0 ? null : (
                <span aria-hidden="true" className="compose-editor__trail-sep">/</span>
              )}
              {last || exitEntryLayerTo === undefined ? (
                <span
                  aria-current={last ? 'page' : undefined}
                  className="compose-editor__trail-crumb"
                  data-current={last ? 'true' : undefined}
                >
                  {crumb.title}
                </span>
              ) : (
                <button
                  className="compose-editor__trail-crumb"
                  onClick={() => exitEntryLayerTo(crumb.panelId)}
                  type="button"
                >
                  {crumb.title}
                </button>
              )}
            </span>
          )
        })}
      </nav>
    </div>
  )
}
