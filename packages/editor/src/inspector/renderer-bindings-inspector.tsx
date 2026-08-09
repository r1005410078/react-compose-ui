import type {
  ComposeRendererDefinition,
  ComposeRendererInspectorBindingPort,
} from '@compose-ui/component-registry'
import {
  ComposePropertyPanelBindingTargetRow,
  type ComposePropertyPanelVariable,
} from '@compose-ui/property-panel'

function toPropertyPanelVariables(
  variables: ComposeRendererInspectorBindingPort['variables'],
): readonly ComposePropertyPanelVariable[] {
  return variables.map((item) => ({ ...item, scope: 'page' as const }))
}

/** 自定义 Inspector 未内联呈现的 Contract fallback 行。 @internal */
export function RendererBindingOnlyRows({
  categoryId,
  definition,
  port,
  readOnly,
}: {
  readonly categoryId?: string
  readonly definition: ComposeRendererDefinition
  readonly port: ComposeRendererInspectorBindingPort
  readonly readOnly: boolean
}) {
  const inline = new Set(definition.inspectorPropNames ?? [])
  const variables = toPropertyPanelVariables(port.variables)
  return definition.propContracts?.filter((contract) => (
    contract.category === categoryId && !inline.has(contract.name)
  )).map((contract) => (
    <ComposePropertyPanelBindingTargetRow
      error={port.fields[contract.name]?.error}
      key={contract.name}
      kind={contract.kind}
      label={contract.label}
      readOnly={readOnly}
      validateVariable={contract.kind === 'value'
        ? (variable) => {
            try {
              return contract.validate(variable.value) === true
            }
            catch {
              return false
            }
          }
        : undefined}
      value={port.fields[contract.name]?.exportName ?? null}
      variables={variables}
      onChange={(exportName) => { port.setField(contract.name, exportName) }}
    />
  )) ?? null
}
