import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ComposeThemeProvider } from '@compose-ui/ui-context'
import * as publicApi from '../index'
import { ComposeInput, type ComposeInputProps } from '../index'

const inputContractFixture: ComposeInputProps = {
  'aria-label': '文件名',
  'data-asset-id': 'asset-1',
  id: 'asset-name',
  placeholder: 'untitled.ts',
}

afterEach(cleanup)

describe('ComposeInput', () => {
  it('OpenSpec: components / Shadcn source-owned shared primitive foundation / 以 Compose 命名公开 Input', () => {
    expect(publicApi).toHaveProperty('ComposeInput')
    expect(publicApi).not.toHaveProperty('Input')
  })

  it('OpenSpec: components / Shadcn primitives follow Compose theme boundaries / 保留输入语义和宿主数据属性', () => {
    render(<ComposeInput {...inputContractFixture} />)

    const input = screen.getByRole('textbox', { name: '文件名' })
    expect(input).toHaveAttribute('id', 'asset-name')
    expect(input).toHaveAttribute('data-asset-id', 'asset-1')
    expect(input).toHaveAttribute('placeholder', 'untitled.ts')
    expect(input).toHaveAttribute('data-compose-theme', 'dark')
  })

  it('OpenSpec: components / Shadcn primitives follow Compose theme boundaries / 接收 Light token override', () => {
    render(
      <ComposeThemeProvider overrides={{ light: { focus: '#7c3aed' } }} theme="light">
        <ComposeInput aria-label="覆盖输入" />
      </ComposeThemeProvider>,
    )

    const input = screen.getByRole('textbox', { name: '覆盖输入' })
    expect(input).toHaveAttribute('data-compose-theme', 'light')
    expect(input).toHaveStyle({ '--compose-focus': '#7c3aed' })
  })
})

describe('OpenSpec: components / 输入框尺寸变体', () => {
  it('默认尺寸保持既有高度，紧凑变体供密集面板使用', () => {
    const view = render(
      <>
        <ComposeInput aria-label="默认" />
        <ComposeInput aria-label="紧凑" size="xs" />
      </>,
    )
    const defaultInput = view.getByLabelText('默认')
    const compactInput = view.getByLabelText('紧凑')
    // 未传 size 时行为不变，既有消费方不受影响。
    expect(defaultInput.className).toContain('cu:h-9')
    expect(compactInput.className).not.toContain('cu:h-9')
    expect(compactInput.className).toContain('cu:h-[22px]')
  })
})
