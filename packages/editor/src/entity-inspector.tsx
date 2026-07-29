import { useMemo, useState } from 'react'
import * as v from 'valibot'
import {
  ComposeRegistryComponentInspector,
  ComposeRegistryRendererInspector,
  type ComposeEntityRegistry,
} from '@compose-ui/component-registry'
import { ComposeButton, ComposeConfirmDialog } from '@compose-ui/components'
import {
  BUILTIN_COMMAND_TYPES,
  getComposeAppearance,
  getComposeClip,
  getComposeComposition,
  getComposeHierarchy,
  getComposeLock,
  getComposeRenderer,
  getComposeTransform,
  getComposeTransformConstraints,
  getComposeVisibility,
  resolveComposeAppearance,
  type ComposeAppearance,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeTransformConstraints,
  type EditorCommand,
  type JsonObject,
  type JsonValue,
} from '@compose-ui/core'
import {
  ComposePropertyPanel,
  ComposePropertyPanelRoot,
  ComposePropertyPanelSection,
} from '@compose-ui/property-panel'
import { useComposeI18nContext } from '@compose-ui/ui-context'

interface EntityInspectorProps {
  readonly document: ComposeDocument
  readonly entity: ComposeEntity
  readonly registry: ComposeEntityRegistry
  readonly dispatch: (command: EditorCommand) => unknown
  readonly idFactory: () => string
}

const CUSTOM_COMPONENT_KEYS = new Set([
  'Composition',
  'Transform',
  'Visibility',
  'Lock',
  'Appearance',
  'Hierarchy',
  'Clip',
  'TransformConstraints',
  'Renderer',
])

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

function TransformInspector({
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
    position: v.pipe(
      v.object({ x: v.number(), y: v.number() }),
      v.title(zh ? '位置' : 'Position'),
      v.metadata({ propertyPanel: { editor: 'vector2' } }),
    ),
    size: v.pipe(
      v.object({
        width: v.pipe(v.number(), v.minValue(0.000_001)),
        height: v.pipe(v.number(), v.minValue(0.000_001)),
      }),
      v.title(zh ? '尺寸' : 'Size'),
      v.metadata({ propertyPanel: { editor: 'size' } }),
    ),
    rotation: v.pipe(
      v.number(),
      v.title(zh ? '旋转' : 'Rotation'),
      v.metadata({ propertyPanel: { editor: 'angle' } }),
    ),
  }), [zh])
  const transform = getComposeTransform(entity)
  return (
    <ComposePropertyPanel
      aria-label={zh ? '变换属性' : 'Transform properties'}
      readOnly={readOnly}
      schema={schema}
      value={transform}
      onValueChange={(value) => dispatch(command(
        idFactory,
        entity,
        BUILTIN_COMMAND_TYPES.setTransform,
        {
          operation: 'set',
          updates: [{ entityId: entity.id, transform: value }] as unknown as JsonValue,
        },
        zh ? `修改 ${entity.name} 变换` : `Update ${entity.name} transform`,
      ))}
    />
  )
}

function StateInspector({
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
    visible: v.pipe(v.boolean(), v.title(zh ? '可见' : 'Visible')),
  }), [zh])
  return (
    <ComposePropertyPanel
      aria-label={zh ? '状态属性' : 'State properties'}
      readOnly={readOnly}
      schema={schema}
      value={{ visible: getComposeVisibility(entity).visible }}
      onValueChange={(next) => {
        if (readOnly) return
        dispatch(command(
          idFactory,
          entity,
          BUILTIN_COMMAND_TYPES.setVisibility,
          { entityIds: [entity.id], visible: next.visible },
          next.visible
            ? (zh ? `显示 ${entity.name}` : `Show ${entity.name}`)
            : (zh ? `隐藏 ${entity.name}` : `Hide ${entity.name}`),
        ))
      }}
    />
  )
}

function LockInspector({
  entity,
  dispatch,
  idFactory,
  zh,
}: Omit<EntityInspectorProps, 'document' | 'registry'> & {
  readonly zh: boolean
}) {
  const schema = useMemo(() => v.object({
    locked: v.pipe(v.boolean(), v.title(zh ? '锁定' : 'Locked')),
  }), [zh])
  return (
    <ComposePropertyPanel
      aria-label={zh ? '锁定属性' : 'Lock properties'}
      schema={schema}
      value={{ locked: getComposeLock(entity).locked }}
      onValueChange={(next) => dispatch(command(
        idFactory,
        entity,
        BUILTIN_COMMAND_TYPES.setLock,
        { entityIds: [entity.id], locked: next.locked },
        next.locked
          ? (zh ? `锁定 ${entity.name}` : `Lock ${entity.name}`)
          : (zh ? `解锁 ${entity.name}` : `Unlock ${entity.name}`),
      ))}
    />
  )
}

function AppearanceInspector({
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
    backgroundColor: v.pipe(
      v.string(),
      v.title(zh ? '背景颜色' : 'Background'),
      v.metadata({ propertyPanel: { editor: 'color' } }),
    ),
    borderColor: v.pipe(
      v.string(),
      v.title(zh ? '边框颜色' : 'Border color'),
      v.metadata({ propertyPanel: { editor: 'color' } }),
    ),
    borderWidth: v.pipe(
      v.number(),
      v.minValue(0),
      v.title(zh ? '边框宽度' : 'Border width'),
      v.metadata({ propertyPanel: { editor: 'stroke-width' } }),
    ),
    borderRadius: v.pipe(
      v.number(),
      v.minValue(0),
      v.title(zh ? '圆角' : 'Corner radius'),
      v.metadata({ propertyPanel: { editor: 'corner-radius' } }),
    ),
    opacity: v.pipe(
      v.number(),
      v.minValue(0),
      v.maxValue(1),
      v.title(zh ? '透明度' : 'Opacity'),
      v.metadata({ propertyPanel: { editor: 'opacity' } }),
    ),
  }), [zh])
  const appearance = resolveComposeAppearance(entity)
  const value = {
    backgroundColor: appearance.backgroundColor,
    borderColor: appearance.borderColor,
    borderWidth: appearance.borderWidth,
    borderRadius: appearance.borderRadius,
    opacity: appearance.opacity,
  }
  return (
    <ComposePropertyPanel
      aria-label={zh ? '外观属性' : 'Appearance properties'}
      readOnly={readOnly}
      schema={schema}
      value={value}
      onValueChange={(next) => {
        const current = getComposeAppearance(entity)
        const appearanceValue: ComposeAppearance = {
          ...current,
          ...next,
        }
        dispatch(command(
          idFactory,
          entity,
          BUILTIN_COMMAND_TYPES.setAppearance,
          { entityId: entity.id, appearance: appearanceValue },
          zh ? `修改 ${entity.name} 外观` : `Update ${entity.name} appearance`,
        ))
      }}
    />
  )
}

function ContainerInspector({
  entity,
  dispatch,
  idFactory,
  readOnly,
  zh,
}: Omit<EntityInspectorProps, 'document' | 'registry'> & {
  readonly readOnly: boolean
  readonly zh: boolean
}) {
  const hierarchy = getComposeHierarchy(entity)
  const clip = getComposeClip(entity)
  const childCountSchema = useMemo(() => v.object({
    childCount: v.pipe(
      v.number(),
      v.title(zh ? '子项数量' : 'Child count'),
      v.metadata({ propertyPanel: { readOnly: true } }),
    ),
  }), [zh])
  const schema = useMemo(() => v.object({
    childCount: v.pipe(
      v.number(),
      v.title(zh ? '子项数量' : 'Child count'),
      v.metadata({ propertyPanel: { readOnly: true } }),
    ),
    clip: v.pipe(v.boolean(), v.title(zh ? '裁剪内容' : 'Clip content')),
  }), [zh])
  if (!hierarchy) return null
  if (!clip) {
    return (
      <ComposePropertyPanel
        aria-label={zh ? '容器属性' : 'Container properties'}
        readOnly
        schema={childCountSchema}
        value={{ childCount: hierarchy.childIds.length }}
      />
    )
  }
  return (
    <ComposePropertyPanel
      aria-label={zh ? '容器属性' : 'Container properties'}
      readOnly={readOnly}
      schema={schema}
      value={{
        childCount: hierarchy.childIds.length,
        clip: clip.enabled,
      }}
      onValueChange={(next) => {
        if (readOnly) return
        dispatch(command(
          idFactory,
          entity,
          BUILTIN_COMMAND_TYPES.setClip,
          { entityIds: [entity.id], enabled: next.clip },
          zh ? `修改 ${entity.name} 裁剪` : `Update ${entity.name} clipping`,
        ))
      }}
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

function ConstraintsInspector({
  entity,
  dispatch,
  idFactory,
  readOnly,
  zh,
}: Omit<EntityInspectorProps, 'document' | 'registry'> & {
  readonly readOnly: boolean
  readonly zh: boolean
}) {
  const constraints = getComposeTransformConstraints(entity)
  const schema = useMemo(() => v.object({
    movable: v.pipe(v.boolean(), v.title(zh ? '允许移动' : 'Movable')),
    resize: v.pipe(
      v.picklist(['free', 'preserve-aspect', 'horizontal', 'vertical', 'none']),
      v.title(zh ? 'Resize 模式' : 'Resize mode'),
      v.metadata({ propertyPanel: { optionLabels: zh
        ? {
            free: '自由',
            'preserve-aspect': '保持比例',
            horizontal: '仅水平',
            vertical: '仅垂直',
            none: '禁止',
          }
        : {
            free: 'Free',
            'preserve-aspect': 'Preserve aspect',
            horizontal: 'Horizontal only',
            vertical: 'Vertical only',
            none: 'Disabled',
          } } }),
    ),
    rotatable: v.pipe(v.boolean(), v.title(zh ? '允许旋转' : 'Rotatable')),
    minSize: v.pipe(
      v.object({
        width: v.pipe(v.number(), v.minValue(0.000_001)),
        height: v.pipe(v.number(), v.minValue(0.000_001)),
      }),
      v.title(zh ? '最小尺寸' : 'Minimum size'),
      v.metadata({ propertyPanel: { editor: 'size' } }),
    ),
  }), [zh])
  if (!constraints) return null
  return (
    <ComposePropertyPanel
      aria-label={zh ? '几何限制属性' : 'Geometry constraints'}
      readOnly={readOnly}
      schema={schema}
      value={{
        movable: constraints.movable,
        resize: constraints.resize,
        rotatable: constraints.rotatable,
        minSize: constraints.minSize,
      }}
      onValueChange={(next) => {
        const value: ComposeTransformConstraints = {
          ...constraints,
          ...next,
        }
        dispatch(command(
          idFactory,
          entity,
          BUILTIN_COMMAND_TYPES.updateComponent,
          { entityId: entity.id, key: 'TransformConstraints', value },
          zh ? `修改 ${entity.name} 几何限制` : `Update ${entity.name} constraints`,
        ))
      }}
    />
  )
}

/** 按 Registry 顺序聚合当前 Entity 的 Component、Renderer 与能力操作。 */
export function EntityInspector({
  document,
  entity,
  registry,
  dispatch,
  idFactory,
}: EntityInspectorProps) {
  const zh = (useComposeI18nContext()?.locale ?? 'zh-CN') === 'zh-CN'
  const locked = getComposeLock(entity).locked
  const renderer = getComposeRenderer(entity)
  const rendererDefinition = renderer
    ? registry.getRenderer(renderer.type)
    : undefined
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
        <label>
          <span>{zh ? '添加能力' : 'Add capability'}</span>
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
            const removal = registry.planRemoveCapability(
              document,
              entity.id,
              capabilityId,
              () => '__availability__',
            )
            return (
              <div key={capabilityId}>
                <span title={definition?.description}>
                  {definition?.label ?? `${zh ? '未知能力' : 'Unknown capability'}: ${capabilityId}`}
                </span>
                <ComposeButton
                  aria-label={zh
                    ? `移除${definition?.label ?? capabilityId}`
                    : `Remove ${definition?.label ?? capabilityId}`}
                  disabled={item?.disabled || !removal.ok}
                  size="xs"
                  title={removal.ok ? undefined : removal.issue.message}
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
        <ComposePropertyPanelSection title={zh ? '基础' : 'Identity'}>
          <IdentityInspector
            dispatch={dispatch}
            entity={entity}
            idFactory={idFactory}
            readOnly={locked}
            zh={zh}
          />
        </ComposePropertyPanelSection>
        {registry.listComponents()
          .filter((definition) =>
            !definition.hidden && entity.components[definition.key])
          .map((definition) => {
            let content: React.ReactNode
            if (definition.key === 'Transform') {
              content = (
                <TransformInspector
                  dispatch={dispatch}
                  entity={entity}
                  idFactory={idFactory}
                  readOnly={locked}
                  zh={zh}
                />
              )
            }
            else if (definition.key === 'Visibility') {
              content = (
                <StateInspector
                  dispatch={dispatch}
                  entity={entity}
                  idFactory={idFactory}
                  readOnly={locked}
                  zh={zh}
                />
              )
            }
            else if (definition.key === 'Lock') {
              content = (
                <LockInspector
                  dispatch={dispatch}
                  entity={entity}
                  idFactory={idFactory}
                  zh={zh}
                />
              )
            }
            else if (definition.key === 'Appearance') {
              content = (
                <AppearanceInspector
                  dispatch={dispatch}
                  entity={entity}
                  idFactory={idFactory}
                  readOnly={locked}
                  zh={zh}
                />
              )
            }
            else if (definition.key === 'Hierarchy') {
              content = (
                <ContainerInspector
                  dispatch={dispatch}
                  entity={entity}
                  idFactory={idFactory}
                  readOnly={locked}
                  zh={zh}
                />
              )
            }
            else if (definition.key === 'Clip') return null
            else if (definition.key === 'TransformConstraints') {
              content = (
                <ConstraintsInspector
                  dispatch={dispatch}
                  entity={entity}
                  idFactory={idFactory}
                  readOnly={locked}
                  zh={zh}
                />
              )
            }
            else {
              if (!definition.inspector) return null
              content = (
                <ComposeRegistryComponentInspector
                  componentKey={definition.key}
                  dispatch={dispatch}
                  entity={entity}
                  readOnly={locked}
                  registry={registry}
                />
              )
            }
            return (
              <ComposePropertyPanelSection key={definition.key} title={definition.label}>
                {content}
              </ComposePropertyPanelSection>
            )
          })}

        {Object.keys(entity.components)
          .filter((key) => !CUSTOM_COMPONENT_KEYS.has(key) && !registry.getComponent(key))
          .map((key) => (
            <ComposePropertyPanelSection key={key} title={key}>
              <UnknownInspector
                label={zh ? '未知能力' : 'Unknown capability'}
                message={zh ? `未知能力：${key}` : `Unknown capability: ${key}`}
              />
            </ComposePropertyPanelSection>
          ))}

        {renderer && (!rendererDefinition || rendererDefinition.inspector) ? (
          <ComposePropertyPanelSection
            title={registry.getComponent('Renderer')?.label ?? (zh ? '内容' : 'Content')}
          >
            {rendererDefinition ? (
              <ComposeRegistryRendererInspector
                dispatch={dispatch}
                entity={entity}
                readOnly={locked}
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
