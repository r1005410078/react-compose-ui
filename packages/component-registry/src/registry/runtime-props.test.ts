import type { ComposeEntity } from '@compose-ui/core'
import { createComposePageScriptScope } from '@compose-ui/script-runtime'
import { describe, expect, it, vi } from 'vitest'
import { resolveComposeRendererRuntimeProps } from './runtime-props'
import type { ComposeRendererDefinition } from './types'

const definition: ComposeRendererDefinition = {
  type: 'counter',
  label: '计数器',
  renderer: () => null,
  propContracts: [
    {
      name: 'text',
      kind: 'value',
      label: '文本',
      validate: (value) => typeof value === 'number' || '必须是 number',
    },
    { name: 'onClick', kind: 'method', label: '点击', role: 'event-handler' },
  ],
}

function entity(input: {
  fields?: Record<string, { scope: 'page'; exportName: string }>
}): ComposeEntity {
  return {
    id: 'counter-1',
    name: 'Counter',
    components: {
      Composition: { presetId: null, baseComponentKeys: [], capabilityIds: [] },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 0, y: 0 },
        width: { mode: 'fixed', value: 100, min: null, max: null },
        height: { mode: 'fixed', value: 40, min: null, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Renderer: { type: 'counter', props: { text: 7, tone: 'blue' } },
      Bindings: {
        version: 1,
        rendererProps: { fields: input.fields ?? {} },
      },
    },
  }
}

describe('OpenSpec: component-registry / Authored 与 Runtime Props 分离', () => {
  it('值覆盖字面 Prop，方法注入 wrapper 且 authored Props 不变', () => {
    const method = vi.fn()
    const scope = createComposePageScriptScope(() => ({ text: 12, onAdd: method }))
    const target = entity({ fields: {
      text: { scope: 'page', exportName: 'text' },
      onClick: { scope: 'page', exportName: 'onAdd' },
    },
    })

    const result = resolveComposeRendererRuntimeProps({
      entity: target,
      definition,
      scope,
      methodMode: 'invoke',
    })
    expect(result.authoredProps).toEqual({ text: 7, tone: 'blue' })
    expect(result.props).toMatchObject({ text: 12, tone: 'blue', onClick: expect.any(Function) })
    const onClick = result.props.onClick as ((event: string) => void)
    onClick('event')
    expect(method).toHaveBeenCalledWith('event')
    expect(target.components.Renderer?.props).toEqual({ text: 7, tone: 'blue' })
  })

  it('缺失、kind 不匹配、validator 拒绝与异常都隔离并回退', () => {
    const throwingDefinition: ComposeRendererDefinition = {
      ...definition,
      propContracts: definition.propContracts?.map((contract) => contract.name === 'text'
        ? { ...contract, validate: () => { throw new Error('bad validator') } }
        : contract),
    }
    const scope = createComposePageScriptScope(() => ({ text: 'wrong', onAdd: 3 }))
    const result = resolveComposeRendererRuntimeProps({
      entity: entity({ fields: {
        text: { scope: 'page', exportName: 'text' },
        onClick: { scope: 'page', exportName: 'onAdd' },
        future: { scope: 'page', exportName: 'missing' },
      } }),
      definition: throwingDefinition,
      scope,
      methodMode: 'invoke',
    })
    expect(result.props).toMatchObject({ text: 7, tone: 'blue', onClick: undefined })
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      'binding.validator-threw',
      'binding.kind-mismatch',
      'binding.unknown-prop',
    ])
  })

  it('Editor method wrapper 保留存在形状但不执行脚本', () => {
    const method = vi.fn()
    const scope = createComposePageScriptScope(() => ({ onAdd: method }))
    const result = resolveComposeRendererRuntimeProps({
      entity: entity({ fields: { onClick: { scope: 'page', exportName: 'onAdd' } } }),
      definition,
      scope,
      methodMode: 'noop',
    })
    expect(result.props.onClick).toBeTypeOf('function')
    const onClick = result.props.onClick as (() => void)
    onClick()
    expect(method).not.toHaveBeenCalled()
  })

  it('OpenSpec: component-registry / Authored 与 Runtime Props 分离 / 字段事件方法按模式包装', async () => {
    const method = vi.fn(() => Promise.reject(new Error('rejected')))
    const scope = createComposePageScriptScope(() => ({ onAdd: method }))
    const preview = resolveComposeRendererRuntimeProps({
      entity: entity({ fields: { onClick: { scope: 'page', exportName: 'onAdd' } } }),
      definition,
      scope,
      methodMode: 'invoke',
    })
    const onClick = preview.props.onClick as (value: string) => void
    onClick('event')
    await Promise.resolve()
    await Promise.resolve()
    expect(method).toHaveBeenCalledWith('event')
    expect(scope.getSnapshot().diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'script.method-rejected', exportName: 'onAdd' }),
    ]))

    method.mockClear()
    const editor = resolveComposeRendererRuntimeProps({
      entity: entity({ fields: { onClick: { scope: 'page', exportName: 'onAdd' } } }),
      definition,
      scope,
      methodMode: 'noop',
    })
    ;(editor.props.onClick as () => void)()
    expect(method).not.toHaveBeenCalled()

    const throwingScope = createComposePageScriptScope(() => ({
      onAdd: () => { throw new Error('threw') },
    }))
    const throwing = resolveComposeRendererRuntimeProps({
      entity: entity({ fields: { onClick: { scope: 'page', exportName: 'onAdd' } } }),
      definition,
      scope: throwingScope,
      methodMode: 'invoke',
    })
    ;(throwing.props.onClick as () => void)()
    expect(throwingScope.getSnapshot().diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'script.method-threw', exportName: 'onAdd' }),
    ]))
  })
})
