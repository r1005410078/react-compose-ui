import type { ComposeAssetResolver } from '@compose-ui/assets'
import {
  getComposeRenderer,
  getComposeBindings,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutMeasurementDiagnostic,
  type ComposeLayoutMeasurementPort,
  type ComposeMeasuredSize,
  type ComposePageDocumentLoader,
  type JsonValue,
} from '@compose-ui/core'
import type { ComposePageScriptScope } from '@compose-ui/script-runtime'
import { resolveComposeRendererRuntimeProps } from '../registry/runtime-props'
import type {
  ComposeEntityRegistry,
  ComposeRendererDefinition,
  ComposeRendererMeasurementDefinition,
} from '../registry/types'

/** 创建 Registry measurement adapter 的运行时依赖。 @public */
export interface ComposeRendererMeasurementAdapterOptions {
  readonly registry: ComposeEntityRegistry
  readonly assetResolver?: ComposeAssetResolver
  readonly pageDocumentPort?: ComposePageDocumentLoader
  readonly scriptScope?: ComposePageScriptScope
}

/** Registry measurement 到 Core Layout port 的可释放适配器。 @public */
export interface ComposeRendererMeasurementAdapter extends ComposeLayoutMeasurementPort {
  /** 更新正式文档并取消已删除或输入已变化 Entity 的异步工作。 */
  updateDocument(document: ComposeDocument): void
  /**
   * 设置或清除一个 Entity 可编辑文本 Prop 的编辑中值覆盖；传 `null` 清除。
   *
   * @remarks
   * 画布内原地编辑期间不产生文档事务，因此测量若只看文档就永远停在旧文本上，Auto width
   * 不会跟随输入变宽。该覆盖把编辑中的值送进既有测量链路入口，链路本身不变。
   *
   * 只对声明了 `editableTextPropName` 的 Renderer 生效；设置、更新与清除都会让 revision
   * 前进并使该 Entity 的缓存条目失效。覆盖是纯运行时状态，不写入文档与历史。
   */
  setEditableTextOverride(entityId: string, value: string | null): void
  /** 取消 prepare、外部订阅与全部 listener；可重复调用。 */
  dispose(): void
}

type MeasurementEntry = {
  readonly entityId: string
  readonly key: string
  readonly definition: ComposeRendererDefinition
  readonly measurement: ComposeRendererMeasurementDefinition
  readonly generation: number
  entity: ComposeEntity
  prepared: unknown
  status: 'idle' | 'preparing' | 'ready' | 'failed'
  controller?: AbortController
  unsubscribe?: () => void
  scopeUnsubscribers?: readonly (() => void)[]
}

function stableJson(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  const object = value as Readonly<Record<string, JsonValue>>
  return `{${Object.keys(object).sort().map((key) => (
    `${JSON.stringify(key)}:${stableJson(object[key]!)}`
  )).join(',')}}`
}

function entityKey(entity: ComposeEntity) {
  return `${JSON.stringify(entity.name)}:${stableJson(entity.components)}`
}

function validMeasuredSize(value: ComposeMeasuredSize | null): value is ComposeMeasuredSize {
  return value !== null
    && Number.isFinite(value.width)
    && value.width >= 0
    && Number.isFinite(value.height)
    && value.height >= 0
    && (value.baseline === undefined
      || (Number.isFinite(value.baseline) && value.baseline >= 0 && value.baseline <= value.height))
}

function diagnostic(
  code: ComposeLayoutMeasurementDiagnostic['code'],
  message: string,
): ComposeLayoutMeasurementDiagnostic {
  return { code, message }
}

class RegistryMeasurementAdapter implements ComposeRendererMeasurementAdapter {
  private readonly listeners = new Set<(entityIds?: readonly string[]) => void>()
  private readonly entries = new Map<string, MeasurementEntry>()
  private readonly diagnostics = new Map<string, ComposeLayoutMeasurementDiagnostic>()
  private readonly editableTextOverrides = new Map<string, string>()
  private nextGeneration = 0
  private currentRevision = 0
  private disposed = false

  constructor(private readonly options: ComposeRendererMeasurementAdapterOptions) {}

  get revision() {
    return this.currentRevision
  }

  measure: ComposeLayoutMeasurementPort['measure'] = (input) => {
    if (this.disposed) return null
    const renderer = getComposeRenderer(input.entity)
    const definition = renderer && this.options.registry.getRenderer(renderer.type)
    const measurement = definition?.measurement
    if (!renderer || !definition || !measurement) {
      this.diagnostics.set(input.entity.id, diagnostic(
        'measurement.unregistered',
        renderer
          ? `Renderer ${renderer.type} 未注册内容测量器`
          : 'Entity 没有可测量的 Renderer',
      ))
      return null
    }

    const entry = this.entryFor(input.entity, definition, measurement)
    if (measurement.prepare && entry.status === 'idle') this.startPrepare(entry, renderer)
    if (entry.status === 'preparing') {
      this.diagnostics.set(input.entity.id, diagnostic(
        'measurement.preparing',
        `Renderer ${renderer.type} 正在准备内容尺寸`,
      ))
      return null
    }
    if (entry.status === 'failed') return null

    try {
      const resolved = this.resolveProps(input.entity, definition)
      const measured = measurement.measure({
        entity: input.entity,
        renderer,
        props: resolved.props,
        authoredProps: resolved.authoredProps,
        width: input.width,
        height: input.height,
        prepared: entry.prepared,
      })
      if (!validMeasuredSize(measured)) {
        this.diagnostics.set(input.entity.id, diagnostic(
          'measurement.invalid',
          `Renderer ${renderer.type} 返回了无效内容尺寸`,
        ))
        return null
      }
      this.diagnostics.delete(input.entity.id)
      return measured
    }
    catch (cause) {
      this.diagnostics.set(input.entity.id, diagnostic(
        'measurement.failed',
        `Renderer ${renderer.type} 测量失败：${cause instanceof Error ? cause.message : String(cause)}`,
      ))
      return null
    }
  }

  getDiagnostic = (entityId: string) => this.diagnostics.get(entityId)

  subscribe = (listener: (entityIds?: readonly string[]) => void) => {
    if (this.disposed) return () => undefined
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  updateDocument(document: ComposeDocument) {
    if (this.disposed) return
    this.entries.forEach((entry, entityId) => {
      const entity = document.entities[entityId]
      if (entity && entityKey(entity) === entry.key) return
      this.releaseEntry(entry)
      this.entries.delete(entityId)
      this.diagnostics.delete(entityId)
    })
    this.diagnostics.forEach((_value, entityId) => {
      if (!document.entities[entityId]) this.diagnostics.delete(entityId)
    })
  }

  setEditableTextOverride(entityId: string, value: string | null) {
    if (this.disposed) return
    const current = this.editableTextOverrides.get(entityId)
    if (value === null) {
      if (current === undefined) return
      this.editableTextOverrides.delete(entityId)
    }
    else {
      if (current === value) return
      this.editableTextOverrides.set(entityId, value)
    }
    // 有缓存条目时走 invalidateEntry：它同时丢弃 prepared 并 emit；没有条目时仍需 emit，
    // 否则首次进入编辑（尚未测量过）的 Entity 不会触发重新求解。
    const entry = this.entries.get(entityId)
    if (entry) this.invalidateEntry(entry)
    else this.emit([entityId])
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.entries.forEach((entry) => this.releaseEntry(entry))
    this.entries.clear()
    this.diagnostics.clear()
    this.editableTextOverrides.clear()
    this.listeners.clear()
  }

  /**
   * 解析运行时 props，并叠加编辑中值覆盖。
   *
   * 覆盖只作用于 `props`，不动 `authoredProps`：authoredProps 的语义是「文档里已写下的
   * 值」，而编辑中的文本恰恰还没提交进文档，混进去会让依赖它的一方误以为文档已变。
   */
  private resolveProps(entity: ComposeEntity, definition: ComposeRendererDefinition) {
    const resolved = resolveComposeRendererRuntimeProps({
      entity,
      definition,
      scope: this.options.scriptScope,
      methodMode: 'noop',
    })
    const propName = definition.editableTextPropName
    if (propName === undefined) return resolved
    const override = this.editableTextOverrides.get(entity.id)
    if (override === undefined) return resolved
    return { ...resolved, props: { ...resolved.props, [propName]: override } }
  }

  private entryFor(
    entity: ComposeEntity,
    definition: ComposeRendererDefinition,
    measurement: ComposeRendererMeasurementDefinition,
  ) {
    const key = entityKey(entity)
    const current = this.entries.get(entity.id)
    if (
      current
      && current.key === key
      && current.definition === definition
      && current.measurement === measurement
    ) {
      current.entity = entity
      return current
    }
    if (current) this.releaseEntry(current)
    const entry: MeasurementEntry = {
      entityId: entity.id,
      key,
      definition,
      measurement,
      generation: ++this.nextGeneration,
      entity,
      prepared: undefined,
      status: measurement.prepare ? 'idle' : 'ready',
    }
    this.entries.set(entity.id, entry)
    if (measurement.subscribe) {
      const renderer = getComposeRenderer(entity)!
      const resolved = this.resolveProps(entity, definition)
      try {
        entry.unsubscribe = measurement.subscribe({
          entity,
          renderer,
          props: resolved.props,
          authoredProps: resolved.authoredProps,
          assetResolver: this.options.assetResolver,
          pageDocumentPort: this.options.pageDocumentPort,
          invalidate: () => this.invalidateEntry(entry),
        })
      }
      catch (cause) {
        this.diagnostics.set(entity.id, diagnostic(
          'measurement.failed',
          `Renderer ${renderer.type} 测量订阅失败：${cause instanceof Error ? cause.message : String(cause)}`,
        ))
      }
    }
    const bindings = getComposeBindings(entity)
    if (bindings && this.options.scriptScope) {
      const contracts = new Map((definition.propContracts ?? []).map((contract) => [
        contract.name,
        contract,
      ]))
      const fieldSubscriptions = Object.entries(bindings.rendererProps.fields).flatMap(([propName, reference]) => {
        const contract = contracts.get(propName)
        if (contract?.kind !== 'value' || contract.affectsMeasurement === false) return []
        return [this.options.scriptScope!.subscribeExport(
          reference.exportName,
          () => this.invalidateEntry(entry),
        )]
      })
      entry.scopeUnsubscribers = fieldSubscriptions
    }
    return entry
  }

  private startPrepare(entry: MeasurementEntry, renderer: NonNullable<ReturnType<typeof getComposeRenderer>>) {
    const prepare = entry.measurement.prepare
    if (!prepare || entry.status !== 'idle') return
    const controller = new AbortController()
    entry.controller = controller
    entry.status = 'preparing'
    const generation = entry.generation
    const resolved = this.resolveProps(entry.entity, entry.definition)
    void Promise.resolve().then(() => prepare({
      entity: entry.entity,
      renderer,
      props: resolved.props,
      authoredProps: resolved.authoredProps,
      assetResolver: this.options.assetResolver,
      pageDocumentPort: this.options.pageDocumentPort,
      signal: controller.signal,
    })).then((prepared) => {
      if (!this.isCurrent(entry, generation) || controller.signal.aborted) return
      entry.controller = undefined
      entry.prepared = prepared
      entry.status = 'ready'
      this.diagnostics.delete(entry.entityId)
      this.emit([entry.entityId])
    }, (cause: unknown) => {
      if (!this.isCurrent(entry, generation) || controller.signal.aborted) return
      entry.controller = undefined
      entry.status = 'failed'
      this.diagnostics.set(entry.entityId, diagnostic(
        'measurement.prepare-failed',
        `Renderer ${renderer.type} 准备失败：${cause instanceof Error ? cause.message : String(cause)}`,
      ))
      this.emit([entry.entityId])
    })
  }

  private invalidateEntry(entry: MeasurementEntry) {
    if (!this.isCurrent(entry, entry.generation)) return
    entry.controller?.abort()
    entry.controller = undefined
    entry.prepared = undefined
    entry.status = entry.measurement.prepare ? 'idle' : 'ready'
    this.diagnostics.delete(entry.entityId)
    this.emit([entry.entityId])
  }

  private isCurrent(entry: MeasurementEntry, generation: number) {
    return !this.disposed
      && entry.generation === generation
      && this.entries.get(entry.entityId) === entry
  }

  private releaseEntry(entry: MeasurementEntry) {
    entry.controller?.abort()
    entry.unsubscribe?.()
    entry.scopeUnsubscribers?.forEach((unsubscribe) => { unsubscribe() })
  }

  private emit(entityIds?: readonly string[]) {
    if (this.disposed) return
    this.currentRevision += 1
    this.listeners.forEach((listener) => listener(entityIds))
  }
}

/**
 * 把实例级 Registry 与资源、页面端口组合为 Layout Engine 的同步测量缓存。
 *
 * @public
 */
export function createComposeRendererMeasurementAdapter(
  options: ComposeRendererMeasurementAdapterOptions,
): ComposeRendererMeasurementAdapter {
  return new RegistryMeasurementAdapter(options)
}
