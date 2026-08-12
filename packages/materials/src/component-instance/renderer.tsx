import {
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
  getComposeVisibility,
  isComposeGroupEntity,
  migrateLegacyComposeInstanceOverrides,
  parseComposeInstanceOverrides,
  resolveComposeInstanceOverrides,
  validateComposeDocument,
  type ComposeComponentInstanceOverrides,
  type ComposeComponentPropertyDefinition,
  type ComposeComponentReference,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
  type ComposeResolvedComponentSnapshot,
  type JsonValue,
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
  const rootId = validation.document.rootIds[0]
  if (
    validation.document.rootIds.length !== 1
    || !rootId
    || !isComposeGroupEntity(validation.document.entities[rootId]!)
    || typeof value.componentId !== 'string'
    || (value.kind !== 'base' && value.kind !== 'variant')
    || typeof value.revision !== 'string'
    || !Array.isArray(value.properties)
    || !Array.isArray(value.appliedLineage)
  ) return null
  return {
    componentId: value.componentId,
    kind: value.kind,
    revision: value.revision,
    document: validation.document,
    properties: value.properties as readonly ComposeComponentPropertyDefinition[],
    appliedLineage: value.appliedLineage as ComposeResolvedComponentSnapshot['appliedLineage'],
  }
}

/**
 * 读取实例覆盖，兼容尚未落盘为分区形状的历史实体。
 *
 * @remarks
 * 分区形状优先；只有完全缺少 `instanceOverrides` 时才对旧 `propertyOverrides` 走显式迁移。
 * 形状损坏的分区数据判为无效，不回退到旧字段，避免把结构操作静默丢成纯属性覆盖。
 */
function readInstanceOverrides(props: ComposeRendererProps['props']): ComposeComponentInstanceOverrides | null {
  const raw = props.instanceOverrides
  if (raw === undefined) {
    const legacy = props.propertyOverrides
    if (!isRecord(legacy)) return null
    return migrateLegacyComposeInstanceOverrides(legacy as Readonly<Record<string, JsonValue>>)
  }
  const parsed = parseComposeInstanceOverrides(raw)
  return parsed.ok ? parsed.overrides : null
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
  pageDocumentPort,
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
  // 四段解析顺序由 core 单点提供：结构操作先成型，属性覆盖才能命中新建目标。
  const resolved = resolveComposeInstanceOverrides({
    document: snapshot.document,
    properties: snapshot.properties,
    overrides,
  })
  if (!resolved.ok) {
    return <Status testId="compose-component-instance-invalid" alert>组件实例覆盖无效</Status>
  }
  const document = resolved.document
  return (
    <ResolvedComponentContent
      ancestorKey={key}
      assetResolver={assetResolver}
      document={document}
      mode={mode}
      pageDocumentPort={pageDocumentPort}
      registry={registry}
      scriptModuleLoader={scriptModuleLoader}
    />
  )
}

function ResolvedComponentContent({
  ancestorKey,
  assetResolver,
  document,
  mode,
  pageDocumentPort,
  registry,
  scriptModuleLoader,
}: {
  readonly ancestorKey: string
  readonly assetResolver: ComposeRendererProps['assetResolver']
  readonly document: ComposeDocument
  readonly mode: 'editor' | 'preview'
  readonly pageDocumentPort: ComposeRendererProps['pageDocumentPort']
  readonly registry: ComposeEntityRegistry
  readonly scriptModuleLoader: ComposeRendererProps['scriptModuleLoader']
}) {
  const nest = useComposeComponentInstanceNest()
  const [runtime] = useState(() => createComposeLayoutRuntime({ document }))
  const adapter = useMemo(() => createComposeRendererMeasurementAdapter({
    registry,
    assetResolver,
    pageDocumentPort,
  }), [assetResolver, pageDocumentPort, registry])
  const state = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)
  const currentState = state.document === document
    ? state
    : { status: 'loading' as const, document }
  const runtimeGeneration = useRef(0)
  const adapterGenerations = useRef(new WeakMap<ComposeRendererMeasurementAdapter, number>())

  useLayoutEffect(() => {
    adapter.updateDocument(document)
    runtime.setMeasurementPort(adapter)
    runtime.updateDocument(document)
    return () => runtime.setMeasurementPort(undefined)
  }, [adapter, document, runtime])
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

  if (currentState.status === 'loading') {
    return <Status testId="compose-component-instance-loading">载入组件布局…</Status>
  }
  if (currentState.status === 'error') {
    return <Status testId="compose-component-instance-layout-error" alert>组件布局失败</Status>
  }
  return (
    <ComposeComponentInstanceNestProvider
      ancestorKeys={[...nest.ancestorKeys, ancestorKey]}
      depth={nest.depth + 1}
    >
      <div
        className="compose-material compose-material--component-instance"
        data-testid="compose-component-instance-content"
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          ...(mode === 'editor' ? { pointerEvents: 'none' as const } : {}),
        }}
      >
        {document.rootIds.map((rootId) => (
          <NestedEntity
            assetResolver={assetResolver}
            document={document}
            entityId={rootId}
            key={rootId}
            layoutSnapshot={currentState.snapshot}
            mode={mode}
            pageDocumentPort={pageDocumentPort}
            registry={registry}
            scriptModuleLoader={scriptModuleLoader}
          />
        ))}
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
  pageDocumentPort,
  registry,
  scriptModuleLoader,
}: {
  readonly assetResolver: ComposeRendererProps['assetResolver']
  readonly document: ComposeDocument
  readonly entityId: string
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly mode: 'editor' | 'preview'
  readonly pageDocumentPort: ComposeRendererProps['pageDocumentPort']
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
      />
      {hierarchy?.childIds.map((childId) => (
        <NestedEntity
          assetResolver={assetResolver}
          document={document}
          entityId={childId}
          key={childId}
          layoutSnapshot={layoutSnapshot}
          mode={mode}
          pageDocumentPort={pageDocumentPort}
          registry={registry}
          scriptModuleLoader={scriptModuleLoader}
        />
      ))}
    </div>
  )
}
