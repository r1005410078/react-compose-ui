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
      assetResolver={assetResolver}
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

function ResolvedComponentContent({
  ancestorKey,
  assetResolver,
  document,
  mode,
  registry,
  scriptModuleLoader,
}: {
  readonly ancestorKey: string
  readonly assetResolver: ComposeRendererProps['assetResolver']
  readonly document: ComposeDocument
  readonly mode: 'editor' | 'preview'
  readonly registry: ComposeEntityRegistry
  readonly scriptModuleLoader: ComposeRendererProps['scriptModuleLoader']
}) {
  const nest = useComposeComponentInstanceNest()
  // 布局文档：output 与根 fixed 对齐，保证嵌套 Auto Layout 重算
  const layoutDocument = useMemo(() => alignComponentDocumentOutput(document), [document])
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
        {layoutDocument.rootIds.map((rootId) => (
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
