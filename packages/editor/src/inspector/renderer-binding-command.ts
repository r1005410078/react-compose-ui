import {
  BUILTIN_COMMAND_TYPES,
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  getComposeBindings,
  type ComposeEntity,
  type EditorCommand,
  type JsonObject,
} from '@compose-ui/core'

/** 为一次顶层 Renderer Prop 绑定变更构造可撤销命令。 @internal */
export function createRendererBindingCommand(input: {
  readonly entity: ComposeEntity
  readonly propName: string
  readonly exportName: string | null
  readonly idFactory: () => string
}): EditorCommand | null {
  const current = getComposeBindings(input.entity)
  const props: Record<string, { scope: 'page'; exportName: string }> = {
    ...(current?.props ?? {}),
  }
  if (input.exportName === null) delete props[input.propName]
  else props[input.propName] = { scope: 'page', exportName: input.exportName }
  if (!current && Object.keys(props).length === 0) return null

  const removing = Object.keys(props).length === 0
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
          value: { version: 1, props } as JsonObject,
        },
    meta: {
      label: input.exportName === null
        ? `解绑 ${input.propName}`
        : `绑定 ${input.propName} → ${input.exportName}`,
      source: 'inspector',
      targetIds: [input.entity.id],
      mergeKey: `inspector:${input.entity.id}:binding:${input.propName}`,
    },
  }
}
