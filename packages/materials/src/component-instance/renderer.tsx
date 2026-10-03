import {
  composeEntityOverflowStyle,
  composeEntitySceneStyle,
  ComposeEntityPaintLayer,
  ComposeRegistryEntityRenderer,
  createComposeRendererMeasurementAdapter,
  type ComposeEntityRegistry,
  type ComposeRendererMeasurementAdapter,
  type ComposeRendererProps,
} from '@compose-ui/component-registry'
import {
  getComposeHierarchy,
  getComposeVisibility,
  resolveComposeRenderedChildIds,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import { createComposeLayoutRuntime } from '@compose-ui/layout-engine'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  ComposeComponentInstanceNestProvider,
} from './nest-context'
import { componentInstanceContentScale } from './content-fit'
import {
  prepareComposeComponentInstance,
  type ComposePreparedComponentInstance,
} from './prepare'
import { useComposeComponentInstanceNest } from './nest-state'

function Status({ children, testId, alert = false }: {
  readonly children: string
  readonly testId: string
  readonly alert?: boolean
}) {
  return (
    <div
      className="compose-material compose-material--component-instance-status"
      data-testid={testId}
      role={alert ? 'alert' : 'status'}
    >
      {children}
    </div>
  )
}

/** 使用实例内保存的有效快照渲染关联组件。 @internal */
export function ComponentInstanceRenderer({
  assetResolver,
  mode,
  props,
  registry,
  scriptModuleLoader,
}: ComposeRendererProps) {
  const nest = useComposeComponentInstanceNest()
  /*
   * 准备管线与 QML 导出共用（`prepareComposeComponentInstance`）。盒尺寸在这里未知——
   * `'scale'` 的比值由内容层量自己的 DOM 之后用同一个比值函数求出。
   *
   * PERF：按准备管线实际读取的各个 prop 记忆。播放头一变就产生新的嵌套文档引用，这个实例的
   * Yoga 树因此重解一次——成本形状与页面级动画相同；与之无关的重渲染不触发重解。
   */
  const prepared = useMemo(
    () => prepareComposeComponentInstance({
      props,
      hostBox: null,
      ancestorKeys: nest.ancestorKeys,
      depth: nest.depth,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只依赖准备管线实际读取的 prop，而不是每次渲染都可能换引用的 props 对象
    [
      nest.ancestorKeys,
      nest.depth,
      props.reference,
      props.resolvedSnapshot,
      props.instanceOverrides,
      props.propertyOverrides,
      props.animation,
      props.animationTime,
      props.contentFit,
      props.flip,
    ],
  )
  if (!prepared.ok) {
    switch (prepared.reason) {
      case 'cycle':
        return <Status testId="compose-component-instance-cycle" alert>组件循环引用</Status>
      case 'too-deep':
        return <Status testId="compose-component-instance-depth" alert>组件嵌套层级过深</Status>
      case 'invalid-overrides':
        return <Status testId="compose-component-instance-invalid" alert>组件实例覆盖无效</Status>
      default:
        return <Status testId="compose-component-instance-invalid" alert>组件快照无效</Status>
    }
  }
  return (
    <ResolvedComponentContent
      assetResolver={assetResolver}
      mode={mode}
      prepared={prepared}
      registry={registry}
      scriptModuleLoader={scriptModuleLoader}
    />
  )
}

function ResolvedComponentContent({
  assetResolver,
  mode,
  prepared,
  registry,
  scriptModuleLoader,
}: {
  readonly assetResolver: ComposeRendererProps['assetResolver']
  readonly mode: 'editor' | 'preview'
  readonly prepared: Extract<ComposePreparedComponentInstance, { readonly ok: true }>
  readonly registry: ComposeEntityRegistry
  readonly scriptModuleLoader: ComposeRendererProps['scriptModuleLoader']
}) {
  const nest = useComposeComponentInstanceNest()
  const { contentFit, flipScale, key: ancestorKey, rootSize: rootFrameSize } = prepared
  const layoutDocument = prepared.document
  const [runtime] = useState(() => createComposeLayoutRuntime({ document: layoutDocument }))
  const adapter = useMemo(() => createComposeRendererMeasurementAdapter({
    registry,
    assetResolver,
    }), [assetResolver, registry])
  const state = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)
  const currentState = state.document === layoutDocument
    ? state
    : { status: 'loading' as const, document: layoutDocument }
  const runtimeGeneration = useRef(0)
  const adapterGenerations = useRef(new WeakMap<ComposeRendererMeasurementAdapter, number>())

  useLayoutEffect(() => {
    adapter.updateDocument(layoutDocument)
    runtime.setMeasurementPort(adapter)
    runtime.updateDocument(layoutDocument)
    return () => runtime.setMeasurementPort(undefined)
  }, [adapter, layoutDocument, runtime])
  useEffect(() => {
    runtimeGeneration.current += 1
    const mounted = runtimeGeneration.current
    return () => queueMicrotask(() => {
      if (runtimeGeneration.current === mounted) runtime.dispose()
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

  /*
   * `'scale'` 需要宿主盒的尺寸求比值，而 Renderer 拿不到宿主文档的布局快照——量自己的 DOM。
   * 读 `getComputedStyle` 而不是 `getBoundingClientRect`：后者含祖先 transform（画布 zoom），
   * 比值会把 zoom 乘进去、内容被双重缩放；ResizeObserver 上报的同样是未变换的布局盒。
   * useLayoutEffect 在绘制之前跑完，首帧因此不会闪一下未缩放的内容。
   */
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [hostBox, setHostBox] = useState<
    { readonly width: number; readonly height: number } | null
  >(null)
  useLayoutEffect(() => {
    if (contentFit !== 'scale') return
    const element = hostRef.current
    if (!element) return
    const read = () => {
      const style = getComputedStyle(element)
      const width = Number.parseFloat(style.width)
      const height = Number.parseFloat(style.height)
      // jsdom 没有布局，量出来是 NaN——保持 null，比值回退 1，画未缩放的内容。
      if (!Number.isFinite(width) || !Number.isFinite(height)) return
      setHostBox((previous) => (
        previous && previous.width === width && previous.height === height
          ? previous
          : { width, height }
      ))
    }
    read()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(read)
    observer.observe(element)
    return () => observer.disconnect()
    // 内容 div 只在 ready 分支渲染：状态翻到 ready 时 ref 才有值，effect 必须重跑一次。
  }, [contentFit, currentState.status])

  if (currentState.status === 'loading') {
    return <Status testId="compose-component-instance-loading">载入组件布局…</Status>
  }
  if (currentState.status === 'error') {
    return <Status testId="compose-component-instance-layout-error" alert>组件布局失败</Status>
  }
  const roots = layoutDocument.rootIds.map((rootId) => (
    <NestedEntity
      assetResolver={assetResolver}
      document={layoutDocument}
      entityId={rootId}
      key={rootId}
      layoutSnapshot={currentState.snapshot}
      mode={mode}
      registry={registry}
      scriptModuleLoader={scriptModuleLoader}
    />
  ))
  const scale = componentInstanceContentScale(hostBox, rootFrameSize)
  return (
    <ComposeComponentInstanceNestProvider
      ancestorKeys={[...nest.ancestorKeys, ancestorKey]}
      depth={nest.depth + 1}
    >
      <div
        className="compose-material compose-material--component-instance"
        data-testid="compose-component-instance-content"
        ref={hostRef}
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          ...(mode === 'editor' ? { pointerEvents: 'none' as const } : {}),
          /*
           * 翻转绕**实例盒的中心**发生，不读 `Transform.pivot`：那个字段回答的是「绕哪一点
           * 旋转」，借给翻转会让改过基点的用户看到图形整个跳走。
           *
           * 下钻选中与命中走 DOM 测量（`getBoundingClientRect` 如实反映 transform），
           * 因此翻转对它们透明——与内容适配的整体缩放是同一条。
           */
          ...(flipScale.x === 1 && flipScale.y === 1
            ? {}
            : {
                transform: `scale(${flipScale.x}, ${flipScale.y})`,
                transformOrigin: 'center',
              }),
        }}
      >
        {contentFit === 'scale' && rootFrameSize
          ? (
            /*
             * 嵌套内容按组件根的自然尺寸摆放，整体乘一个比值。下钻选中与命中走 DOM 测量
             * （`getBoundingClientRect` 如实反映 transform），因此对它们零改动。
             */
            <div
              data-testid="compose-component-instance-scale"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: rootFrameSize.width,
                height: rootFrameSize.height,
                transform: `scale(${scale.x}, ${scale.y})`,
                transformOrigin: '0 0',
              }}
            >
              {roots}
            </div>
          )
          : roots}
      </div>
    </ComposeComponentInstanceNestProvider>
  )
}

function NestedEntity({
  assetResolver,
  document,
  entityId,
  layoutSnapshot,
  mode,
  registry,
  scriptModuleLoader,
}: {
  readonly assetResolver: ComposeRendererProps['assetResolver']
  readonly document: ComposeDocument
  readonly entityId: string
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly mode: 'editor' | 'preview'
  readonly registry: ComposeEntityRegistry
  readonly scriptModuleLoader: ComposeRendererProps['scriptModuleLoader']
}) {
  const entity: ComposeEntity | undefined = document.entities[entityId]
  if (!entity || !getComposeVisibility(entity).visible) return null
  const box = layoutSnapshot.boxes[entityId]
  if (!box) return null
  const hierarchy = getComposeHierarchy(entity)
  return (
    <div
      data-component-instance-entity-id={entity.id}
      style={{
        ...composeEntitySceneStyle(entity, box),
        ...composeEntityOverflowStyle(entity),
        position: 'absolute',
      }}
    >
      <ComposeEntityPaintLayer assetResolver={assetResolver} entity={entity} />
      <ComposeRegistryEntityRenderer
        assetResolver={assetResolver}
        entity={entity}
        mode={mode}
          registry={registry}
        scriptModuleLoader={scriptModuleLoader}
      />
      {(hierarchy ? resolveComposeRenderedChildIds(document, entity.id) : []).map((childId) => (
        <NestedEntity
          assetResolver={assetResolver}
          document={document}
          entityId={childId}
          key={childId}
          layoutSnapshot={layoutSnapshot}
          mode={mode}
              registry={registry}
          scriptModuleLoader={scriptModuleLoader}
        />
      ))}
    </div>
  )
}
