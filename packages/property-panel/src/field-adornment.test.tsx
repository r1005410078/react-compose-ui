import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as v from 'valibot'
import { ComposePropertyPanel } from './property-panel/compose-property-panel'
import type { PropertyPanelFieldAdornmentContext } from './property-panel/compose-property-panel'

afterEach(cleanup)

const schema = v.object({
  // 语义 editor 字段：走 renderer 分支。
  offset: v.pipe(
    v.object({ x: v.number(), y: v.number() }),
    v.title('位置'),
    v.metadata({ propertyPanel: { editor: 'vector2' } }),
  ),
  // 基础 primitive 字段：走 PrimitiveField 分支。
  name: v.pipe(v.string(), v.title('名称')),
  // 可缺省字段：未设置时走 PropertyRow 空状态分支。
  // title 必须在 optional 外层：内层 title 取不到，标签会退化成 key 派生的 `Note`。
  note: v.pipe(v.optional(v.string()), v.title('备注')),
})

const value = { offset: { x: 1, y: 2 }, name: '矩形' }

function adornmentPaths(container: HTMLElement) {
  return [...container.querySelectorAll('[data-property-part="adornment"]')]
    .map((node) => node.closest('[data-property-path]')?.getAttribute('data-property-path'))
}

describe('OpenSpec: property-panel / 字段标签装饰插槽', () => {
  it('在语义 editor、基础 primitive 与空状态三种字段上都渲染装饰', () => {
    const seen: PropertyPanelFieldAdornmentContext[] = []
    const view = render(
      <ComposePropertyPanel
        renderFieldAdornment={(context) => {
          seen.push(context)
          return <button type="button">键 {context.label}</button>
        }}
        schema={schema}
        value={value}
      />,
    )
    expect(adornmentPaths(view.container).sort()).toEqual(['name', 'note', 'offset'])
    expect(screen.getByRole('button', { name: '键 位置' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '键 名称' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '键 备注' })).toBeTruthy()
  })

  it('每个字段收到自己的路径、Schema、metadata 与当前值', () => {
    const seen = new Map<string, PropertyPanelFieldAdornmentContext>()
    render(
      <ComposePropertyPanel
        renderFieldAdornment={(context) => {
          seen.set(context.path.join('.'), context)
          return null
        }}
        schema={schema}
        value={value}
      />,
    )
    expect(seen.get('offset')?.value).toEqual({ x: 1, y: 2 })
    expect(seen.get('offset')?.metadata.editor).toBe('vector2')
    expect(seen.get('offset')?.label).toBe('位置')
    expect(seen.get('name')?.value).toBe('矩形')
    // 未设置的可缺省字段值为 undefined，宿主据此可以禁用打点入口。
    expect(seen.get('note')?.value).toBeUndefined()
    expect(seen.get('note')?.schema).toBeDefined()
  })

  it('装饰不挤占右侧动作栏', () => {
    const view = render(
      <ComposePropertyPanel
        defaultValue={{ offset: { x: 0, y: 0 }, name: '默认' }}
        renderFieldAdornment={() => <button type="button">键</button>}
        schema={schema}
        value={value}
      />,
    )
    const nameRow = view.container.querySelector('[data-property-path="name"]')
    expect(nameRow?.querySelector('[data-property-part="adornment"]')).toBeTruthy()
    // 值与 defaultValue 不同，重置动作必须仍然直接可见，而不是被挤进溢出菜单。
    const actions = nameRow?.querySelector('[data-property-part="actions"]')
    expect(actions?.querySelector('button')).toBeTruthy()
  })

  it('返回 null 时不渲染装饰容器', () => {
    const view = render(
      <ComposePropertyPanel renderFieldAdornment={() => null} schema={schema} value={value} />,
    )
    expect(view.container.querySelector('[data-property-part="adornment"]')).toBeNull()
  })

  it('未提供插槽时字段行不渲染装饰容器', () => {
    const view = render(<ComposePropertyPanel schema={schema} value={value} />)
    expect(view.container.querySelector('[data-property-part="adornment"]')).toBeNull()
  })

  it('合成的 union 分支行不渲染装饰', () => {
    const unionSchema = v.object({
      paint: v.pipe(
        v.union([
          v.pipe(v.object({ kind: v.literal('solid') }), v.title('纯色')),
          v.pipe(v.object({ kind: v.literal('none') }), v.title('无')),
        ]),
        v.title('填充'),
      ),
    })
    const render1 = vi.fn(() => <span>键</span>)
    const view = render(
      <ComposePropertyPanel
        renderFieldAdornment={render1}
        schema={unionSchema}
        value={{ paint: { kind: 'solid' } }}
      />,
    )
    const paths = adornmentPaths(view.container)
    // `$branch` 是分支选择器的合成行，不是属性，不该长出打点入口。
    expect(paths).not.toContain('paint.$branch')
  })
})
