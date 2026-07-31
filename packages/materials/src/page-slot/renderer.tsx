import {
  composeEntitySceneStyle,
  ComposeEntityPaintLayer,
  ComposeRegistryEntityRenderer,
} from '@compose-ui/component-registry'
import type {
  ComposeEntityRegistry,
  ComposeRendererProps,
} from '@compose-ui/component-registry'
import {
  getComposeHierarchy,
  getComposeVisibility,
  readComposePageReference,
  resolveComposePageNestState,
} from '@compose-ui/core'
import type { ComposeDocument, ComposeEntity } from '@compose-ui/core'
import type { ComposeLayoutSnapshot } from '@compose-ui/core'
import { createComposeLayoutRuntime } from '@compose-ui/layout-engine'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { ComposePageSlotNestProvider } from './nest-context'
import { useComposePageSlotNest } from './nest-state'

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly document: ComposeDocument }

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
  mode,
  pageDocumentPort,
  props,
  registry,
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
      pageDocumentPort.load(reference, controller.signal).then((document) => {
        // 引用变化或组件卸载后的迟到结果必须丢弃，否则会渲染上一个引用的内容。
        if (!disposed) setState({ status: 'ready', document })
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
        <button type="button" onClick={retry}>重试</button>
      </div>
    )
  }
  if (state.document.rootIds.length === 0) {
    return <Placeholder testId="compose-page-slot-empty">页面暂无内容</Placeholder>
  }

  return <ResolvedPageContent
    document={state.document}
    mode={mode}
    pageDocumentPort={pageDocumentPort}
    pageKey={pageKey}
    registry={registry}
  />
}

function ResolvedPageContent({
  document,
  mode,
  pageDocumentPort,
  pageKey,
  registry,
}: {
  readonly document: ComposeDocument
  readonly mode: 'editor' | 'preview'
  readonly pageDocumentPort: ComposeRendererProps['pageDocumentPort']
  readonly pageKey: string | undefined
  readonly registry: ComposeEntityRegistry
}) {
  const nest = useComposePageSlotNest()
  const [runtime] = useState(() => createComposeLayoutRuntime({ document }))
  const layoutState = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)
  const currentLayoutState = layoutState.document === document
    ? layoutState
    : { status: 'loading' as const, document }
  const generation = useRef(0)
  useLayoutEffect(() => runtime.updateDocument(document), [document, runtime])
  useEffect(() => {
    generation.current += 1
    const mounted = generation.current
    return () => queueMicrotask(() => {
      if (generation.current === mounted) runtime.dispose()
    })
  }, [runtime])
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
            key={rootId}
            document={document}
            layoutSnapshot={currentLayoutState.snapshot}
            entityId={rootId}
            mode={mode}
            pageDocumentPort={pageDocumentPort}
            registry={registry}
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
  document,
  layoutSnapshot,
  entityId,
  mode,
  pageDocumentPort,
  registry,
}: {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly entityId: string
  readonly mode: 'editor' | 'preview'
  readonly pageDocumentPort: ComposeRendererProps['pageDocumentPort']
  readonly registry: ComposeEntityRegistry
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
      <ComposeEntityPaintLayer entity={entity} />
      <ComposeRegistryEntityRenderer
        entity={entity}
        mode={mode}
        pageDocumentPort={pageDocumentPort}
        registry={registry}
      />
      {hierarchy?.childIds.map((childId) => (
        <NestedEntity
          key={childId}
          document={document}
          layoutSnapshot={layoutSnapshot}
          entityId={childId}
          mode={mode}
          pageDocumentPort={pageDocumentPort}
          registry={registry}
        />
      ))}
    </div>
  )
}
