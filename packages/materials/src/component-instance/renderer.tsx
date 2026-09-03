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
  COMPOSE_COMPONENT_NEST_DEPTH_LIMIT,
  getComposeHierarchy,
  getComposeFrame,
  getComposeLayoutItem,
  getComposeVisibility,
  migrateLegacyComposeInstanceOverrides,
  parseComposeInstanceOverrides,
  resolveComposeInstanceOverrides,
  resolveComposeRenderedChildIds,
  validateComposeDocument,
  type ComposeComponentInstanceOverrides,
  type ComposeComponentReference,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
  type ComposeResolvedComponentSnapshot,
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
import { sampleComponentInstanceDocument } from './animation'
import {
  componentInstanceContentScale,
  readComponentInstanceContentFit,
  type ComponentInstanceContentFit,
} from './content-fit'
import { useComposeComponentInstanceNest } from './nest-state'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readReference(value: unknown): ComposeComponentReference | null {
  if (!isRecord(value)) return null
  return value.kind === 'component'
    && typeof value.providerId === 'string'
    && typeof value.assetKey === 'string'
    && (value.scope === 'persistent' || value.scope === 'session')
    ? value as ComposeComponentReference
    : null
}

function readSnapshot(value: unknown): ComposeResolvedComponentSnapshot | null {
  if (!isRecord(value) || !isRecord(value.document)) return null
  const validation = validateComposeDocument(value.document)
  if (!validation.valid) return null
  // 组件根允许是任意 Entity；只有「单根」是硬约束。
  if (
    validation.document.rootIds.length !== 1
    || !validation.document.rootIds[0]
    || typeof value.componentId !== 'string'
    || (value.kind !== 'base' && value.kind !== 'variant')
    || typeof value.revision !== 'string'
    || !Array.isArray(value.appliedLineage)
  ) return null
  return {
    componentId: value.componentId,
    kind: value.kind,
    revision: value.revision,
    document: validation.document,
    appliedLineage: value.appliedLineage as ComposeResolvedComponentSnapshot['appliedLineage'],
  }
}

/**
 * 读取实例覆盖，兼容尚未落盘为分区形状的历史实体。
 *
 * @remarks
 * 缺少 `instanceOverrides` 时对旧 `propertyOverrides` 走显式迁移；仍带 `properties` 分区的历史
 * 数据同样迁移，但属性覆盖需要已删除的 Base 定义才能还原目标，只能保留结构分区。
 */
function readInstanceOverrides(props: ComposeRendererProps['props']): ComposeComponentInstanceOverrides | null {
  const raw = props.instanceOverrides
  if (raw === undefined) {
    const legacy = props.propertyOverrides
    if (!isRecord(legacy)) return null
    return migrateLegacyComposeInstanceOverrides(legacy)
  }
  const parsed = parseComposeInstanceOverrides(raw)
  if (parsed.ok) return parsed.overrides
  return isRecord(raw) && 'properties' in raw ? migrateLegacyComposeInstanceOverrides(raw) : null
}

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
  const reference = readReference(props.reference)
  const snapshot = readSnapshot(props.resolvedSnapshot)
  const overrides = readInstanceOverrides(props)
  if (!reference || !snapshot || !overrides) {
    return <Status testId="compose-component-instance-invalid" alert>组件快照无效</Status>
  }
  const key = `${reference.providerId}:${reference.scope}:${reference.assetKey}`
  if (key && nest.ancestorKeys.includes(key)) {
    return <Status testId="compose-component-instance-cycle" alert>组件循环引用</Status>
  }
  if (nest.depth >= COMPOSE_COMPONENT_NEST_DEPTH_LIMIT) {
    return <Status testId="compose-component-instance-depth" alert>组件嵌套层级过深</Status>
  }
  const resolved = resolveComposeInstanceOverrides({
    document: snapshot.document,
    overrides,
  })
  if (!resolved.ok) {
    return <Status testId="compose-component-instance-invalid" alert>组件实例覆盖无效</Status>
  }
  const document = resolved.document
  return (
    <ResolvedComponentContent
      ancestorKey={key}
      animationId={props.animation}
      animationTime={props.animationTime}
      assetResolver={assetResolver}
      contentFit={readComponentInstanceContentFit(props)}
      document={document}
      mode={mode}
      registry={registry}
      scriptModuleLoader={scriptModuleLoader}
    />
  )
}

/**
 * 嵌套 Layout Runtime 的 Yoga 画布尺寸取自 `document.output`。
 * 实例 Resize 会把组件根写成 fixed，但 output 仍可能是创建时的旧值；
 * 对单根组件文档，把根 Frame 的尺寸与根 fixed LayoutItem 对齐，Auto Layout 的 fill 子项
 * 才能随外框重排。
 *
 * @remarks
 * Frame.size 是尺寸的唯一事实来源；实例覆盖改写的是根的 LayoutItem，因此这里把两者对齐，
 * 而不是维护第二份尺寸。
 */
function alignComponentDocumentOutput(document: ComposeDocument): ComposeDocument {
  const rootId = document.rootIds[0]
  if (!rootId || document.rootIds.length !== 1) return document
  const root = document.entities[rootId]
  const frame = getComposeFrame(root)
  if (!root || !frame) return document
  const item = getComposeLayoutItem(root)
  const width = item.width.mode === 'fixed' ? item.width.value : frame.size.width
  const height = item.height.mode === 'fixed' ? item.height.value : frame.size.height
  if (width === frame.size.width && height === frame.size.height) return document
  return {
    ...document,
    entities: {
      ...document.entities,
      [rootId]: {
        ...root,
        components: {
          ...root.components,
          Frame: { ...frame, size: { width, height } },
        },
      },
    },
  }
}

/**
 * 把组件根锚到原点。
 *
 * @remarks
 * 根的 `LayoutItem.offset` 是「场景摆在组件文档工作区的哪里」——那是宿主编辑视图的摆位，
 * 不是内容；Frame 的「坐标原点」隔离边界意味着实例必须从 (0,0) 取景。不锚的话，在组件
 * 文档里挪过一次场景，保存后所有实例的内容整体平移一段并被盒裁掉——组件文档里明明画着，
 * 页面上的实例却是空的，而屏幕上没有任何东西解释为什么。
 */
function anchorComponentDocumentRoot(document: ComposeDocument): ComposeDocument {
  const rootId = document.rootIds[0]
  if (!rootId || document.rootIds.length !== 1) return document
  const root = document.entities[rootId]
  if (!root) return document
  const item = getComposeLayoutItem(root)
  if (!item || (item.offset.x === 0 && item.offset.y === 0)) return document
  return {
    ...document,
    entities: {
      ...document.entities,
      [rootId]: {
        ...root,
        components: {
          ...root.components,
          LayoutItem: { ...item, offset: { x: 0, y: 0 } },
        },
      },
    },
  }
}

function ResolvedComponentContent({
  ancestorKey,
  animationId,
  animationTime,
  assetResolver,
  contentFit,
  document,
  mode,
  registry,
  scriptModuleLoader,
}: {
  readonly ancestorKey: string
  readonly animationId: unknown
  readonly animationTime: unknown
  readonly assetResolver: ComposeRendererProps['assetResolver']
  readonly contentFit: ComponentInstanceContentFit
  readonly document: ComposeDocument
  readonly mode: 'editor' | 'preview'
  readonly registry: ComposeEntityRegistry
  readonly scriptModuleLoader: ComposeRendererProps['scriptModuleLoader']
}) {
  const nest = useComposeComponentInstanceNest()
  /*
   * 顺序是「快照 → 实例覆盖 → 采样 → 嵌套 Yoga」。
   *
   * 覆盖表达作者意图，采样表达此刻的呈现；反过来的话覆盖会去改一份已经被时间改写过的文档，
   * 同一份覆盖在不同时刻算出不同结果。
   *
   * 采样也排在 `alignComponentDocumentOutput` 之前：对齐读的是根的 Frame 尺寸与 LayoutItem，
   * 两者都可能被轨道改写，对齐必须看到采样后的值。
   *
   * PERF：播放头一变就产生新的 document 引用，这个实例的 Yoga 树因此重解一次。成本形状与
   * 页面级动画完全一样（`useComposeAnimationPlayback` 同样是采样后重解），不是新的性能类别；
   * 状态驱动的实例一次业务事件才变一次。没选动画时采样返回原引用，一次多余的重解都不会发生。
   */
  const layoutDocument = useMemo(
    () => {
      const anchored = anchorComponentDocumentRoot(
        sampleComponentInstanceDocument(document, animationId, animationTime),
      )
      /*
       * `'scale'` 不走 `alignComponentDocumentOutput`：那是 `'layout'` 那一支把盒尺寸写进
       * 嵌套根的机制。缩放模式下嵌套文档按自然尺寸求解、由外层按比值缩放，两支不得同时改
       * 一份尺寸数据——同时做的症状是拖一次角手柄图形跳两次。
       */
      return contentFit === 'scale' ? anchored : alignComponentDocumentOutput(anchored)
    },
    [animationId, animationTime, contentFit, document],
  )
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
  const rootId = layoutDocument.rootIds[0]
  const rootFrameSize = (rootId ? getComposeFrame(layoutDocument.entities[rootId]) : null)?.size ?? null
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
