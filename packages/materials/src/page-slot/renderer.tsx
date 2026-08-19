import {
  createComposeRendererMeasurementAdapter,
  composeEntitySceneStyle,
  ComposeEntityPaintLayer,
  ComposeRegistryEntityRenderer,
  useComposePageScriptScope,
  type ComposeRendererMeasurementAdapter,
} from '@compose-ui/component-registry'
import type {
  ComposeEntityRegistry,
  ComposeRendererProps,
} from '@compose-ui/component-registry'
import {
  getComposeHierarchy,
  resolveComposeRenderedChildIds,
  getComposeVisibility,
  readComposePageReference,
  resolveComposePageActiveFrameId,
  resolveComposePageNestState,
} from '@compose-ui/core'
import type { ComposeDocument, ComposeEntity, ComposePageFile } from '@compose-ui/core'
import type { ComposeLayoutSnapshot } from '@compose-ui/core'
import { createComposeLayoutRuntime } from '@compose-ui/layout-engine'
import type { ComposePageScriptScope } from '@compose-ui/script-runtime'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { ComposePageSlotNestProvider } from './nest-context'
import { useComposePageSlotNest } from './nest-state'

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly page: ComposePageFile }

function Placeholder({ children, testId }: {
  readonly children: string
  readonly testId: string
}) {
  return (
    <div className="compose-material compose-material--page-slot-status" data-testid={testId}>
      {children}
    </div>
  )
}

function Alert({ children, testId }: {
  readonly children: string
  readonly testId: string
}) {
  return (
    <div
      className="compose-material compose-material--page-slot-status"
      data-testid={testId}
      role="alert"
    >
      {children}
    </div>
  )
}

/**
 * 渲染被引用页面内容的 Page Slot。
 *
 * @remarks
 * 嵌套渲染由物料自己完成：Stage 与 Preview 都只注入 `pageDocumentPort`，因此两端渲染结果
 * 一致且各自不需要实现一套加载状态机。编辑模式下嵌套内容整体不接收指针事件 —— 命中测试
 * 必须落在 Page Slot 实体本身。
 * @internal
 */
export function PageSlotRenderer({
  assetResolver,
  mode,
  pageDocumentPort,
  props,
  registry,
  scriptModuleLoader,
}: ComposeRendererProps) {
  const nest = useComposePageSlotNest()
  const reference = readComposePageReference(props.page)
  const pageKey = reference?.assetKey
  const nestState = reference
    ? resolveComposePageNestState({
        pageKey: reference.assetKey,
        ancestorPageKeys: nest.ancestorPageKeys,
      })
    : 'ok'
  const canLoad = reference !== null
    && pageDocumentPort !== undefined
    && nestState === 'ok'
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    if (!canLoad || !reference || !pageDocumentPort) return
    const controller = new AbortController()
    let disposed = false
    const load = () => {
      setState({ status: 'loading' })
      pageDocumentPort.load(reference, controller.signal).then((page) => {
        // 引用变化或组件卸载后的迟到结果必须丢弃，否则会渲染上一个引用的内容。
        if (!disposed) setState({ status: 'ready', page })
      }).catch((error: unknown) => {
        if (disposed) return
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : '页面加载失败',
        })
      })
    }
    load()
    const unsubscribe = pageDocumentPort.subscribe?.(reference, load)
    return () => {
      disposed = true
      controller.abort()
      unsubscribe?.()
    }
    // pageKey 而不是 reference 对象参与依赖：引用是每次渲染新建的扁平映射。
  }, [canLoad, pageKey, pageDocumentPort, retryToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const retry = useCallback(() => { setRetryToken((current) => current + 1) }, [])

  if (nestState === 'cycle') {
    return <Alert testId="compose-page-slot-cycle">页面循环引用</Alert>
  }
  if (nestState === 'depth-exceeded') {
    return <Alert testId="compose-page-slot-depth">页面嵌套层级过深</Alert>
  }
  if (!canLoad) {
    return <Placeholder testId="compose-page-slot-placeholder">未指向任何页面</Placeholder>
  }
  if (state.status === 'loading') {
    return (
      <div
        aria-busy="true"
        className="compose-material compose-material--page-slot-status"
        data-testid="compose-page-slot-loading"
      >
        载入页面…
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div
        className="compose-material compose-material--page-slot-status"
        data-testid="compose-page-slot-error"
        role="alert"
      >
        <span>{state.message}</span>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={retry}
        >
          重试
        </button>
      </div>
    )
  }
  // v7 的空白页面自带一个空的根 Frame：判空要看那块画板里有没有内容，而不是 rootIds。
  const slotFrameId = resolveComposePageActiveFrameId(state.page)
  const slotFrame = slotFrameId ? state.page.document.entities[slotFrameId] : undefined
  if (!slotFrame || (getComposeHierarchy(slotFrame)?.childIds.length ?? 0) === 0) {
    return <Placeholder testId="compose-page-slot-empty">页面暂无内容</Placeholder>
  }

  return <ResolvedPageContent
    assetResolver={assetResolver}
    page={state.page}
    mode={mode}
    pageDocumentPort={pageDocumentPort}
    pageKey={pageKey}
    registry={registry}
    scriptModuleLoader={scriptModuleLoader}
  />
}

function ResolvedPageContent({
  assetResolver,
  page,
  mode,
  pageDocumentPort,
  pageKey,
  registry,
  scriptModuleLoader,
}: {
  readonly assetResolver: ComposeRendererProps['assetResolver']
  readonly page: ComposePageFile
  readonly mode: 'editor' | 'preview'
  readonly pageDocumentPort: ComposeRendererProps['pageDocumentPort']
  readonly pageKey: string | undefined
  readonly registry: ComposeEntityRegistry
  readonly scriptModuleLoader: ComposeRendererProps['scriptModuleLoader']
}) {
  const document = page.document
  const nest = useComposePageSlotNest()
  const scriptScope = useComposePageScriptScope({ page, assetResolver, scriptModuleLoader })
  const [runtime] = useState(() => createComposeLayoutRuntime({ document }))
  const adapter = useMemo(() => createComposeRendererMeasurementAdapter({
    registry,
    assetResolver,
    pageDocumentPort,
    scriptScope,
  }), [assetResolver, pageDocumentPort, registry, scriptScope])
  const layoutState = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)
  const currentLayoutState = layoutState.document === document
    ? layoutState
    : { status: 'loading' as const, document }
  const generation = useRef(0)
  const adapterGenerations = useRef(new WeakMap<ComposeRendererMeasurementAdapter, number>())
  useLayoutEffect(() => {
    adapter.updateDocument(document)
    runtime.setMeasurementPort(adapter)
    runtime.updateDocument(document)
    return () => runtime.setMeasurementPort(undefined)
  }, [adapter, document, runtime])
  useEffect(() => {
    generation.current += 1
    const mounted = generation.current
    return () => queueMicrotask(() => {
      if (generation.current === mounted) runtime.dispose()
    })
  }, [runtime])
  useEffect(() => {
    const generations = adapterGenerations.current
    const mounted = (generations.get(adapter) ?? 0) + 1
    generations.set(adapter, mounted)
    return () => queueMicrotask(() => {
      if (generations.get(adapter) !== mounted) return
      adapter.dispose()
      generations.delete(adapter)
    })
  }, [adapter])
  if (currentLayoutState.status === 'loading') {
    return <Placeholder testId="compose-page-slot-layout-loading">载入页面布局…</Placeholder>
  }
  if (currentLayoutState.status === 'error') {
    return <Alert testId="compose-page-slot-layout-error">页面布局失败</Alert>
  }

  return (
    <ComposePageSlotNestProvider
      ancestorPageKeys={pageKey === undefined
        ? nest.ancestorPageKeys
        : [...nest.ancestorPageKeys, pageKey]}
      depth={nest.depth + 1}
    >
      <div
        className="compose-material compose-material--page-slot"
        data-testid="compose-page-slot-content"
        style={{
          // 尺寸内联给定而不依赖样式表加载顺序：嵌套实体是绝对定位的，容器一旦塌陷成
          // 零高度，用户就什么都看不到。
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          // 编辑态嵌套内容不参与命中测试：选择与框选必须落在 Page Slot 实体本身。
          ...(mode === 'editor' ? { pointerEvents: 'none' as const } : {}),
        }}
      >
        {document.rootIds.map((rootId) => (
          <NestedEntity
            assetResolver={assetResolver}
            key={rootId}
            document={document}
            layoutSnapshot={currentLayoutState.snapshot}
            entityId={rootId}
            mode={mode}
            pageDocumentPort={pageDocumentPort}
            registry={registry}
            scriptModuleLoader={scriptModuleLoader}
            scriptScope={scriptScope}
          />
        ))}
      </div>
    </ComposePageSlotNestProvider>
  )
}

/**
 * 渲染被引用页面中的一个实体及其子树。
 *
 * @remarks
 * 结构与 Preview 的实体渲染保持一致：外层 div 承载实体的绝对定位与几何，内部依次是 Paint
 * 层、Renderer 内容与 `Hierarchy` 子节点。缺少定位包装时所有实体会堆在原点且没有尺寸，
 * 缺少递归时容器内容会整体丢失。
 */
function NestedEntity({
  assetResolver,
  document,
  layoutSnapshot,
  entityId,
  mode,
  pageDocumentPort,
  registry,
  scriptModuleLoader,
  scriptScope,
}: {
  readonly assetResolver: ComposeRendererProps['assetResolver']
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly entityId: string
  readonly mode: 'editor' | 'preview'
  readonly pageDocumentPort: ComposeRendererProps['pageDocumentPort']
  readonly registry: ComposeEntityRegistry
  readonly scriptModuleLoader: ComposeRendererProps['scriptModuleLoader']
  readonly scriptScope: ComposePageScriptScope | undefined
}) {
  const entity: ComposeEntity | undefined = document.entities[entityId]
  if (!entity || !getComposeVisibility(entity).visible) return null
  const hierarchy = getComposeHierarchy(entity)
  const box = layoutSnapshot.boxes[entityId]
  if (!box) return null
  return (
    <div
      data-page-slot-entity-id={entity.id}
      style={{ ...composeEntitySceneStyle(entity, box), position: 'absolute' }}
    >
      <ComposeEntityPaintLayer assetResolver={assetResolver} entity={entity} />
      <ComposeRegistryEntityRenderer
        assetResolver={assetResolver}
        entity={entity}
        mode={mode}
        pageDocumentPort={pageDocumentPort}
        registry={registry}
        scriptModuleLoader={scriptModuleLoader}
        scriptScope={scriptScope}
      />
      {(hierarchy ? resolveComposeRenderedChildIds(document, entity.id) : []).map((childId) => (
        <NestedEntity
          assetResolver={assetResolver}
          key={childId}
          document={document}
          layoutSnapshot={layoutSnapshot}
          entityId={childId}
          mode={mode}
          pageDocumentPort={pageDocumentPort}
          registry={registry}
          scriptModuleLoader={scriptModuleLoader}
          scriptScope={scriptScope}
        />
      ))}
    </div>
  )
}

