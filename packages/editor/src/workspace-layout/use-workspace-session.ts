import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import type { DockviewApi } from 'dockview-react'
import type { ComposeI18nContextValue, ComposeLocale } from '@compose-ui/ui-context'
import type { ComposeEditorPreferences } from '../editor-preferences'
import { getEditorMessages } from '../editor-i18n'
import type { ComposeComponentShelf } from '@compose-ui/component-library'
import type { ComposeToolbarShelf } from '../stage-toolbar/toolbar-shelf'
import type {
  ComposeEditorCustomWorkspace,
  ComposeEditorWorkspaceDefinition,
  ComposeWorkspaceSeeds,
  ComposeWorkspaceSession,
} from './workspace-definition'
import {
  COMPOSE_PAGE_WORKSPACE_ID,
  DEFAULT_WORKSPACE_LAYOUT_PRESET,
  DEFAULT_WORKSPACE_SEEDS,
  isInjectedWorkspace,
  resolveWorkspaceDescription,
  resolveWorkspaceList,
  resolveWorkspacePaletteTitle,
  resolveWorkspaceTitle,
} from './workspace-definition'
import {
  buildWorkspaceLayout,
  DEFAULT_TOOLS_WEIGHT,
  localizeWorkspace,
  resolveToolsWeight,
  setWorkspacePaletteTitle,
  syncWorkspaceHistoryPanel,
  WORKSPACE_PANEL_IDS,
} from './workspace-layout'
import {
  applyWorkspaceLayout,
  captureWorkspaceSnapshot,
  workspacePresetSignature,
  workspaceSnapshotSignature,
} from './workspace-snapshot'

/** 切换器上的一段。 @internal */
export interface ComposeWorkspaceSessionItem {
  readonly id: string
  readonly title: string
  readonly description: string | undefined
  readonly icon: ReactNode | undefined
  /** 与基线不同：面板挪过位。尺寸、折叠与活动标签的改动不点亮。 */
  readonly modified: boolean
  /** 内建或宿主注入：不可删、不可重命名，重置回到定义自带的布局。 */
  readonly injected: boolean
}

/** 管理菜单打开的对话框。 @internal */
/**
 * 工作区管理菜单能打开的对话框。
 *
 * @remarks
 * `toolbar` 与 `palette` 是两条**货架**的编辑面。它们与 `saveAs` / `rename` / `delete` 并列，
 * 因为它们改的同样是「这个工作区是什么样子」，写的同样是偏好而不是文档。
 */
export type ComposeWorkspaceDialog = 'saveAs' | 'rename' | 'delete' | 'toolbar' | 'palette' | null

/** 工作区会话：切换器、管理菜单、动作目录三处共用的一份状态与动作。 @internal */
export interface ComposeWorkspaceSessionHandle {
  readonly items: readonly ComposeWorkspaceSessionItem[]
  readonly currentId: string
  readonly current: ComposeWorkspaceSessionItem
  /** 当前工作区的物料货架；缺省时面板铺自己的默认货架。 */
  readonly palette: ComposeComponentShelf | undefined
  /** 当前工作区的工具栏货架；缺省时工具栏铺目录的全部项。 */
  readonly toolbar: ComposeToolbarShelf | undefined
  /** 改当前工作区的工具栏货架；写偏好，不进撤销历史。 */
  readonly setToolbarShelf: (shelf: ComposeToolbarShelf) => void
  /** 改当前工作区的物料货架；写偏好，不进撤销历史。 */
  readonly setPaletteShelf: (shelf: ComposeComponentShelf) => void
  /** 当前工作区的新建种子；新建页面时落地。 */
  readonly seeds: ComposeWorkspaceSeeds
  /** 当前工作区左栏工具组的高度权重；容器量到真实尺寸之后按它再落一次初始尺寸。 */
  readonly toolsWeight: number
  readonly canvasOnly: boolean
  readonly dialog: ComposeWorkspaceDialog
  readonly switchTo: (id: string) => void
  readonly next: () => void
  readonly previous: () => void
  readonly openDialog: (dialog: Exclude<ComposeWorkspaceDialog, null>) => void
  readonly closeDialog: () => void
  readonly saveAs: (title: string) => void
  readonly rename: (title: string) => void
  readonly reset: () => void
  readonly remove: () => void
  readonly toggleCanvasOnly: () => void
  /** 记着某个工作区的文档数；删除确认框写它。 */
  readonly documentsRemembering: (id: string) => number
  /** 删掉某个工作区之后记着它的文档回到哪儿。 */
  readonly fallbackFor: (id: string) => ComposeWorkspaceSessionItem
}

/** 画布会话开关的读写端口；由 controller 提供，纯插槽宿主没有。 @internal */
export interface ComposeWorkspaceSessionPort {
  readonly get: () => ComposeWorkspaceSession
  readonly set: (next: ComposeWorkspaceSession) => void
}

/** @internal */
export interface UseWorkspaceSessionOptions {
  readonly apiRef: RefObject<DockviewApi | null>
  readonly ready: boolean
  readonly injected: readonly ComposeEditorWorkspaceDefinition[]
  readonly preferences: ComposeEditorPreferences
  readonly updatePreferences: (next: ComposeEditorPreferences) => void
  readonly locale: ComposeLocale
  readonly formatMessage?: ComposeI18nContextValue['formatMessage']
  readonly historyEnabled: boolean
  /** 活动文档的 key；固定画布与没有文档时为 null，不参与按文档记忆。 */
  readonly activeDocumentKey: string | null
  readonly sessionPort: ComposeWorkspaceSessionPort | null
  /** 非阻断提示：自定义工作区的布局损坏被移除时说一句。 */
  readonly notify: (message: string) => void
}

/** 快照记入偏好的防抖：拖 sash 一次会发几十个布局事件。 */
const RECORD_DEBOUNCE_MS = 300

/** 所有面板都可能出现在布局里；签名自己会略过历史。 */
const ALL_PANEL_IDS: ReadonlySet<string> = new Set(Object.values(WORKSPACE_PANEL_IDS))

function baselineSignature(workspace: ComposeEditorWorkspaceDefinition) {
  return workspace.layout.kind === 'preset'
    ? workspacePresetSignature(workspace.layout, ALL_PANEL_IDS)
    : workspaceSnapshotSignature(workspace.layout)
}

/** 显示名重复时自动加序号：起名不是这一步该拦人的地方。 */
function uniqueTitle(title: string, taken: readonly string[]) {
  const base = title.trim()
  if (!taken.includes(base)) return base
  let index = 2
  while (taken.includes(`${base} ${index}`)) index += 1
  return `${base} ${index}`
}

function omitKey<T>(record: Readonly<Record<string, T>>, key: string): Readonly<Record<string, T>> {
  return Object.fromEntries(Object.entries(record).filter(([candidate]) => candidate !== key))
}

function createCustomId() {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * 工作区会话。
 *
 * @remarks
 * 三样事实各住一处：**列表**由宿主注入的定义加偏好里另存的合成；**当前是哪个**是这里的
 * state；**每个工作区的样子**（拖过的布局、会话开关）在偏好与会话内存里。切换 = 把目标的
 * 布局与开关落到 Dockview 与 controller 上，然后记入 `lastUsed` 与当前文档的记忆。
 *
 * 布局的应用与记录互相看不见：应用期间 `applyingRef` 拦住布局事件，应用完把当时的序列化结果
 * 记成基线，此后只有与基线不同的布局才写进偏好——否则每次切换都会往偏好里塞一份没人动过的
 * 快照。
 *
 * @internal
 */
export function useWorkspaceSession(options: UseWorkspaceSessionOptions): ComposeWorkspaceSessionHandle {
  // 只在回调里读的选项（会话端口、历史开关）经 optionsRef 取此刻的值，
  // 不解构：解构出来只会被闭包捕获成过期的一份。
  const {
    activeDocumentKey,
    apiRef,
    formatMessage,
    injected,
    locale,
    notify,
    preferences,
    ready,
    updatePreferences,
  } = options
  const workspaces = useMemo(
    () => resolveWorkspaceList(injected, preferences.workspace.custom),
    [injected, preferences.workspace.custom],
  )
  const messages = useMemo(() => getEditorMessages(locale, formatMessage), [formatMessage, locale])

  // 回调里读的偏好必须是**此刻**的那份：受控偏好由宿主回传，订阅时捕获的那份会过期。
  const preferencesRef = useRef(preferences)
  const workspacesRef = useRef(workspaces)
  const optionsRef = useRef(options)
  useLayoutEffect(() => {
    preferencesRef.current = preferences
    workspacesRef.current = workspaces
    optionsRef.current = options
  })

  const resolveInitialId = () => {
    const wanted = preferences.workspace.lastUsed
    return workspaces.some((workspace) => workspace.id === wanted)
      ? wanted
      : workspaces[0]?.id ?? COMPOSE_PAGE_WORKSPACE_ID
  }
  const [selectedId, setCurrentId] = useState(resolveInitialId)
  // 选中的 id 不在列表里（宿主换了注入的列表、偏好里的自定义没了）：按 lastUsed → 第一个回退。
  // 在渲染期派生而不是在 effect 里改 state，否则会多一帧停在一个不存在的工作区上。
  const currentId = workspaces.some((workspace) => workspace.id === selectedId)
    ? selectedId
    : (workspaces.some((workspace) => workspace.id === preferences.workspace.lastUsed)
        ? preferences.workspace.lastUsed
        : workspaces[0]?.id ?? COMPOSE_PAGE_WORKSPACE_ID)
  const currentIdRef = useRef(currentId)
  useLayoutEffect(() => { currentIdRef.current = currentId })
  const [applyVersion, setApplyVersion] = useState(0)
  const [dialog, setDialog] = useState<ComposeWorkspaceDialog>(null)
  const [canvasOnly, setCanvasOnly] = useState(false)

  /** 切走时记下的会话开关；切回来恢复。 */
  const sessionMemory = useRef(new Map<string, ComposeWorkspaceSession>())
  /** 「只看画布」按工作区记忆。 */
  const canvasOnlyMemory = useRef(new Map<string, boolean>())
  const applyingRef = useRef(false)
  const appliedRef = useRef<{ readonly id: string; readonly version: number } | null>(null)
  const baselineJsonRef = useRef<string | null>(null)

  const writeWorkspacePreferences = useCallback((
    update: (current: ComposeEditorPreferences['workspace']) => ComposeEditorPreferences['workspace'],
  ) => {
    const current = preferencesRef.current
    const next = { ...current, workspace: update(current.workspace) }
    preferencesRef.current = next
    updatePreferences(next)
  }, [updatePreferences])

  const findWorkspace = useCallback((id: string) => (
    workspacesRef.current.find((workspace) => workspace.id === id)
  ), [])

  const fallbackIdFor = useCallback((removedId: string) => {
    const { lastUsed } = preferencesRef.current.workspace
    const list = workspacesRef.current
    if (lastUsed !== removedId && list.some((workspace) => workspace.id === lastUsed)) return lastUsed
    return list.find((workspace) => workspace.id !== removedId)?.id ?? COMPOSE_PAGE_WORKSPACE_ID
  }, [])

  const removeWorkspace = useCallback((id: string) => {
    if (isInjectedWorkspace(injected, id)) return
    const fallback = fallbackIdFor(id)
    writeWorkspacePreferences((workspace) => ({
      ...workspace,
      lastUsed: workspace.lastUsed === id ? fallback : workspace.lastUsed,
      byDocument: Object.fromEntries(Object.entries(workspace.byDocument)
        .map(([key, value]) => [key, value === id ? fallback : value])),
      layouts: omitKey(workspace.layouts, id),
      custom: workspace.custom.filter((custom) => custom.id !== id),
    }))
    sessionMemory.current.delete(id)
    canvasOnlyMemory.current.delete(id)
    if (currentIdRef.current === id) setCurrentId(fallback)
  }, [fallbackIdFor, injected, writeWorkspacePreferences])

  /** 把某个工作区的布局与开关落到 Dockview 与 controller 上。 */
  const applyWorkspace = useCallback((id: string, version: number) => {
    const api = apiRef.current
    const workspace = findWorkspace(id)
    if (!api || !workspace) return
    const { formatMessage: fm, historyEnabled: history, locale: currentLocale } = optionsRef.current
    applyingRef.current = true
    let result: ReturnType<typeof applyWorkspaceLayout>
    try {
      result = applyWorkspaceLayout(api, workspace.layout, preferencesRef.current.workspace.layouts[id], {
        build: (preset) => {
          buildWorkspaceLayout(api, preset, currentLocale, fm, { historyEnabled: history })
        },
        afterSnapshot: () => {
          localizeWorkspace(api, currentLocale, fm)
          syncWorkspaceHistoryPanel(api, history, currentLocale, fm)
        },
      })
    }
    finally {
      applyingRef.current = false
    }
    if (result === 'invalid') {
      notify(messages.workspaceRemoved(resolveWorkspaceTitle(workspace, currentLocale)))
      removeWorkspace(id)
      return
    }
    setWorkspacePaletteTitle(api, resolveWorkspacePaletteTitle(
      workspace,
      currentLocale,
      getEditorMessages(currentLocale, fm).workspace.componentLibrary,
    ))
    optionsRef.current.sessionPort?.set(sessionMemory.current.get(id) ?? workspace.session)
    const wantsCanvasOnly = canvasOnlyMemory.current.get(id) ?? false
    const canvasPanel = api.getPanel(WORKSPACE_PANEL_IDS.canvas)
    if (wantsCanvasOnly && canvasPanel && typeof api.maximizeGroup === 'function') api.maximizeGroup(canvasPanel)
    setCanvasOnly(wantsCanvasOnly)
    baselineJsonRef.current = JSON.stringify(captureWorkspaceSnapshot(api)?.data ?? null)
    appliedRef.current = { id, version }
  }, [apiRef, findWorkspace, messages, notify, removeWorkspace])

  // 就绪之后应用当前工作区；编辑器挂载时已经摆出了默认布局，`page` 没有用户快照时不必再摆一遍。
  useEffect(() => {
    const api = apiRef.current
    if (!ready || !api) return
    const applied = appliedRef.current
    if (applied?.id === currentId && applied.version === applyVersion) return
    const workspace = findWorkspace(currentId)
    if (!workspace) return
    const untouchedDefault = applied === null
      && workspace.layout === DEFAULT_WORKSPACE_LAYOUT_PRESET
      && preferencesRef.current.workspace.layouts[currentId] === undefined
    if (untouchedDefault) {
      // 语言与文案取此刻的那份（optionsRef），与这个 effect 里其余读取一致：把它们写进依赖
      // 会让换一次语言就重摆一次布局。
      const { formatMessage: fm, locale: currentLocale } = optionsRef.current
      setWorkspacePaletteTitle(api, resolveWorkspacePaletteTitle(
        workspace,
        currentLocale,
        getEditorMessages(currentLocale, fm).workspace.componentLibrary,
      ))
      optionsRef.current.sessionPort?.set(sessionMemory.current.get(currentId) ?? workspace.session)
      baselineJsonRef.current = JSON.stringify(captureWorkspaceSnapshot(api)?.data ?? null)
      appliedRef.current = { id: currentId, version: applyVersion }
      return
    }
    applyWorkspace(currentId, applyVersion)
  }, [apiRef, applyVersion, applyWorkspace, currentId, findWorkspace, ready])

  /** 把此刻的布局记入当前工作区（与基线不同才写）。 */
  const recordLayout = useCallback(() => {
    const api = apiRef.current
    if (!api || applyingRef.current) return
    const snapshot = captureWorkspaceSnapshot(api)
    if (!snapshot) return
    const json = JSON.stringify(snapshot.data)
    if (json === baselineJsonRef.current) return
    baselineJsonRef.current = json
    const id = currentIdRef.current
    writeWorkspacePreferences((workspace) => ({
      ...workspace,
      layouts: { ...workspace.layouts, [id]: snapshot },
    }))
  }, [apiRef, writeWorkspacePreferences])
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /**
   * 把还在防抖里的记录立刻落下。
   *
   * @remarks
   * 切换、另存、重置与删除之前都要调：防抖到期时当前工作区可能已经换了，那份拖动会被记到
   * 错的名下、再被新基线比对丢掉——症状是「刚拖完就切走，切回来布局没了」。
   */
  const flushRecord = useCallback(() => {
    if (recordTimerRef.current === null) return
    clearTimeout(recordTimerRef.current)
    recordTimerRef.current = null
    recordLayout()
  }, [recordLayout])

  // 布局变了就记入当前工作区：防抖（拖 sash 一次会发几十个布局事件），且只记与基线不同的。
  useEffect(() => {
    const api = apiRef.current
    if (!ready || !api || typeof api.onDidLayoutChange !== 'function') return
    const subscription = api.onDidLayoutChange(() => {
      if (applyingRef.current) return
      if (recordTimerRef.current !== null) clearTimeout(recordTimerRef.current)
      recordTimerRef.current = setTimeout(() => {
        recordTimerRef.current = null
        recordLayout()
      }, RECORD_DEBOUNCE_MS)
    })
    return () => {
      if (recordTimerRef.current !== null) {
        clearTimeout(recordTimerRef.current)
        recordTimerRef.current = null
      }
      subscription.dispose()
    }
  }, [apiRef, ready, recordLayout])

  // 「只看画布」的事实在 Dockview 里：用户按 Escape 之类退出最大化时状态要跟上。
  useEffect(() => {
    const api = apiRef.current
    if (!ready || !api || typeof api.onDidMaximizedGroupChange !== 'function') return
    const subscription = api.onDidMaximizedGroupChange(() => {
      const maximized = api.hasMaximizedGroup()
      canvasOnlyMemory.current.set(currentIdRef.current, maximized)
      setCanvasOnly(maximized)
    })
    return () => subscription.dispose()
  }, [apiRef, ready])

  const switchTo = useCallback((id: string, options?: { readonly rememberDocument?: boolean }) => {
    if (id === currentIdRef.current || !findWorkspace(id)) return
    flushRecord()
    const port = optionsRef.current.sessionPort
    if (port) sessionMemory.current.set(currentIdRef.current, port.get())
    const documentKey = optionsRef.current.activeDocumentKey
    writeWorkspacePreferences((workspace) => ({
      ...workspace,
      lastUsed: id,
      byDocument: documentKey && (options?.rememberDocument ?? true)
        ? { ...workspace.byDocument, [documentKey]: id }
        : workspace.byDocument,
    }))
    setCurrentId(id)
  }, [findWorkspace, flushRecord, writeWorkspacePreferences])

  // 按文档记忆：激活一个文档时应用它记着的工作区；没记过就记成当前。
  useEffect(() => {
    if (!ready || !activeDocumentKey) return
    const remembered = preferencesRef.current.workspace.byDocument[activeDocumentKey]
    if (remembered === undefined) {
      writeWorkspacePreferences((workspace) => ({
        ...workspace,
        byDocument: { ...workspace.byDocument, [activeDocumentKey]: currentIdRef.current },
      }))
      return
    }
    if (remembered === currentIdRef.current) return
    if (!findWorkspace(remembered)) {
      // 记着的工作区没了：回到 lastUsed，并把记忆改过去。
      const fallback = fallbackIdFor(remembered)
      writeWorkspacePreferences((workspace) => ({
        ...workspace,
        byDocument: { ...workspace.byDocument, [activeDocumentKey]: fallback },
      }))
      switchTo(fallback, { rememberDocument: false })
      return
    }
    switchTo(remembered, { rememberDocument: false })
  }, [activeDocumentKey, fallbackIdFor, findWorkspace, ready, switchTo, writeWorkspacePreferences])

  const items = useMemo<readonly ComposeWorkspaceSessionItem[]>(() => workspaces.map((workspace) => {
    const userSnapshot = preferences.workspace.layouts[workspace.id]
    /*
     * 修改点表示「与基线不同」，来源有三处：面板挪过位、工具栏货架改过、物料货架改过。
     * 货架只要在偏好里存在就算改过——它是用户显式编辑的产物，不像布局快照那样每次拖分栏都
     * 会被记一份，因此不需要再与基线比一次签名。
     */
    const modified = (userSnapshot !== undefined
      && workspaceSnapshotSignature(userSnapshot) !== baselineSignature(workspace))
      || preferences.workspace.toolbars[workspace.id] !== undefined
      || preferences.workspace.palettes[workspace.id] !== undefined
    return {
      id: workspace.id,
      title: resolveWorkspaceTitle(workspace, locale),
      description: resolveWorkspaceDescription(workspace, locale),
      icon: workspace.icon,
      modified,
      injected: isInjectedWorkspace(injected, workspace.id),
    }
  }), [
    injected,
    locale,
    preferences.workspace.layouts,
    preferences.workspace.palettes,
    preferences.workspace.toolbars,
    workspaces,
  ])
  const current = items.find((item) => item.id === currentId) ?? items[0]!

  const step = useCallback((offset: number) => {
    const list = workspacesRef.current
    const index = list.findIndex((workspace) => workspace.id === currentIdRef.current)
    const target = list[(index + offset + list.length) % list.length]
    if (target) switchTo(target.id)
  }, [switchTo])

  const saveAs = useCallback((title: string) => {
    const api = apiRef.current
    if (!api) return
    flushRecord()
    const sourceId = currentIdRef.current
    const source = findWorkspace(sourceId)
    const snapshot = preferencesRef.current.workspace.layouts[sourceId] ?? captureWorkspaceSnapshot(api)
    if (!source || !snapshot) return
    const port = optionsRef.current.sessionPort
    const session = port ? port.get() : sessionMemory.current.get(sourceId) ?? source.session
    const id = createCustomId()
    const taken = workspacesRef.current.map((workspace) => resolveWorkspaceTitle(workspace, locale))
    const custom: ComposeEditorCustomWorkspace = {
      id,
      title: uniqueTitle(title, taken),
      layout: snapshot,
      /*
       * 另存为复制的是**此刻的样子**：布局、两条货架、画布默认值与新建种子一起走，否则用户
       * 会得到一个「布局对了但符号库不见了」的工作区。
       *
       * 货架从**偏好**里读而不是读上面那两个派生值：那两个声明在本回调之后，写进依赖数组会在
       * 渲染期撞上 TDZ。而偏好正是「用户改过的那份」的事实来源，读它反而更直接。
       */
      palette: preferencesRef.current.workspace.palettes[sourceId] ?? source.palette,
      toolbar: preferencesRef.current.workspace.toolbars[sourceId] ?? source.toolbar,
      session,
      seeds: source.seeds,
    }
    const documentKey = optionsRef.current.activeDocumentKey
    // 新工作区的样子就是此刻的样子：不必再摆一遍，直接把它记成已应用。
    sessionMemory.current.set(id, session)
    canvasOnlyMemory.current.set(id, canvasOnlyMemory.current.get(sourceId) ?? false)
    appliedRef.current = { id, version: applyVersion }
    writeWorkspacePreferences((workspace) => ({
      ...workspace,
      lastUsed: id,
      byDocument: documentKey ? { ...workspace.byDocument, [documentKey]: id } : workspace.byDocument,
      custom: [...workspace.custom, custom],
    }))
    setCurrentId(id)
    setDialog(null)
  }, [apiRef, applyVersion, findWorkspace, flushRecord, locale, writeWorkspacePreferences])

  const rename = useCallback((title: string) => {
    const id = currentIdRef.current
    if (isInjectedWorkspace(injected, id)) return
    const trimmed = title.trim()
    if (trimmed === '') return
    writeWorkspacePreferences((workspace) => ({
      ...workspace,
      custom: workspace.custom.map((custom) => (custom.id === id ? { ...custom, title: trimmed } : custom)),
    }))
    setDialog(null)
  }, [injected, writeWorkspacePreferences])

  const reset = useCallback(() => {
    // 待记录的快照先扔掉：重置要的正是「不要它」。
    if (recordTimerRef.current !== null) {
      clearTimeout(recordTimerRef.current)
      recordTimerRef.current = null
    }
    const id = currentIdRef.current
    // 「重置」一并拉回布局与**两条货架**：它们都是「与基线不同」的来源，只重置其中一样会让
    // 修改点重置之后还亮着，而用户已经点过那个菜单项了。
    writeWorkspacePreferences((workspace) => ({
      ...workspace,
      layouts: omitKey(workspace.layouts, id),
      toolbars: omitKey(workspace.toolbars, id),
      palettes: omitKey(workspace.palettes, id),
    }))
    setApplyVersion((version) => version + 1)
  }, [writeWorkspacePreferences])

  /**
   * 改当前工作区的工具栏货架。
   *
   * @remarks
   * 写偏好而不是写定义：定义是内建或宿主给的，用户的改动住在自己那一份偏好里，因此「重置」
   * 只要把这一条删掉就回到基线。与布局快照是同一条通路，也同样**不进撤销历史**——它是
   * 「我怎么看」，不是文档。
   */
  const setToolbarShelf = useCallback((shelf: ComposeToolbarShelf) => {
    const id = currentIdRef.current
    writeWorkspacePreferences((workspace) => ({
      ...workspace,
      toolbars: { ...workspace.toolbars, [id]: shelf },
    }))
  }, [writeWorkspacePreferences])

  /** 改当前工作区的物料货架；与 {@link setToolbarShelf} 同一条通路。 */
  const setPaletteShelf = useCallback((shelf: ComposeComponentShelf) => {
    const id = currentIdRef.current
    writeWorkspacePreferences((workspace) => ({
      ...workspace,
      palettes: { ...workspace.palettes, [id]: shelf },
    }))
  }, [writeWorkspacePreferences])

  const remove = useCallback(() => {
    setDialog(null)
    removeWorkspace(currentIdRef.current)
  }, [removeWorkspace])

  const toggleCanvasOnly = useCallback(() => {
    const api = apiRef.current
    if (!api) return
    const maximized = typeof api.hasMaximizedGroup === 'function' && api.hasMaximizedGroup()
    if (maximized) {
      api.exitMaximizedGroup()
    }
    else {
      const canvasPanel = api.getPanel(WORKSPACE_PANEL_IDS.canvas)
      if (!canvasPanel || typeof api.maximizeGroup !== 'function') return
      api.maximizeGroup(canvasPanel)
    }
    canvasOnlyMemory.current.set(currentIdRef.current, !maximized)
    setCanvasOnly(!maximized)
  }, [apiRef])

  const documentsRemembering = useCallback((id: string) => (
    Object.values(preferencesRef.current.workspace.byDocument).filter((value) => value === id).length
  ), [])

  const fallbackFor = useCallback((id: string) => {
    const fallbackId = fallbackIdFor(id)
    return items.find((item) => item.id === fallbackId) ?? items[0]!
  }, [fallbackIdFor, items])

  /*
   * 两条货架先取**用户改过的那份**（偏好里按工作区存），没有再回到定义自带的。它们与布局快照
   * 并列：都是「我怎么看这个工作区」，都不进文档、不进撤销历史。
   *
   * 种子不走这条——它是新建文档的默认值，没有编辑面。标题在这里就本地化好，面板与 Dockview
   * 标签读同一个值。
   */
  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentId)
  const storedPalette = preferences.workspace.palettes[currentId]
  const storedToolbar = preferences.workspace.toolbars[currentId]
  const palette = useMemo(() => {
    const shelf = storedPalette ?? currentWorkspace?.palette
    if (!shelf || !currentWorkspace) return shelf
    return {
      ...shelf,
      title: shelf.title
        ?? resolveWorkspacePaletteTitle(currentWorkspace, locale, messages.workspace.componentLibrary),
    }
  }, [currentWorkspace, locale, messages, storedPalette])
  const toolbar = storedToolbar ?? currentWorkspace?.toolbar
  const seeds = currentWorkspace?.seeds ?? DEFAULT_WORKSPACE_SEEDS
  const toolsWeight = currentWorkspace?.layout.kind === 'preset'
    ? resolveToolsWeight(currentWorkspace.layout)
    : DEFAULT_TOOLS_WEIGHT

  const switchToPublic = useCallback((id: string) => { switchTo(id) }, [switchTo])
  const next = useCallback(() => { step(1) }, [step])
  const previous = useCallback(() => { step(-1) }, [step])
  const openDialog = useCallback((target: Exclude<ComposeWorkspaceDialog, null>) => { setDialog(target) }, [])
  const closeDialog = useCallback(() => { setDialog(null) }, [])

  // 句柄按内容 memo：动作目录与命令行从它派生，身份每帧都变会让命令注册表每帧重建。
  return useMemo(() => ({
    items,
    currentId: current.id,
    current,
    palette,
    toolbar,
    setToolbarShelf,
    setPaletteShelf,
    seeds,
    toolsWeight,
    canvasOnly,
    dialog,
    switchTo: switchToPublic,
    next,
    previous,
    openDialog,
    closeDialog,
    saveAs,
    rename,
    reset,
    remove,
    toggleCanvasOnly,
    documentsRemembering,
    fallbackFor,
  }), [
    canvasOnly,
    closeDialog,
    current,
    dialog,
    documentsRemembering,
    fallbackFor,
    items,
    next,
    openDialog,
    palette,
    previous,
    remove,
    rename,
    reset,
    saveAs,
    seeds,
    setPaletteShelf,
    setToolbarShelf,
    switchToPublic,
    toggleCanvasOnly,
    toolbar,
    toolsWeight,
  ])
}
