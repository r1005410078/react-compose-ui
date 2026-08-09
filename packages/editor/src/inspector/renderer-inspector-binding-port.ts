import { useSyncExternalStore } from 'react'
import {
  resolveComposeRendererRuntimeProps,
  type ComposeRendererDefinition,
  type ComposeRendererInspectorBindingPort,
} from '@compose-ui/component-registry'
import {
  getComposeBindings,
  type ComposeEntity,
  type EditorCommand,
} from '@compose-ui/core'
import type { ComposePageScriptScope } from '@compose-ui/script-runtime'
import { createRendererBindingCommand } from './renderer-binding-command'

const EMPTY_SCOPE_SNAPSHOT = { exports: [], diagnostics: [], disposed: false } as const
const subscribeEmptyScope = () => () => undefined
const getEmptyScopeSnapshot = () => EMPTY_SCOPE_SNAPSHOT

/** 为当前 Renderer Inspector 组合页面作用域、解析结果和文档绑定命令。 @internal */
export function useRendererInspectorBindingPort(input: {
  readonly definition?: ComposeRendererDefinition
  readonly dispatch: (command: EditorCommand) => unknown
  readonly entity: ComposeEntity
  readonly idFactory: () => string
  readonly scope?: ComposePageScriptScope
}): ComposeRendererInspectorBindingPort | undefined {
  const snapshot = useSyncExternalStore(
    input.scope?.subscribe ?? subscribeEmptyScope,
    input.scope?.getSnapshot ?? getEmptyScopeSnapshot,
    input.scope?.getSnapshot ?? getEmptyScopeSnapshot,
  )
  const definition = input.definition
  if (!definition) return undefined
  const bindings = getComposeBindings(input.entity)
  const resolved = resolveComposeRendererRuntimeProps({
    entity: input.entity,
    definition,
    scope: input.scope,
    methodMode: 'noop',
  })
  const variables = snapshot.exports.map((item) => ({
    id: item.name,
    label: item.name,
    kind: item.kind,
    value: item.kind === 'value' ? item.value : item.method,
  }))
  const fields = Object.fromEntries((definition.propContracts ?? []).map((contract) => [
    contract.name,
    {
      exportName: bindings?.rendererProps.fields[contract.name]?.exportName ?? null,
      error: resolved.diagnostics.find((item) => (
        item.target.kind === 'field' && item.target.propName === contract.name
      ))?.message,
    },
  ]))
  const dispatchBinding = (
    target: { readonly kind: 'field'; readonly propName: string },
    exportName: string | null,
  ) => {
    const command = createRendererBindingCommand({
      entity: input.entity,
      target,
      exportName,
      idFactory: input.idFactory,
    })
    if (command) input.dispatch(command)
  }
  return {
    variables,
    fields,
    inspectorPropNames: definition.inspectorPropNames ?? [],
    baseProps: resolved.baseProps,
    props: resolved.props,
    setField: (propName, exportName) => {
      dispatchBinding({ kind: 'field', propName }, exportName)
    },
  }
}
