import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposePropertyPanelBindingTargetRow } from './binding-target-row'

afterEach(cleanup)

const variables = [
  { id: 'num', label: 'Number', scope: 'page' as const, kind: 'value' as const, value: 1 },
  { id: 'onAdd', label: 'Add', scope: 'page' as const, kind: 'method' as const, value: undefined },
  { id: 'onReset', label: 'Reset', scope: 'page' as const, kind: 'method' as const, value: undefined },
]

describe('OpenSpec: property-panel / 无字面值方法绑定目标', () => {
  it('只列出 method source，并支持搜索、绑定与解绑', () => {
    const onChange = vi.fn()
    const view = render(
      <ComposePropertyPanelBindingTargetRow
        kind="method"
        label="onClick"
        onChange={onChange}
        value={null}
        variables={variables}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /绑定 onClick/u }))
    expect(screen.queryByRole('button', { name: 'Number' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'reset' } })
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(onChange).toHaveBeenCalledWith('onReset')

    view.rerender(
      <ComposePropertyPanelBindingTargetRow
        kind="method"
        label="onClick"
        onChange={onChange}
        value="onReset"
        variables={variables}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    fireEvent.click(screen.getByRole('button', { name: '解绑' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('缺失成员显示现有 ID 与错误，只读时不能换绑或解绑', () => {
    render(
      <ComposePropertyPanelBindingTargetRow
        error="返回成员不存在"
        kind="method"
        label="onClick"
        onChange={vi.fn()}
        readOnly
        value="missingMethod"
        variables={variables}
      />,
    )
    expect(screen.getByRole('button', { name: 'missingMethod' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('返回成员不存在')
  })

  it('OpenSpec: property-panel / binding-only 候选校验 / 过滤不兼容的 value 候选', () => {
    const onChange = vi.fn()
    render(
      <ComposePropertyPanelBindingTargetRow
        kind="value"
        label="数据"
        onChange={onChange}
        validateVariable={(variable) => variable.id === 'num'}
        value={null}
        variables={variables}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /绑定\s*数据/u }))
    expect(screen.getByRole('button', { name: 'Number' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument()
  })
})
