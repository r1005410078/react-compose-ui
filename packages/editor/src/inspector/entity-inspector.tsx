import { useMemo, useState } from 'react'
import * as v from 'valibot'
import {
  ComposeRegistryComponentInspector,
  ComposeRegistryComponentInspectorHeaderActions,
  ComposeRegistryMissingComponentInspector,
  ComposeRegistryMissingComponentInspectorHeaderActions,
  ComposeRegistryRendererInspector,
  type ComposeEntityRegistry,
  type ComposeNodeEditPort,
  type ComposePaintEditPort,
} from '@compose-ui/component-registry'
import { ComposeButton, ComposeConfirmDialog } from '@compose-ui/components'
import {
  BUILTIN_COMMAND_TYPES,
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  getComposeComposition,
  getComposeLock,
  getComposeRenderer,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
  type EditorCommand,
  type JsonObject,
} from '@compose-ui/core'
import {
  ComposePropertyPanel,
  ComposePropertyPanelRoot,
  ComposePropertyPanelSection,
} from '@compose-ui/property-panel'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import type { ComposePageScriptScope } from '@compose-ui/script-runtime'
import { RendererBindingsInspector } from './renderer-bindings-inspector'

interface EntityInspectorProps {
  readonly document: ComposeDocument
  readonly entity: ComposeEntity
  readonly layoutSnapshot?: ComposeLayoutSnapshot
  readonly registry: ComposeEntityRegistry
  readonly dispatch: (command: EditorCommand) => unknown
  readonly idFactory: () => string
  readonly paintEditPort?: ComposePaintEditPort
  /** 节点引用属性的候选来源；未注入时 node 字段呈现无候选状态。 */
  readonly nodeEditPort?: ComposeNodeEditPort
  /** 当前页面实例的 setup 返回作用域。 */
  readonly scriptScope?: ComposePageScriptScope
}

// 内建 Component 由 Registry 定义的 inspector 呈现；缺失定义时也不进入“未知”分组，
// 避免把协议内的 Key 报告成宿主扩展错误。
const BUILTIN_COMPONENT_KEYS = new Set<string>(Object.values(COMPOSE_BUILTIN_COMPONENT_KEYS))

function command(
  idFactory: () => string,
  entity: ComposeEntity,
  type: string,
  payload: JsonObject,
  label: string,
): EditorCommand {
  return {
    id: idFactory(),
    type,
    payload,
    meta: {
      label,
      source: 'inspector',
      targetIds: [entity.id],
      mergeKey: `inspector:${entity.id}:${type}`,
    },
  }
}

function IdentityInspector({
  entity,
  dispatch,
  idFactory,
  readOnly,
  zh,
}: Omit<EntityInspectorProps, 'document' | 'registry'> & {
  readonly readOnly: boolean
  readonly zh: boolean
}) {
  const schema = useMemo(() => v.object({
    name: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1),
      v.title(zh ? '名称' : 'Name'),
    ),
  }), [zh])
  return (
    <ComposePropertyPanel
      aria-label={zh ? '基础属性' : 'Identity properties'}
      readOnly={readOnly}
      schema={schema}
      value={{ name: entity.name }}
      onValueChange={(value) => dispatch(command(
        idFactory,
        entity,
        BUILTIN_COMMAND_TYPES.renameEntity,
        { entityId: entity.id, name: value.name },
        zh ? `重命名 ${entity.name}` : `Rename ${entity.name}`,
      ))}
    />
  )
}

function UnknownInspector({
  label,
  message,
}: {
  readonly label: string
  readonly message: string
}) {
  const schema = useMemo(() => v.object({
    message: v.pipe(
      v.string(),
      v.title(label),
      v.metadata({ propertyPanel: { readOnly: true } }),
    ),
  }), [label])
  return (
    <ComposePropertyPanel
      aria-label={label}
      readOnly
      schema={schema}
      value={{ message }}
    />
  )
}

/** 按 Registry 顺序聚合当前 Entity 的 Component、Renderer 与能力操作。 */
export function EntityInspector({
  document,
  entity,
  layoutSnapshot,
  registry,
  dispatch,
  idFactory,
  nodeEditPort,
  paintEditPort,
  scriptScope,
}: EntityInspectorProps) {
  const zh = (useComposeI18nContext()?.locale ?? 'zh-CN') === 'zh-CN'
  const locked = getComposeLock(entity).locked
  const renderer = getComposeRenderer(entity)
  const rendererDefinition = renderer
    ? registry.getRenderer(renderer.type)
    : undefined
  const componentDefinitions = registry.listComponents()
  const basicDefinitions = componentDefinitions.filter((definition) => (
    !definition.hidden
    && definition.inspectorGroup === 'basic'
    && definition.inspector
    && entity.components[definition.key] !== undefined
  ))
  const composition = getComposeComposition(entity)
  const availability = registry.listCapabilityAvailability(entity)
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null)
  const pendingDefinition = pendingRemoval
    ? registry.getCapability(pendingRemoval)
    : undefined
  const addCapability = (capabilityId: string) => {
    const plan = registry.planAddCapability(document, entity.id, capabilityId, idFactory)
    if (plan.ok) dispatch(plan.command)
  }
  const removeCapability = (capabilityId: string) => {
    const plan = registry.planRemoveCapability(document, entity.id, capabilityId, idFactory)
    if (plan.ok) dispatch(plan.command)
    setPendingRemoval(null)
  }

  return (
    <div
      aria-label={zh ? `${entity.name} 属性` : `${entity.name} properties`}
      className="compose-editor__entity-inspector"
      role="region"
    >
      <header className="compose-editor__entity-inspector-header">
        <strong>{entity.name}</strong>
        <label
          className="compose-editor__entity-inspector-add-capability"
          title={zh ? '添加能力' : 'Add capability'}
        >
          <span aria-hidden="true">＋</span>
          <select
            aria-label={zh ? '添加能力' : 'Add capability'}
            disabled={locked}
            value=""
            onChange={(event) => {
              if (event.target.value) addCapability(event.target.value)
            }}
          >
            <option value="">{zh ? '选择能力…' : 'Choose capability…'}</option>
            {availability.filter((item) => !item.attached).map((item) => (
              <option
                disabled={item.disabled}
                key={item.capabilityId}
                title={item.issue?.message}
                value={item.capabilityId}
              >
                {item.definition?.label ?? item.capabilityId}
              </option>
            ))}
          </select>
        </label>
      </header>

      {composition.capabilityIds.length > 0 ? (
        <section
          aria-label={zh ? '已附加能力' : 'Attached capabilities'}
          className="compose-editor__entity-capabilities"
        >
          {composition.capabilityIds.map((capabilityId) => {
            const item = availability.find((candidate) =>
              candidate.capabilityId === capabilityId)
            const definition = registry.getCapability(capabilityId)
            return (
              <div key={capabilityId}>
                <span title={definition?.description}>
                  {definition?.label ?? `${zh ? '未知能力' : 'Unknown capability'}: ${capabilityId}`}
                </span>
                <ComposeButton
                  aria-label={zh
                    ? `移除${definition?.label ?? capabilityId}`
                    : `Remove ${definition?.label ?? capabilityId}`}
                  disabled={item?.disabled ?? true}
                  size="xs"
                  title={item?.issue?.message}
                  variant="ghost"
                  onClick={() => setPendingRemoval(capabilityId)}
                >
                  {zh ? '移除' : 'Remove'}
                </ComposeButton>
              </div>
            )
          })}
        </section>
      ) : null}

      <ComposePropertyPanelRoot
        aria-label={zh ? `${entity.name} 属性字段` : `${entity.name} property fields`}
      >
        <ComposePropertyPanelSection defaultExpanded title={zh ? '基础' : 'Identity'}>
          <IdentityInspector
            dispatch={dispatch}
            entity={entity}
            idFactory={idFactory}
            readOnly={locked}
            zh={zh}
          />
          {basicDefinitions.map((definition) => (
            <ComposeRegistryComponentInspector
              componentKey={definition.key}
              dispatch={dispatch}
              document={document}
              entity={entity}
              key={definition.key}
              layoutSnapshot={layoutSnapshot}
              readOnly={locked}
              nodeEditPort={nodeEditPort}
              paintEditPort={paintEditPort}
              registry={registry}
            />
          ))}
        </ComposePropertyPanelSection>
        {componentDefinitions.map((definition) => {
          if (definition.hidden) return null
          const componentExists = entity.components[definition.key] !== undefined
          if (!componentExists) {
            if (!definition.missingInspector?.isVisible(entity)) return null
            const hasContent = Boolean(definition.missingInspector.content)
            return (
              <ComposePropertyPanelSection
                actionOnly={!hasContent}
                actions={(
                  <ComposeRegistryMissingComponentInspectorHeaderActions
                    componentKey={definition.key}
                    dispatch={dispatch}
                    document={document}
                    entity={entity}
                    layoutSnapshot={layoutSnapshot}
                    readOnly={locked}
                    nodeEditPort={nodeEditPort}
                    paintEditPort={paintEditPort}
                    registry={registry}
                  />
                )}
                defaultExpanded={definition.inspectorDefaultExpanded ?? false}
                key={definition.key}
                title={definition.label}
              >
                {hasContent ? (
                  <ComposeRegistryMissingComponentInspector
                    componentKey={definition.key}
                    dispatch={dispatch}
                    document={document}
                    entity={entity}
                    layoutSnapshot={layoutSnapshot}
                    readOnly={locked}
                    nodeEditPort={nodeEditPort}
                    paintEditPort={paintEditPort}
                    registry={registry}
                  />
                ) : null}
              </ComposePropertyPanelSection>
            )
          }
          if (!definition.inspector) return null
          if (definition.inspectorGroup === 'basic') return null
          return (
            <ComposePropertyPanelSection
              actions={definition.inspectorHeaderActions ? (
                <ComposeRegistryComponentInspectorHeaderActions
                  componentKey={definition.key}
                  dispatch={dispatch}
                  document={document}
                  entity={entity}
                  layoutSnapshot={layoutSnapshot}
                  readOnly={locked}
                  nodeEditPort={nodeEditPort}
                  paintEditPort={paintEditPort}
                  registry={registry}
                />
              ) : undefined}
              defaultExpanded={definition.inspectorDefaultExpanded ?? false}
              key={definition.key}
              title={definition.label}
            >
              <ComposeRegistryComponentInspector
                componentKey={definition.key}
                dispatch={dispatch}
                document={document}
                entity={entity}
                layoutSnapshot={layoutSnapshot}
                readOnly={locked}
                nodeEditPort={nodeEditPort}
                paintEditPort={paintEditPort}
                registry={registry}
              />
            </ComposePropertyPanelSection>
          )
        })}

        {Object.keys(entity.components)
          .filter((key) => !BUILTIN_COMPONENT_KEYS.has(key) && !registry.getComponent(key))
          .map((key) => (
            <ComposePropertyPanelSection defaultExpanded={false} key={key} title={key}>
              <UnknownInspector
                label={zh ? '未知 Component' : 'Unknown component'}
                message={zh ? `未知 Component：${key}` : `Unknown component: ${key}`}
              />
            </ComposePropertyPanelSection>
          ))}

        {renderer && (!rendererDefinition || rendererDefinition.inspector) ? (
          <ComposePropertyPanelSection
            defaultExpanded={rendererDefinition?.inspectorDefaultExpanded ?? false}
            title={registry.getComponent('Renderer')?.label ?? (zh ? '内容' : 'Content')}
          >
            {rendererDefinition ? (
              <ComposeRegistryRendererInspector
                dispatch={dispatch}
                document={document}
                entity={entity}
                layoutSnapshot={layoutSnapshot}
                readOnly={locked}
                nodeEditPort={nodeEditPort}
                paintEditPort={paintEditPort}
                registry={registry}
              />
            ) : (
              <UnknownInspector
                label={zh ? '未知 Renderer' : 'Unknown Renderer'}
                message={zh
                  ? `未知组件：${renderer.type}`
                  : `Unknown renderer: ${renderer.type}`}
              />
            )}
          </ComposePropertyPanelSection>
        ) : null}
        {renderer && rendererDefinition?.propContracts?.length ? (
          <ComposePropertyPanelSection
            defaultExpanded
            title={zh ? '数据绑定' : 'Bindings'}
          >
            <RendererBindingsInspector
              definition={rendererDefinition}
              dispatch={dispatch}
              entity={entity}
              idFactory={idFactory}
              readOnly={locked}
              scope={scriptScope}
            />
          </ComposePropertyPanelSection>
        ) : null}
      </ComposePropertyPanelRoot>

      <ComposeConfirmDialog
        cancelLabel={zh ? '取消' : 'Cancel'}
        confirmLabel={zh ? '移除' : 'Remove'}
        description={zh
          ? `将从“${entity.name}”移除“${pendingDefinition?.label ?? pendingRemoval ?? ''}”及其数据。`
          : `Remove “${pendingDefinition?.label ?? pendingRemoval ?? ''}” and its data from “${entity.name}”.`}
        destructive
        open={pendingRemoval !== null}
        title={zh ? '移除能力？' : 'Remove capability?'}
        onConfirm={() => {
          if (pendingRemoval) removeCapability(pendingRemoval)
        }}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null)
        }}
      />
    </div>
  )
}
