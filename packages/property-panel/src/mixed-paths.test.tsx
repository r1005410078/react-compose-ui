import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as v from 'valibot'
import { ComposePropertyPanel } from './property-panel/compose-property-panel'

afterEach(cleanup)

const schema = v.object({
  stroke: v.pipe(
    v.string(),
    v.title('线条颜色'),
    v.metadata({ propertyPanel: { editor: 'color' } }),
  ),
  strokeWidth: v.pipe(v.number(), v.title('线条粗细')),
})

const value = { stroke: '#ff3b30', strokeWidth: 2 }

function field(container: HTMLElement, path: string) {
  return container.querySelector(`[data-property-path="${path}"]`)
}

describe('OpenSpec: property-panel / 混合值字段', () => {
  it('列出的字段带可读标记与 data-property-mixed', () => {
    const view = render(
      <ComposePropertyPanel mixedPaths={[['strokeWidth']]} schema={schema} value={value} />,
    )
    expect(field(view.container, 'strokeWidth')?.getAttribute('data-property-mixed')).toBe('true')
    expect(screen.getByText('多个值')).toBeTruthy()
  })

  it('未列出的字段不受影响', () => {
    const view = render(
      <ComposePropertyPanel mixedPaths={[['strokeWidth']]} schema={schema} value={value} />,
    )
    expect(field(view.container, 'stroke')?.getAttribute('data-property-mixed')).toBeNull()
  })

  it('不提供清单时所有字段都不是混合', () => {
    const view = render(<ComposePropertyPanel schema={schema} value={value} />)
    expect(view.container.querySelector('[data-property-mixed]')).toBeNull()
    expect(screen.queryByText('多个值')).toBeNull()
  })

  it('混合字段照常可写', () => {
    const onValueChange = vi.fn()
    render(
      <ComposePropertyPanel
        mixedPaths={[['strokeWidth']]}
        schema={schema}
        value={value}
        onValueChange={onValueChange}
      />,
    )
    const input = screen.getByLabelText('线条粗细')
    fireEvent.change(input, { target: { value: '3' } })
    fireEvent.blur(input)
    expect(onValueChange).toHaveBeenCalled()
    const calls = onValueChange.mock.calls
    expect(calls[calls.length - 1]?.[0]).toMatchObject({ strokeWidth: 3 })
  })
})
