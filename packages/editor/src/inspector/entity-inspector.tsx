import { useMemo, useState, type ReactNode } from 'react'
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
import {
  RendererBindingOnlyRows,
} from './renderer-bindings-inspector'
import { useRendererInspectorBindingPort } from './renderer-inspector-binding-port'

/**
 * Inspector 外壳形态。
 *
 * - `full`：完整区域，含标题、能力条与独立 PropertyPanelRoot（默认）。
 * - `sections`：只输出属性分组，供宿主拼进同一面板，避免组件实例出现两个搜索栏。
 */
export type EntityInspectorChrome = 'full' | 'sections'

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
  /**
   * 禁止重命名该 Entity。
   *
   * @remarks
   * 组件实例内部节点用之：稳定操作代数只覆盖 Component 字段，name 不是 Component 字段，
   * 因此无法表达重命名。留成可输入但静默失效的字段会误导用户。
   */
  readonly renameDisabled?: boolean
  /**
   * 不渲染的 Component Inspector Key。
   *
   * @remarks
   * 组件实例的最外层由宿主身份/位置与组件根视觉属性拼成。隐藏一侧的重复 Key，
   * 避免同一属性出现两次且取值互相矛盾。
   */
  readonly hiddenComponentKeys?: readonly string[]
  /** 不渲染名称等身份字段。 */
  readonly hideIdentity?: boolean
  /**
   * 外壳形态。
   *
   * @defaultValue 'full'
   */
  readonly chrome?: EntityInspectorChrome
  /**
   * 拼在同一 PropertyPanelRoot 内的额外分组（例如组件根属性）。
   *
   * @remarks
   * 仅 `chrome="full"` 时生效；用于把宿主与根合成一个属性面板。
   */
  readonly extraSections?: ReactNode
  /** 标题左侧图标（如组件实例菱形）。仅 full chrome。 */
  readonly headerLeading?: ReactNode
  /** 名称下方副标题（如「实例 · 与源同步」）。仅 full chrome。 */
  readonly headerSubtitle?: ReactNode
  /** 标题行右侧、添加能力之前的操作区（实例工具栏）。仅 full chrome。 */
  readonly headerTrailing?: ReactNode
  /** 标题栏与属性字段之间的横幅（如本层覆盖列表）。仅 full chrome。 */
  readonly banner?: ReactNode
  /**
   * 搜索工具带上方的状态槽（实例更新反馈等）。
   *
   * @remarks
   * 注入 ComposePropertyPanelRoot.statusSlot，与搜索同属 chrome band。
   */
  readonly statusSlot?: ReactNode
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
  hiddenComponentKeys,
  hideIdentity,
  renameDisabled,
  scriptScope,
  chrome = 'full',
  extraSections,
  headerLeading,
  headerSubtitle,
  headerTrailing,
  banner,
  statusSlot,
}: EntityInspectorProps) {
  const zh = (useComposeI18nContext()?.locale ?? 'zh-CN') === 'zh-CN'
  const locked = getComposeLock(entity).locked
  const renderer = getComposeRenderer(entity)
  const rendererDefinition = renderer
    ? registry.getRenderer(renderer.type)
    : undefined
  const propsBinding = useRendererInspectorBindingPort({
    definition: rendererDefinition,
    dispatch,
    entity,
    idFactory,
    scope: scriptScope,
  })
  const rendererInlineProps = new Set(rendererDefinition?.inspectorPropNames ?? [])
  const rendererCategories = rendererDefinition?.propCategories ?? []
  const rendererAdvancedContracts = rendererDefinition?.propContracts?.filter(
    (contract) => contract.category === undefined,
  ) ?? []
  const rendererAdvancedHasInspector = Boolean(
    rendererDefinition?.inspector
    && (
      rendererCategories.length === 0
      || rendererAdvancedContracts.some((contract) => rendererInlineProps.has(contract.name))
    ),
  )
  const rendererAdvancedHasBindingRows = rendererAdvancedContracts.some(
    (contract) => !rendererInlineProps.has(contract.name),
  )
  const rendererAdvancedHasContent = !rendererDefinition
    || rendererAdvancedHasInspector
    || rendererAdvancedHasBindingRows
  const componentDefinitions = registry.listComponents()
  const basicDefinitions = componentDefinitions.filter((definition) => (
    !definition.hidden
    && definition.inspectorGroup === 'basic'
    && definition.inspector
    && entity.components[definition.key] !== undefined
  ))
  const visibleBasicDefinitions = basicDefinitions.filter(
    (definition) => !(hiddenComponentKeys ?? []).includes(definition.key),
  )
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

  const sections = (
    <>
      {hideIdentity === true && visibleBasicDefinitions.length === 0 ? null : (
        <ComposePropertyPanelSection defaultExpanded title={zh ? '基础' : 'Identity'}>
          {hideIdentity === true ? null : (
            <IdentityInspector
              dispatch={dispatch}
              entity={entity}
              idFactory={idFactory}
              readOnly={locked || renameDisabled === true}
              zh={zh}
            />
          )}
          {visibleBasicDefinitions.map((definition) => (
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
      )}
      {componentDefinitions.map((definition) => {
        if (definition.hidden) return null
        if ((hiddenComponentKeys ?? []).includes(definition.key)) return null
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
              // 缺失入口（如未启用的布局）默认收起，避免空分组占满视野。
              defaultExpanded={false}
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
            // 有内容的分组默认展开；定义可显式覆盖。
            defaultExpanded={definition.inspectorDefaultExpanded ?? true}
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
        .filter((key) => (
          !BUILTIN_COMPONENT_KEYS.has(key)
          && !registry.getComponent(key)
          && !(hiddenComponentKeys ?? []).includes(key)
        ))
        .map((key) => (
          <ComposePropertyPanelSection defaultExpanded key={key} title={key}>
            <UnknownInspector
              label={zh ? '未知 Component' : 'Unknown component'}
              message={zh ? `未知 Component：${key}` : `Unknown component: ${key}`}
            />
          </ComposePropertyPanelSection>
        ))}

      {rendererDefinition?.propCategories?.map((category) => {
        const categoryContracts = rendererDefinition.propContracts?.filter(
          (contract) => contract.category === category.id,
        ) ?? []
        if (categoryContracts.length === 0) return null
        return (
          <ComposePropertyPanelSection
            defaultExpanded={category.inspectorDefaultExpanded ?? true}
            key={`renderer-category:${category.id}`}
            title={category.label}
          >
            {rendererDefinition.inspector ? (
              <ComposeRegistryRendererInspector
                dispatch={dispatch}
                document={document}
                entity={entity}
                layoutSnapshot={layoutSnapshot}
                readOnly={locked}
                nodeEditPort={nodeEditPort}
                paintEditPort={paintEditPort}
                propCategory={category}
                propsBinding={propsBinding}
                registry={registry}
                scriptScope={scriptScope}
              />
            ) : null}
            {propsBinding ? (
              <RendererBindingOnlyRows
                categoryId={category.id}
                definition={rendererDefinition}
                port={propsBinding}
                readOnly={locked}
              />
            ) : null}
          </ComposePropertyPanelSection>
        )
      })}

      {renderer && rendererAdvancedHasContent ? (
        <ComposePropertyPanelSection
          defaultExpanded={rendererDefinition?.inspectorDefaultExpanded ?? true}
          title={zh ? '高级' : 'Advanced'}
        >
          {rendererDefinition ? (
            <>
              {rendererAdvancedHasInspector ? (
                <ComposeRegistryRendererInspector
                  dispatch={dispatch}
                  document={document}
                  entity={entity}
                  layoutSnapshot={layoutSnapshot}
                  readOnly={locked}
                  nodeEditPort={nodeEditPort}
                  paintEditPort={paintEditPort}
                  propsBinding={propsBinding}
                  registry={registry}
                  scriptScope={scriptScope}
                />
              ) : null}
              {propsBinding ? (
                <RendererBindingOnlyRows
                  definition={rendererDefinition}
                  port={propsBinding}
                  readOnly={locked}
                />
              ) : null}
            </>
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
      {extraSections}
    </>
  )

  if (chrome === 'sections') {
    return sections
  }

  return (
    <div
      aria-label={zh ? `${entity.name} 属性` : `${entity.name} properties`}
      className="compose-editor__entity-inspector"
      role="region"
    >
      <header className="compose-editor__entity-inspector-header">
        <div className="compose-editor__entity-inspector-identity">
          {headerLeading}
          <div className="compose-editor__entity-inspector-title-block">
            <strong>{entity.name}</strong>
            {headerSubtitle ? (
              <div className="compose-editor__entity-inspector-subtitle">
                {headerSubtitle}
              </div>
            ) : null}
          </div>
        </div>
        <div className="compose-editor__entity-inspector-header-end">
          {headerTrailing}
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
        </div>
      </header>

      {banner}

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
        statusSlot={statusSlot}
      >
        {sections}
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
