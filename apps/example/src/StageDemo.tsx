import type {
  ComposeRendererDefinition,
  ComposeRendererProps,
} from '@compose-ui/component-registry'
import {
  BUILTIN_COMMAND_TYPES,
  createDefaultCanvasSettings,
  createComposeFrameEntity,
  createTransactionRuntime,
} from '@compose-ui/core'
import type { ComposeDocument } from '@compose-ui/core'
import {
  ComposeEditor,
  useComposeEditorController,
} from '@compose-ui/editor'
import type { ComposeEditorTransactionEvent, ComposeToolbarItem } from '@compose-ui/editor'
import { createComposeAssetResolver } from '@compose-ui/assets'
import { createComposeComponentStore } from '@compose-ui/component-library'
import {
  createComposeBasicMaterials,
} from '@compose-ui/materials'
import {
  ComposeOperationLogPanel,
  useComposeOperationLog,
} from '@compose-ui/operation-log'
import type { ComposeOperationLogCategory, ComposeOperationLogRecordInput } from '@compose-ui/operation-log'
import { ComposePreviewDialog, ComposePreviewPage } from '@compose-ui/preview'
import type { ComposePreviewHandoff } from '@compose-ui/preview'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ComposeEditorActiveComponentSession,
  ComposeEditorActivePage,
} from '@compose-ui/editor'
import { useComposePageCatalog, useNodeEditorPort } from '@compose-ui/editor'
import {
  createComposeNavigationSession,
  createComposePageLoader,
  createComposePageStore,
} from '@compose-ui/pages'
import { createComposeChartMaterials } from '@compose-ui/chart-materials'
import { createDemoAssetProvider } from './demo-asset-provider'

/** 与 `StageToolbarIcon` 共用同一套 20×20 画幅——它就摆在那条工具栏的末尾。 */
function PreviewIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M2.6 10C4.9 6.2 7.3 4.8 10 4.8s5.1 1.4 7.4 5.2c-2.3 3.8-4.7 5.2-7.4 5.2S4.9 13.8 2.6 10Z" />
      <circle cx="10" cy="10" r="2.3" />
    </svg>
  )
}

const DEMO_FRAME_ID = 'frame-root'

const emptyDocument: ComposeDocument = {
  schemaVersion: 7,
  canvas: createDefaultCanvasSettings(),
  rootIds: [DEMO_FRAME_ID],
  entities: { [DEMO_FRAME_ID]: createComposeFrameEntity({ id: DEMO_FRAME_ID, name: '场景' }) },
}

function ActionButtonRenderer({ props }: ComposeRendererProps) {
  return (
    <button
      className="stage-demo__action-button"
      type="button"
      onClick={typeof props.onClick === 'function'
        ? props.onClick as () => void
        : undefined}
    >
      {typeof props.label === 'string' ? props.label : 'Action'}
    </button>
  )
}

const actionButtonRenderer = {
  type: 'action-button',
  label: 'Action Button',
  renderer: ActionButtonRenderer,
  propContracts: [
    {
      name: 'label',
      kind: 'value',
      label: 'Label',
      category: 'button',
      validate: (value: unknown) => typeof value === 'string' ? true : 'Label must be a string',
      affectsMeasurement: false,
    },
    {
      name: 'onClick',
      kind: 'method',
      label: 'On click',
      category: 'button',
      role: 'event-handler',
    },
  ],
  propCategories: [{ id: 'button', label: '按钮' }],
} satisfies ComposeRendererDefinition

/*
 * 图表来自第一方物料包 `@compose-ui/chart-materials`，示例只负责把它与基础物料组合起来——
 * 这正是宿主该做的事。此前这里自己注册了一个 `echarts-bar`，而示例应用不是产品能力。
 */
const chartMaterials = createComposeChartMaterials()
const basicMaterials = createComposeBasicMaterials({
  extensions: {
    renderers: [...chartMaterials.renderers, actionButtonRenderer],
    presets: [...chartMaterials.presets],
  },
})
const { registry } = basicMaterials

function eventSummary(event: ComposeEditorTransactionEvent) {
  const label = event.transaction?.label ?? 'transaction'
  if (event.direction === 'commit') return label
  if (event.direction === 'undo') return `Undo · ${label}`
  if (event.direction === 'redo') return `Redo · ${label}`
  return `Navigate history · ${event.transactionIds.length} transaction`
    + (event.transactionIds.length === 1 ? '' : 's')
}

function snapshotTargets(document: ComposeDocument, targetIds: readonly string[]) {
  if (targetIds.length === 1) return document.entities[targetIds[0]!] ?? null
  return Object.fromEntries(targetIds.map((id) => [id, document.entities[id] ?? null]))
}

function eventCategory(event: ComposeEditorTransactionEvent): ComposeOperationLogCategory {
  const commandType = event.transaction?.commandType ?? ''
  if (
    commandType.startsWith('entity.renderer.')
    || commandType.startsWith('entity.appearance.')
    || commandType.startsWith('entity.component.')
    || commandType.startsWith('entity.transform.')
    || commandType === 'transaction.batch'
      && event.source === 'inspector'
  ) return 'property'
  if (
    commandType === BUILTIN_COMMAND_TYPES.createEntity
    || commandType === BUILTIN_COMMAND_TYPES.deleteEntity
    || commandType === BUILTIN_COMMAND_TYPES.duplicateEntity
  ) {
    return 'component'
  }
  return 'scene'
}

function targetPath(event: ComposeEditorTransactionEvent, targetId: string) {
  const patch = event.transaction?.forward.find((item) =>
    item.path[0] === 'entities' && item.path[1] === targetId)
  return patch?.path.slice(2)
}

/**
 * 宿主注入的工具栏目录项，演示 `toolbarItems` 这条注入边界。
 *
 * @remarks
 * 它**默认不在任何一条内建货架上**——注入的是「目录里多一项可选的」，不是「工具栏上多一颗
 * 按钮」；用户从「自定义工具栏…」里把它加上去。目标指向一条既有命令，因为宿主自定义命令
 * 眼下没有经 `ComposeEditor` 注入的通路（`ComposeStageProps.commands` 在 Stage 上）；这条
 * 演示要证明的是注入的**目录项**能上架、能按、按下去与敲那个命令名走同一条会话。
 *
 * 常量住在组件外：它一个引用都不捕获，放在组件里每次渲染都会重建，工具栏目录的身份因此每帧
 * 都变。
 */
const DEMO_TOOLBAR_ITEMS: readonly ComposeToolbarItem[] = [
  {
    id: 'demo-circle',
    label: '示例圆',
    icon: (
      <svg aria-hidden="true" height="20" viewBox="0 0 20 20" width="20">
        <circle cx="10" cy="10" fill="none" r="6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    target: { kind: 'command', id: 'CIRCLE' },
  },
]

export function StageDemoWorkspace() {
  const demonstrateComponentFailures = new URLSearchParams(window.location.search)
    .has('component-failure-demo')
  const operationLog = useComposeOperationLog()
  // 页面目录仍在异步读取时，controller 需要一个短暂的 bootstrap runtime；页面模式不会为它
  // 创建中央 Canvas 标签，首页会解析后立即接管。
  const [bootstrapRuntime] = useState(() => createTransactionRuntime({
    document: emptyDocument,
    initialLabel: 'Initial state',
  }))
  /**
   * 当前活动页面；由 Editor 的页面工作区回传。
   *
   * @remarks
   * 宿主拥有 controller，因此「工作区跟随活动页面」由这里换 runtime 实现。首页解析前
   * controller 使用 bootstrap runtime，但页面模式不会将它呈现为可编辑画布。
   */
  const [activePage, setActivePage] = useState<ComposeEditorActivePage | null>(null)
  const [activeComponent, setActiveComponent] = useState<ComposeEditorActiveComponentSession | null>(null)
  const runtime = activeComponent?.runtime ?? activePage?.runtime ?? bootstrapRuntime
  const previousDocument = useRef(runtime.document)
  const observedRuntime = useRef(runtime)
  const lastRecordedCommitId = useRef<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const nextId = useRef(0)
  const idFactory = useCallback(() => `stage-demo-${nextId.current++}`, [])
  useEffect(() => {
    // 换 runtime 表示换文档：操作日志的 diff 基线必须跟着换，否则切页面后的第一笔
    // 事务会与上一份文档做比较。
    if (observedRuntime.current !== runtime) {
      observedRuntime.current = runtime
      previousDocument.current = runtime.document
    }
  }, [runtime])
  const recordTransaction = useCallback((event: ComposeEditorTransactionEvent) => {
    const beforeDocument = previousDocument.current
    const afterDocument = runtime.document
    previousDocument.current = afterDocument
    const transaction = event.transaction
    // runtime 会为同一 mergeKey 保留稳定 transaction ID。连续色盘采样仍需驱动舞台
    // 预览，但不应反复序列化不断增长的 Patch 列表并写入 IndexedDB 操作日志。
    if (event.direction === 'commit' && transaction?.id === lastRecordedCommitId.current) return
    if (event.direction === 'commit') lastRecordedCommitId.current = transaction?.id ?? null
    const input: ComposeOperationLogRecordInput = {
      action: event.direction === 'commit'
        ? transaction?.commandType ?? 'document.commit'
        : `document.${event.direction}`,
      category: eventCategory(event),
      summary: eventSummary(event),
      source: event.source,
      targets: event.targets.map((componentId) => ({
        componentId,
        componentLabel: afterDocument.entities[componentId]?.name
          ?? beforeDocument.entities[componentId]?.name,
        path: targetPath(event, componentId),
      })),
      metadata: {
        commandType: transaction?.commandType,
        direction: event.direction,
        forwardPatches: transaction?.forward,
        inversePatches: transaction?.inverse,
        transactionIds: event.transactionIds,
      },
      ...(event.targets.length > 0 ? {
        before: snapshotTargets(beforeDocument, event.targets),
        after: snapshotTargets(afterDocument, event.targets),
      } : {}),
    }
    return operationLog.record(input, {
      coalesceKey: event.direction === 'commit' && transaction?.mergeKey
        ? `transaction:${transaction.id}`
        : undefined,
    }).then(() => undefined)
  }, [operationLog, runtime])
  /**
   * 页面预览会话开关。
   *
   * @remarks
   * 只影响**示例页面上预置的跳转入口**：首页是编辑器启动时打开的页面，默认往它的内容里
   * 塞东西会污染所有以空白首页为起点的端到端用例。页面预览本身不再需要开关。
   */
  const [navigationDemo] = useState(
    () => new URLSearchParams(window.location.search).has('page-preview'),
  )
  /**
   * 刀闸示例组件与它配套的两个脚本导出，用 `?switch-demo` 打开。
   *
   * 与首页跳转入口同一条判断：项目组件清单与页面脚本返回成员都被既有端到端用例断言，
   * 默认多一份资源会改掉它们。
   */
  const [switchDemo] = useState(
    () => new URLSearchParams(window.location.search).has('switch-demo'),
  )
  /** `?symbols`：把 `apps/example/symbols/` 里那批储能一次接线图元件挂进资源浏览器，用来试 SVG 导入。 */
  const [symbols] = useState(
    () => new URLSearchParams(window.location.search).has('symbols'),
  )
  const [assetProvider] = useState(
    () => createDemoAssetProvider({ navigationDemo, switchDemo, symbols }),
  )
  const [providerOffline, setProviderOffline] = useState(false)
  const [componentStore] = useState(() => createComposeComponentStore({ provider: assetProvider }))
  /**
   * 宿主同时拥有页面 Store 与 controller。
   *
   * @remarks
   * node 属性的候选来自页面目录，而 controller 由宿主创建，因此 Store 也放在宿主侧，
   * 再通过 pages.store 交给 Editor 复用同一份缓存。
   */
  const [pageStore] = useState(() => createComposePageStore({ provider: assetProvider }))
  const pageCatalog = useComposePageCatalog(pageStore)
  const pageLoader = useMemo(() => createComposePageLoader(pageStore), [pageStore])
  const nodeEditPort = useNodeEditorPort({
    catalog: pageCatalog,
    providerId: assetProvider.id,
  })
  const [navigationSession] = useState(() => createComposeNavigationSession({
    loader: createComposePageLoader(pageStore),
    providerId: assetProvider.id,
  }))
  useEffect(() => {
    navigationSession.setHomePageKey(pageCatalog?.homePageKey ?? null)
  }, [navigationSession, pageCatalog?.homePageKey])
  const controller = useComposeEditorController({
    runtime,
    registry,
    idFactory,
    nodeEditPort,
    componentStore,
    // 演示宿主关掉首次自动适配的取向：视觉回归与端到端需要确定性取景，否则每个用例的
    // 屏幕坐标都要跟着可视区域尺寸走。默认（不带该参数）仍是自动适配激活场景。
    autoFitActiveFrame: !new URLSearchParams(window.location.search).has('no-auto-fit'),
    scriptScope: activePage?.scriptScope,
    onTransaction: recordTransaction,
  })
  const assetResolver = useMemo(
    () => createComposeAssetResolver(assetProvider),
    [assetProvider],
  )
  const pagesConfig = useMemo(
    () => ({ store: pageStore, onActiveSessionChange: setActivePage }),
    [pageStore],
  )
  const componentsConfig = useMemo(
    () => ({ store: componentStore, onActiveSessionChange: setActiveComponent }),
    [componentStore],
  )
  // 预览目标只有场景一种。默认取页面的激活场景；标签上的播放按钮可以直接指定另一块，
  // 用户在对话框的场景选择器里也能改。
  const [previewFrameId, setPreviewFrameId] = useState<string | null>(null)
  /*
   * 整屏形态是**同一个标签页里的一次路由**，编辑器不卸载——既有硬规则要求页面预览包含尚未
   * 保存的改动，而卸载了就没有 live 文档可给。因此它只是宿主的一个会话状态，配一条
   * `history` 记录让浏览器返回键也能退出。
   */
  const [previewForm, setPreviewForm] = useState<'dialog' | 'page'>('dialog')
  // 两个形态之间交接的场景、屏幕尺寸与播放头；预览自己不跨形态记忆它们。
  const [previewHandoff, setPreviewHandoff] = useState<ComposePreviewHandoff | undefined>(undefined)
  /*
   * **画布上现在是哪一份文档，只有一个答案。**
   *
   * 页面会话与组件会话互不相干，打开组件不会清掉页面会话；`runtime` 早就按
   * 「组件优先」算过这个答案，只是没有用在预览上。不这么做的症状是：打开组件再按预览，
   * 看到的是上一个页面——页面模式一旦成立就会完全取代传入的 `document`。
   */
  const previewingComponent = activeComponent !== null
  const activeFrameId = (previewingComponent ? undefined : activePage?.page.activeFrameId)
    ?? controller.document.rootIds[0]
    ?? null
  const previewTargetFrameId = previewFrameId ?? activeFrameId
  /**
   * 页面预览的 live 页面。
   *
   * @remarks
   * `activePage.page` 是上次保存的聚合；文档的事实来源是 controller，因此这里现拼一份，
   * 使预览包含尚未保存的改动。没有打开任何页面时不进入页面预览——那时画布上的文档不属于
   * 任何页面，导航没有起点。
   */
  const livePage = activePage && !previewingComponent
    ? { pageKey: activePage.pageKey, page: { ...activePage.page, document: controller.document } }
    : undefined
  useEffect(() => {
    // 每次打开预览都把会话对齐到正在编辑的页面：从首页起步会让用户看到的不是自己刚改的那页。
    if (previewOpen) navigationSession.reset(activePage?.pageKey ?? null)
  }, [activePage?.pageKey, navigationSession, previewOpen])

  /*
   * 浏览器返回键退出整屏。进入时 push 一条记录，退出时按来源分流：返回键触发的那次
   * 记录已经弹掉了，再 `back()` 一次会退到编辑器之前的历史里去。
   */
  useEffect(() => {
    if (previewForm !== 'page') return undefined
    const handlePopState = () => { setPreviewForm('dialog') }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [previewForm])

  const enterPreviewPage = (state: ComposePreviewHandoff) => {
    setPreviewHandoff(state)
    setPreviewOpen(false)
    setPreviewForm('page')
    window.history.pushState({ composePreview: 'page' }, '', `${window.location.pathname}${window.location.search}#preview`)
  }
  const exitPreviewPage = () => {
    // 交回弹框：场景、屏幕尺寸与播放头原样传回去，用户回到切换之前的那一刻。
    setPreviewForm('dialog')
    setPreviewOpen(true)
    if (window.location.hash === '#preview') window.history.back()
  }

  /*
   * **示例应用不提供「在新标签页打开」。**
   *
   * 它的资源 Provider 是内存实现（`demo-memory`），新标签页拿到的是一份重新播种的空白
   * 会话，看不见刚落盘的任何东西。在这里接上那颗按钮等于给一颗必然显示错内容的控件，
   * 而「不静默地给出旧内容」正是这条契约的全部要求。`ComposePreviewDialog` 的
   * `secondaryActions` 插槽本身已经就位，有持久化 Provider 的宿主接上它即可。
   */

  return (
    <>
      <ComposeEditor
        className="editor-workspace"
        toolbarItems={DEMO_TOOLBAR_ITEMS}
        assets={{
          browser: { provider: assetProvider },
          resolver: assetResolver,
        }}
        controller={controller}
        components={componentsConfig}
        pages={pagesConfig}
        onScenePreview={(frameId) => {
          setPreviewFrameId(frameId)
          setPreviewOpen(true)
        }}
        slots={{
          stageToolbar: (
            <>
              {controller.stageToolbar}
              <button
                className="stage-demo__preview-button"
                aria-label="打开预览"
                title="打开预览"
                type="button"
                onClick={() => {
                  setPreviewFrameId(null)
                  setPreviewOpen(true)
                }}
              >
                <PreviewIcon />
              </button>
            </>
          ),
          transactionLog: <ComposeOperationLogPanel />,
        }}
      />
      <ComposePreviewDialog
        assetResolver={assetResolver}
        selectedFrameId={previewTargetFrameId}
        dialogLabel="文档预览对话框"
        document={controller.document}
        page={activePage?.page}
        messages={{
          title: '预览',
          target: '预览场景',
          screenSize: '屏幕尺寸',
          targetSizeGroupScene: '场景尺寸',
          targetSizeGroupComponent: '组件尺寸',
          commonScreensGroupScene: '常见屏幕',
          commonScreensGroupComponent: '摆进这么大的屏里看',
          customSizeName: '自定义',
          screenWidth: '屏幕宽度',
          screenHeight: '屏幕高度',
          swapOrientation: '横竖互换',
          resizeScreen: '拖动改屏幕尺寸',
          zoomIn: '放大',
          zoomOut: '缩小',
          fitToWindow: '适应窗口',
          zoomLevel: '当前缩放',
          screenMapping: '屏幕与目标尺寸',
          enterFullscreen: '全屏预览',
          exitFullscreen: '退出全屏预览',
          enterFullscreenForm: '整屏预览',
          close: '关闭预览',
          closeHint: '按 Esc 关闭预览',
        }}
        livePage={livePage}
        navigation={livePage ? navigationSession : undefined}
        open={previewOpen}
        pageLoader={pageLoader}
        targetKind={previewingComponent ? 'component' : 'scene'}
        registry={registry}
        initialState={previewHandoff}
        onOpenChange={setPreviewOpen}
        onRequestFullscreenForm={enterPreviewPage}
      />
      {previewForm === 'page' ? (
        <ComposePreviewPage
          assetResolver={assetResolver}
          document={controller.document}
          initialState={previewHandoff}
          livePage={livePage}
          messages={{
            label: '整屏预览',
            exit: '返回编辑器',
            toolbar: '预览控制条',
            target: '预览场景',
            screenSize: '屏幕尺寸',
            actualScreen: '实际屏幕',
            commonScreensGroup: '常见屏幕',
            customSizeName: '自定义',
            swapOrientation: '横竖互换',
            enterFullscreen: '全屏',
            exitFullscreen: '退出全屏',
            screenMapping: '当前屏幕',
          }}
          navigation={livePage ? navigationSession : undefined}
          page={activePage?.page}
          pageLoader={pageLoader}
          registry={registry}
          selectedFrameId={previewTargetFrameId}
          targetKind={previewingComponent ? 'component' : 'scene'}
          onRequestExit={exitPreviewPage}
        />
      ) : null}
      {demonstrateComponentFailures ? (
        <section aria-label="组件容错演示" className="stage-demo__failure-controls">
          <strong>组件容错演示</strong>
          <button
            disabled={!activeComponent || providerOffline}
            type="button"
            onClick={() => {
              if (activeComponent) assetProvider.demo.bumpRevision(activeComponent.assetKey)
            }}
          >
            模拟组件源 revision 更新
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !providerOffline
              assetProvider.demo.setOffline(next)
              setProviderOffline(next)
            }}
          >
            {providerOffline ? '恢复 Provider 在线' : '模拟 Provider 离线'}
          </button>
          <span role="status">{providerOffline ? 'Provider 离线' : 'Provider 在线'}</span>
        </section>
      ) : null}
    </>
  )
}
