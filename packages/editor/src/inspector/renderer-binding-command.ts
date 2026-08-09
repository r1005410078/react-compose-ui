import {
  BUILTIN_COMMAND_TYPES,
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  getComposeBindings,
  type ComposeEntity,
  type EditorCommand,
  type JsonObject,
} from '@compose-ui/core'

/** Renderer Props 的可持久化绑定目标。 @internal */
export type RendererBindingCommandTarget =
  { readonly kind: 'field'; readonly propName: string }

/** 为一次 Renderer Props 绑定变更构造可撤销命令。 @internal */
export function createRendererBindingCommand(input: {
  readonly entity: ComposeEntity
  readonly target: RendererBindingCommandTarget
  readonly exportName: string | null
  readonly idFactory: () => string
}): EditorCommand | null {
  const current = getComposeBindings(input.entity)
  const fields: Record<string, { scope: 'page'; exportName: string }> = {
    ...(current?.rendererProps.fields ?? {}),
  }
  if (input.exportName === null) delete fields[input.target.propName]
  else fields[input.target.propName] = { scope: 'page', exportName: input.exportName }
  if (!current && Object.keys(fields).length === 0) return null

  const removing = Object.keys(fields).length === 0
  const targetName = input.target.propName
  return {
    id: input.idFactory(),
    type: removing
      ? BUILTIN_COMMAND_TYPES.removeComponent
      : current
        ? BUILTIN_COMMAND_TYPES.updateComponent
        : BUILTIN_COMMAND_TYPES.addComponent,
    payload: removing
      ? { entityId: input.entity.id, key: COMPOSE_BUILTIN_COMPONENT_KEYS.bindings }
      : {
          entityId: input.entity.id,
          key: COMPOSE_BUILTIN_COMPONENT_KEYS.bindings,
          value: { version: 1, rendererProps: { fields } } as JsonObject,
        },
    meta: {
      label: input.exportName === null
        ? `解绑 ${targetName}`
        : `绑定 ${targetName} → ${input.exportName}`,
      source: 'inspector',
      targetIds: [input.entity.id],
      mergeKey: `inspector:${input.entity.id}:binding:${input.target.propName}`,
    },
  }
}
