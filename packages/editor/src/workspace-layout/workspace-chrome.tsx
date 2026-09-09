import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { EditorBrandMenu } from './editor-brand-menu'
import { EditorModeSwitcher } from './editor-mode-switcher'
import { useWorkspaceContent } from './workspace-context'
import type { ComposeWorkspaceDocumentSession } from './workspace-context'
import type { ComposeWorkspaceSide } from './use-side-collapse'
import { WORKSPACE_PANEL_IDS } from './workspace-layout'
import { getEditorMessages } from '../editor-i18n'
import type { getEditorMessages as GetEditorMessages } from '../editor-i18n'

type EditorMessages = ReturnType<typeof GetEditorMessages>

/** 标签条上的一格：文档会话，或未启用页面系统时的固定画布（没有会话、不可关闭）。 */
interface DocumentTabEntry {
  readonly panelId: string
  readonly title: string
  readonly session?: ComposeWorkspaceDocumentSession
}

/** 一个文档在标签上叫什么。 */
function documentTitle(session: ComposeWorkspaceDocumentSession, messages: EditorMessages) {
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

function closeLabel(session: ComposeWorkspaceDocumentSession, title: string, messages: EditorMessages) {
  switch (session.kind) {
    case 'page':
      return messages.pages.closePage(title)
    case 'component':
      return `关闭 ${title}`
    case 'asset':
      return messages.closeAsset(title)
  }
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
    </svg>
  )
}

/**
 * 工作区切换器：应用顶栏上紧接标志的一组圆角 pill。
 *
 * @remarks
 * 它不是标签：标签是文档，它是控件（`radiogroup`，方向键按索引循环）。呈现上没有外框盒、
 * 没有竖线、没有下划线，活动的一格只是一块柔和的圆角底——与「设计 / 动画」同形是**对的**：
 * 两者做的是同一件事，从 N 个里挑一个、挑完立刻生效。
 *
 * 每一格不带图标：顶栏最左已经有一个实心标志，再排一列小图标会把那颗把手淹掉。格上的点表示
 * 这份布局与基线不同（面板挪过位）；hover / focus 的提示说这个工作区会换的东西，用户不按下去
 * 也知道会发生什么——那是「切错了没有代价」的前提。
 * @internal
 */
export function WorkspaceSwitcher() {
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)
  const { workspace } = useWorkspaceContent()
  const groupRef = useRef<HTMLDivElement>(null)
  const { items, currentId } = workspace

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % items.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    if (next === null) return
    event.preventDefault()
    const target = items[next]!
    workspace.switchTo(target.id)
    groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus()
  }

  /*
   * 管理菜单是**活动段上的一个 `▾`**，不是旁边一颗独立按钮：它管的永远是当前那个工作区。
   * DOM 上它仍在 radiogroup **之外**——`radiogroup` 的子元素只能是 radio，塞一颗菜单按钮进去
   * 会让这个模式不再成立。视觉上的「贴在活动段右边」由 `order` 完成：radiogroup 是
   * `display: contents`，因此 radio 与 `▾` 是同一个 flex 行的兄弟，`▾` 的 order 排在活动段
   * 之后。方向键序列因此天然不含它——它根本不在那个组里。
   */
  const activeIndex = Math.max(0, items.findIndex((item) => item.id === currentId))

  return (
    <div className="compose-editor__workspace-control">
    <div
      aria-label={messages.workspaces.switcher}
      className="compose-editor__workspace-switcher"
      ref={groupRef}
      role="radiogroup"
    >
      {items.map((item, index) => {
        const checked = item.id === currentId
        return (
          <button
            key={item.id}
            aria-checked={checked}
            className="compose-editor__workspace-option"
            data-workspace-id={item.id}
            role="radio"
            style={{ order: index * 2 }}
            tabIndex={checked ? 0 : -1}
            title={item.description ?? messages.workspaces.hint}
            type="button"
            onClick={() => workspace.switchTo(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span>{item.title}</span>
            {item.modified ? (
              <span
                aria-label={messages.workspaces.modified}
                className="compose-editor__workspace-modified"
                role="img"
              />
            ) : null}
          </button>
        )
      })}
    </div>
      <WorkspaceMenu order={activeIndex * 2 + 1} />
      {/*
        * `＋` 打开的就是管理菜单里「另存为」那条流程（复制当前工作区并要一个名字），不是第二
        * 份实现——多一个入口允许，两份实现必然漂移。它排在最后一格之后、在 radiogroup 之外：
        * 它不是一个可以被方向键走到的工作区。
        */}
      <button
        aria-label={messages.workspaces.newWorkspace}
        className="compose-editor__workspace-add"
        style={{ order: items.length * 2 }}
        title={messages.workspaces.newWorkspace}
        type="button"
        onClick={() => workspace.openDialog('saveAs')}
      >
        <PlusIcon />
      </button>
    </div>
  )
}

/** `＋`：新建工作区。 */
function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="M8 3.6v8.8M3.6 8h8.8" />
    </svg>
  )
}

/**
 * 工作区管理菜单：另存为、重命名、自定义工具栏、重置、删除、只看画布。
 *
 * @remarks
 * 「保存」没有入口——松手即记入，段上的点与「重置」就是保存的全部呈现。内建与宿主注入的
 * 不可删、不可重命名：菜单项灰掉并标「内建」，而不是藏起来——藏起来用户会以为自己的也删不了。
 * @internal
 */
export function WorkspaceMenu({ order }: { order?: number }) {
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)
  const { workspace } = useWorkspaceContent()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const t = messages.workspaces
  const injected = workspace.current.injected

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }
  const choose = (action: () => void) => {
    setOpen(false)
    action()
  }
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([aria-disabled="true"]), [role="menuitemcheckbox"]') ?? [])]
    const index = event.target instanceof HTMLButtonElement ? buttons.indexOf(event.target) : -1
    const next = event.key === 'ArrowDown'
      ? (index + 1 + buttons.length) % buttons.length
      : (index - 1 + buttons.length) % buttons.length
    buttons[next]?.focus()
  }
  const disabledLabel = (label: string) => (injected ? `${label}（${t.builtin}）` : label)

  return (
    <div className="compose-editor__workspace-menu-anchor" style={{ order }}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t.menu}
        className="compose-editor__workspace-menu-trigger"
        ref={triggerRef}
        title={t.menu}
        type="button"
        onClick={() => {
          setOpen((value) => !value)
          window.requestAnimationFrame(() => {
            menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
          })
        }}
      >
        <ChevronIcon />
      </button>
      {open ? (
        <div
          aria-label={t.menu}
          className="compose-editor__workspace-menu"
          id={menuId}
          ref={menuRef}
          role="menu"
          onKeyDown={onMenuKeyDown}
        >
          <button role="menuitem" type="button" onClick={() => choose(() => workspace.openDialog('saveAs'))}>
            {t.saveAs}
          </button>
          <button
            aria-disabled={injected}
            role="menuitem"
            title={injected ? t.builtinHint : undefined}
            type="button"
            onClick={() => { if (!injected) choose(() => workspace.openDialog('rename')) }}
          >
            {disabledLabel(t.rename)}
          </button>
          <button role="menuitem" type="button" onClick={() => choose(() => workspace.openDialog('toolbar'))}>
            {t.customizeToolbar}
          </button>
          <button role="menuitem" type="button" onClick={() => choose(() => workspace.reset())}>
            {t.reset}
          </button>
          <button
            aria-disabled={injected}
            role="menuitem"
            title={injected ? t.builtinHint : undefined}
            type="button"
            onClick={() => { if (!injected) choose(() => workspace.openDialog('delete')) }}
          >
            {disabledLabel(t.remove)}
          </button>
          <button
            aria-checked={workspace.canvasOnly}
            role="menuitemcheckbox"
            type="button"
            onClick={() => choose(() => workspace.toggleCanvasOnly())}
          >
            {t.canvasOnly}
          </button>
        </div>
      ) : null}
    </div>
  )
}

/**
 * 画布列头上的文档标签条：`tablist`，只占画布那一列。
 *
 * @remarks
 * 它住在画布面板内容的**第一行**：三列在 Dockview 的网格里是同一行的兄弟，左右两组各自画 30px
 * 的组头，而画布组隐藏组头，因此这一行天然从组头那条线开始——与左右面板头逐像素齐平，不需要
 * 任何对齐代码。它不做成 Dockview 组头：那要求文档成为 Dockview panel，而文档不参与拖放、浮动
 * 与布局持久化，正是「文档不是 panel」这条存在的理由。
 *
 * 它也不与 36px 的画布工具栏合成一行：标签数量没有上界，而工具栏货架从尾部溢出，同行会让多开
 * 一个文件就吃掉一颗工具按钮。
 *
 * 标签的键盘与 ARIA 自己写——方向键在文档间移动并激活（自动激活式 tablist），`Home` / `End`
 * 到两端，`Delete` **不**关闭：关闭要走 dirty 确认流程，从键盘误触删掉一个未保存的页面比多点
 * 一下关闭按钮糟得多。只有活动标签在 Tab 序里（roving tabindex），标签条对键盘用户是一站。
 */
export function WorkspaceDocumentTabs() {
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)
  const {
    activateDocument,
    activeDocumentPanelId,
    documents,
    editorMode,
    onEditorModeChange,
    requestDocumentClose,
    stageHostPanelId,
  } = useWorkspaceContent()
  const listRef = useRef<HTMLDivElement>(null)
  // 未启用页面系统时固定画布是第一个、不可关闭的标签：资源文件仍能以标签打开，用户要有路回来。
  const canvasEntry: DocumentTabEntry[] = stageHostPanelId === WORKSPACE_PANEL_IDS.canvas
    ? [{ panelId: WORKSPACE_PANEL_IDS.canvas, title: messages.workspace.canvas }]
    : []
  const entries: DocumentTabEntry[] = [
    ...canvasEntry,
    ...[...documents.values()].map((session) => ({
      panelId: session.panelId,
      session,
      title: documentTitle(session, messages),
    })),
  ]

  const focusTab = (panelId: string) => {
    const selector = `[data-workspace-tab="${CSS.escape(panelId)}"]`
    listRef.current?.querySelector<HTMLElement>(selector)?.focus()
  }
  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (entries.length === 0) return
    let next: number | null = null
    if (event.key === 'ArrowRight') next = (index + 1) % entries.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + entries.length) % entries.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = entries.length - 1
    if (next === null) return
    event.preventDefault()
    const target = entries[next]!
    activateDocument(target.panelId)
    focusTab(target.panelId)
  }

  const activeSession = entries.find((entry) => entry.panelId === activeDocumentPanelId)?.session
  // 模式只对页面与组件文档成立：资源文件文档没有场景，也就没有「在编哪一层」这个问题。
  const showMode = (activeSession?.kind === 'page' || activeSession?.kind === 'component')
    && editorMode !== undefined && onEditorModeChange !== undefined

  return (
    <div className="compose-editor__document-tabs">
      <div className="compose-editor__document-tabs-scroll">
      <div
        aria-label={messages.workspace.documentTabs}
        className="compose-editor__document-tablist"
        ref={listRef}
        role="tablist"
      >
        {entries.map((entry, index) => {
          const active = entry.panelId === activeDocumentPanelId
          return (
            <div
              key={entry.panelId}
              aria-selected={active}
              className="compose-editor__document-tab"
              data-active={active ? 'true' : undefined}
              data-workspace-tab={entry.panelId}
              role="tab"
              tabIndex={active ? 0 : -1}
              title={entry.title}
              onClick={() => activateDocument(entry.panelId)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              <DocumentTabIcon entry={entry} />
              <span className="compose-editor__document-tab-title">{entry.title}</span>
              {entry.session?.dirty ? (
                <span
                  aria-label={messages.pages.dirtyIndicator}
                  className="compose-editor__document-dirty"
                  role="img"
                />
              ) : null}
              {entry.session ? (
                <button
                  aria-label={closeLabel(entry.session, entry.title, messages)}
                  className="compose-editor__asset-document-close"
                  tabIndex={-1}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    requestDocumentClose(entry.panelId)
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  ×
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
      </div>
      {showMode ? (
        <div className="compose-editor__document-tabs-mode">
          <EditorModeSwitcher mode={editorMode} onModeChange={onEditorModeChange} />
        </div>
      ) : null}
    </div>
  )
}

/**
 * 应用顶栏：标志 ▾ ｜ 工作区 ｜ 三个布局开关。
 *
 * @remarks
 * 三段之间**只有间距**，不画竖线：标志钉在最左、开关钉在最右，位置本身已经分好段，而竖线是把
 * 「我数得清有几段」画出来，那件事本来不需要用户去数。
 *
 * 顶栏只承载应用与视图作用域。文档标签住画布列头、模式切换器住画布工具栏、保存走
 * `document.save` 动作——此前这一条里四种作用域并列，用户读不出哪个管哪个。
 */
export function EditorTopBar() {
  return (
    <div className="compose-editor__top-bar">
      <EditorBrandMenu />
      <WorkspaceSwitcher />
      <div className="compose-editor__top-bar-spacer" />
      <WorkspaceLayoutToggles />
    </div>
  )
}

/**
 * 文档标签上的类型图标。
 *
 * @remarks
 * 按会话种类分档而不是按扩展名穷举：页面与组件各一个图标，资源文件按「像不像代码」再分一次
 * ——图标回答的是「这是哪一类东西」，不是「它叫什么后缀」。
 */
function DocumentTabIcon({ entry }: { entry: DocumentTabEntry }) {
  const kind = entry.session?.kind
  if (kind === 'asset') {
    const code = /\.(?:js|jsx|ts|tsx|json|mjs|cjs)$/i.test(entry.title)
    return (
      <svg aria-hidden="true" className="compose-editor__document-tab-icon" viewBox="0 0 16 16">
        {code
          ? <path d="m5.6 5.4-2.6 2.6 2.6 2.6M10.4 5.4 13 8l-2.6 2.6" />
          : <path d="M8 2.8 13.4 12H2.6z" />}
      </svg>
    )
  }
  return (
    <svg aria-hidden="true" className="compose-editor__document-tab-icon" viewBox="0 0 16 16">
      {kind === 'component'
        ? <path d="M8 2.4 13.2 5.4v5.2L8 13.6 2.8 10.6V5.4z" />
        : <><path d="M4.2 2.6h4.8l3 3v7.8H4.2z" /><path d="M8.9 2.7v3h3" /></>}
    </svg>
  )
}

/** 三个布局开关各自的图标/** 三个布局开关各自的图标：面板矩形加上被点亮的那一条边。 */
function LayoutToggleIcon({ side }: { side: ComposeWorkspaceSide }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <rect height="11" rx="1.5" width="13" x="1.5" y="2.5" />
      {side === 'left' ? <rect className="compose-editor__layout-toggle-fill" height="11" width="4.5" x="1.5" y="2.5" /> : null}
      {side === 'right' ? <rect className="compose-editor__layout-toggle-fill" height="11" width="4.5" x="10" y="2.5" /> : null}
      {side === 'bottom' ? <rect className="compose-editor__layout-toggle-fill" height="3.5" width="13" x="1.5" y="10" /> : null}
    </svg>
  )
}

const LAYOUT_TOGGLE_SIDES: readonly ComposeWorkspaceSide[] = ['left', 'bottom', 'right']

/**
 * 顶栏右端的三个布局开关：折叠与展开左 / 底 / 右三块面板的**唯一**入口。
 *
 * @remarks
 * 它取代了两样东西——组头上的折叠按钮与收起后留在编辑器边缘的 8px 把手。那两样合起来是同一个
 * 动作的两个入口，而且**不在同一个地方**：收起用组头、展开用把手（因为组头已经跟着组一起藏
 * 掉了），底栏则两个都没有。开关常驻顶栏因此不是审美选择——**位置不随面板存亡而移动**正是
 * 把手唯一解决不了的那件事。
 *
 * 两种状态都渲染（实心 = 展开、描边 = 收起）：只在其中一态出现的指示器无法让用户确认另一态。
 * 折叠状态住在布局快照里，因此这里不自己记一份，也不产生事务。
 * @internal
 */
export function WorkspaceLayoutToggles() {
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)
  const { sideCollapsed, toggleSide } = useWorkspaceContent()
  const paneTitle: Readonly<Record<ComposeWorkspaceSide, string>> = {
    left: messages.workspace.leftPane,
    right: messages.workspace.rightPane,
    bottom: messages.workspace.bottomPane,
  }

  return (
    <div className="compose-editor__layout-toggles">
      {LAYOUT_TOGGLE_SIDES.map((side) => {
        const collapsed = sideCollapsed[side]
        const label = collapsed
          ? messages.expandPanel(paneTitle[side])
          : messages.collapsePanel(paneTitle[side])
        return (
          <button
            key={side}
            aria-label={label}
            aria-pressed={!collapsed}
            className="compose-editor__layout-toggle"
            data-side={side}
            title={label}
            type="button"
            onClick={() => toggleSide(side)}
          >
            <LayoutToggleIcon side={side} />
          </button>
        )
      })}
    </div>
  )
}
