import { useSyncExternalStore } from 'react'
import {
  resolveComposeRendererRuntimeProps,
  type ComposeRendererDefinition,
} from '@compose-ui/component-registry'
import {
  getComposeBindings,
  type ComposeEntity,
  type EditorCommand,
} from '@compose-ui/core'
import { ComposePropertyPanelBindingTargetRow } from '@compose-ui/property-panel'
import type { ComposePageScriptScope } from '@compose-ui/script-runtime'
import { createRendererBindingCommand } from './renderer-binding-command'

const EMPTY_SCOPE_SNAPSHOT = { exports: [], diagnostics: [], disposed: false } as const
const subscribeEmptyScope = () => () => undefined
const getEmptyScopeSnapshot = () => EMPTY_SCOPE_SNAPSHOT

/** Registry Prop Contract 与页面返回作用域的 Editor 聚合。 @internal */
export function RendererBindingsInspector({
  definition,
  dispatch,
  entity,
  idFactory,
  readOnly,
  scope,
}: {
  readonly definition: ComposeRendererDefinition
  readonly dispatch: (command: EditorCommand) => unknown
  readonly entity: ComposeEntity
  readonly idFactory: () => string
  readonly readOnly: boolean
  readonly scope?: ComposePageScriptScope
}) {
  const snapshot = useSyncExternalStore(
    scope?.subscribe ?? subscribeEmptyScope,
    scope?.getSnapshot ?? getEmptyScopeSnapshot,
    scope?.getSnapshot ?? getEmptyScopeSnapshot,
  )
  const bindings = getComposeBindings(entity)
  const variables = snapshot.exports.map((item) => ({
    id: item.name,
    label: item.name,
    scope: 'page' as const,
    kind: item.kind,
    value: item.kind === 'value' ? item.value : item.method,
  }))
  const resolved = resolveComposeRendererRuntimeProps({
    entity,
    definition,
    scope,
    methodMode: 'noop',
  })

  return (
    <div className="compose-editor__renderer-bindings">
      {definition.propContracts?.map((contract) => {
        const current = bindings?.props[contract.name]?.exportName ?? null
        const error = resolved.diagnostics.find((item) => item.propName === contract.name)?.message
        return (
          <ComposePropertyPanelBindingTargetRow
            error={error}
            key={contract.name}
            kind={contract.kind}
            label={contract.label}
            readOnly={readOnly}
            value={current}
            variables={variables}
            onChange={(exportName) => {
              const command = createRendererBindingCommand({
                entity,
                propName: contract.name,
                exportName,
                idFactory,
              })
              if (command) dispatch(command)
            }}
          />
        )
      })}
    </div>
  )
}
