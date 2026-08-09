import {
  getComposeBindings,
  getComposeRenderer,
  type ComposeEntity,
  type JsonObject,
} from '@compose-ui/core'
import type { ComposePageScriptScope } from '@compose-ui/script-runtime'
import type {
  ComposeRendererBindingDiagnostic,
  ComposeRendererDefinition,
  ComposeRuntimeProps,
} from './types'

/** 一次纯 Renderer 绑定解析结果。 @public */
export interface ComposeRendererRuntimePropsResult {
  readonly props: ComposeRuntimeProps
  readonly authoredProps: JsonObject
  readonly diagnostics: readonly ComposeRendererBindingDiagnostic[]
}

function diagnostic(
  input: Omit<ComposeRendererBindingDiagnostic, 'message'> & { readonly message: string },
): ComposeRendererBindingDiagnostic {
  return input
}

/**
 * 从 authored Props、Bindings、Prop Contract 与页面 scope 解析实际 React Props。
 *
 * @remarks
 * 本函数不修改 Entity，不发布文档事务。失败的 value 绑定保留字面值；失败的 method 绑定为
 * `undefined`。Editor 使用 no-op 方法 wrapper，Preview 才调用页面方法。
 * @public
 */
export function resolveComposeRendererRuntimeProps(input: {
  readonly entity: ComposeEntity
  readonly definition: ComposeRendererDefinition
  readonly scope?: ComposePageScriptScope
  readonly methodMode: 'noop' | 'invoke'
}): ComposeRendererRuntimePropsResult {
  const renderer = getComposeRenderer(input.entity)
  const authoredProps = renderer?.props ?? {}
  const props: Record<string, unknown> = { ...authoredProps }
  const diagnostics: ComposeRendererBindingDiagnostic[] = []
  const bindings = getComposeBindings(input.entity)
  if (!bindings) return { props, authoredProps, diagnostics }
  const contracts = new Map((input.definition.propContracts ?? []).map((item) => [item.name, item]))

  Object.entries(bindings.props).forEach(([propName, reference]) => {
    const contract = contracts.get(propName)
    const base = {
      entityId: input.entity.id,
      propName,
      exportName: reference.exportName,
    }
    if (!contract) {
      diagnostics.push(diagnostic({
        ...base,
        code: 'binding.unknown-prop',
        message: `Renderer 未声明可绑定 Prop ${propName}`,
      }))
      return
    }
    const exported = input.scope?.getExport(reference.exportName)
    if (!exported) {
      if (contract.kind === 'method') props[propName] = undefined
      diagnostics.push(diagnostic({
        ...base,
        code: 'binding.missing-export',
        message: `页面返回成员 ${reference.exportName} 不存在`,
      }))
      return
    }
    if (exported.kind !== contract.kind) {
      if (contract.kind === 'method') props[propName] = undefined
      diagnostics.push(diagnostic({
        ...base,
        code: 'binding.kind-mismatch',
        message: `${reference.exportName} 不能绑定到 ${contract.kind} Prop`,
      }))
      return
    }
    if (contract.kind === 'method' && exported.kind === 'method') {
      props[propName] = input.methodMode === 'noop'
        ? () => undefined
        : (...args: unknown[]) => { input.scope?.invokeMethod(reference.exportName, args) }
      return
    }
    if (contract.kind !== 'value' || exported.kind !== 'value') return
    let verdict: true | string
    try {
      verdict = contract.validate(exported.value)
    }
    catch (cause) {
      diagnostics.push(diagnostic({
        ...base,
        code: 'binding.validator-threw',
        message: `Prop ${propName} validator 执行失败`,
        cause,
      }))
      return
    }
    if (verdict !== true) {
      diagnostics.push(diagnostic({
        ...base,
        code: 'binding.validation-failed',
        message: verdict,
      }))
      return
    }
    props[propName] = exported.value
  })

  return { props, authoredProps, diagnostics }
}
