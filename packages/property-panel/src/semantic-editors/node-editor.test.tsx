import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as v from 'valibot'
import { ComposePropertyPanel } from '../property-panel'
import type { ComposePropertyPanelNodeEditorPort } from '../property-panel'

const REFERENCE_MEDIA_TYPE = 'application/x-compose-asset-reference+json'

const schema = v.object({
  page: v.pipe(
    v.nullable(v.object({
      kind: v.literal('page'),
      assetKey: v.string(),
    })),
    v.title('页面'),
    v.metadata({ propertyPanel: { editor: 'node' } }),
  ),
})

const homeValue = { kind: 'page' as const, assetKey: 'Home.page.json' }
const detailValue = { kind: 'page' as const, assetKey: 'Detail.page.json' }

function createPort(
  overrides: Partial<ComposePropertyPanelNodeEditorPort> = {},
): ComposePropertyPanelNodeEditorPort {
  return {
    dragMediaTypes: [REFERENCE_MEDIA_TYPE],
    candidates: [
      { id: 'home', label: 'Home', value: homeValue },
      { id: 'detail', label: 'Detail', value: detailValue },
    ],
    parseDrop: (data) => {
      const text = data[REFERENCE_MEDIA_TYPE]
      return text === undefined
        ? null
        : { id: 'dropped', label: 'Detail', value: detailValue }
    },
    resolveLabel: (value) => {
      const key = (value as { assetKey?: string } | null)?.assetKey
      if (key === 'Home.page.json') return 'Home'
      if (key === 'Detail.page.json') return 'Detail'
      return `已删除的页面 (${String(key)})`
    },
    ...overrides,
  }
}

/** 构造带指定媒体类型的拖拽数据。 */
function dragData(entries: Readonly<Record<string, string>>) {
  return {
    types: Object.keys(entries),
    getData: (type: string) => entries[type] ?? '',
    dropEffect: 'none',
  }
}

type PageValue = { kind: 'page'; assetKey: string } | null

function renderPanel(options: {
  readonly value?: PageValue
  readonly port?: ComposePropertyPanelNodeEditorPort | undefined
  readonly readOnly?: boolean
} = {}) {
  const onValueChange = vi.fn()
  render(
    <ComposePropertyPanel
      aria-label="属性"
      nodeEditor={'port' in options ? options.port : createPort()}
      readOnly={options.readOnly}
      schema={schema}
      value={{ page: options.value ?? null }}
      onValueChange={onValueChange}
    />,
  )
  return { onValueChange }
}

afterEach(cleanup)

describe('OpenSpec: property-panel / node 基础属性 Editor', () => {
  it('从候选列表选择时以候选值提交一次', () => {
    const { onValueChange } = renderPanel()

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Detail' }))

    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange.mock.calls[0]?.[0]).toEqual({ page: detailValue })
    // 面板受控：测试不回写 value，因此 trigger 仍显示未设置。
    expect(screen.getByRole('combobox')).toHaveTextContent('未设置')
  })

  it('清空已有引用', () => {
    const { onValueChange } = renderPanel({ value: homeValue })

    fireEvent.click(screen.getByRole('button', { name: '清除页面' }))

    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange.mock.calls[0]?.[0]).toEqual({ page: null })
  })

  it('未知引用显示可辨识占位且不被自动清空', () => {
    const { onValueChange } = renderPanel({
      value: { kind: 'page', assetKey: 'Gone.page.json' },
    })

    expect(screen.getByRole('combobox')).toHaveTextContent('已删除的页面 (Gone.page.json)')
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('未注入端口时呈现无候选状态但仍可清空', () => {
    const { onValueChange } = renderPanel({ value: homeValue, port: undefined })

    fireEvent.click(screen.getByRole('combobox'))
    expect(within(screen.getByRole('listbox')).queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText('无可用候选')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '清除页面' }))
    expect(onValueChange.mock.calls[0]?.[0]).toEqual({ page: null })
  })

  it('只读时不提交且不显示清空入口', () => {
    const { onValueChange } = renderPanel({ value: homeValue, readOnly: true })

    expect(screen.getByRole('combobox')).toBeDisabled()
    expect(screen.queryByRole('button', { name: '清除页面' })).not.toBeInTheDocument()
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('按输入筛选候选', () => {
    renderPanel()

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.change(screen.getByLabelText('筛选页面'), { target: { value: 'det' } })

    const options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(['Detail'])
  })
})

describe('OpenSpec: property-panel / node Editor 拖入赋值', () => {
  it('接受宿主声明的拖拽并以 drop 为原因提交', () => {
    const { onValueChange } = renderPanel()
    const target = screen.getByTestId('semantic-editor-node')
    const transfer = dragData({ [REFERENCE_MEDIA_TYPE]: '{"version":1,"items":[]}' })

    fireEvent.dragOver(target, { dataTransfer: transfer })
    expect(target).toHaveAttribute('data-drop-active', 'true')

    fireEvent.drop(target, { dataTransfer: transfer })

    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange.mock.calls[0]?.[1]?.reason).toBe('drop')
    expect(onValueChange.mock.calls[0]?.[0]).toEqual({ page: detailValue })
  })

  it('拒绝只携带未声明媒体类型的拖拽', () => {
    const { onValueChange } = renderPanel()
    const target = screen.getByTestId('semantic-editor-node')
    const transfer = dragData({ 'text/plain': 'anything' })

    fireEvent.dragOver(target, { dataTransfer: transfer })
    expect(target).not.toHaveAttribute('data-drop-active')

    fireEvent.drop(target, { dataTransfer: transfer })
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('端口无法解析载荷时不产生变更', () => {
    const { onValueChange } = renderPanel({ port: createPort({ parseDrop: () => null }) })
    const target = screen.getByTestId('semantic-editor-node')
    const transfer = dragData({ [REFERENCE_MEDIA_TYPE]: 'garbage' })

    fireEvent.drop(target, { dataTransfer: transfer })

    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('只读时忽略拖入', () => {
    const { onValueChange } = renderPanel({ readOnly: true })
    const target = screen.getByTestId('semantic-editor-node')
    const transfer = dragData({ [REFERENCE_MEDIA_TYPE]: '{}' })

    fireEvent.dragOver(target, { dataTransfer: transfer })
    fireEvent.drop(target, { dataTransfer: transfer })

    expect(target).not.toHaveAttribute('data-drop-active')
    expect(onValueChange).not.toHaveBeenCalled()
  })
})

describe('OpenSpec: property-panel / node Editor 键盘与 ARIA', () => {
  it('trigger 暴露 combobox 语义并在展开时关联 listbox', () => {
    renderPanel()
    const trigger = screen.getByRole('combobox')

    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger.getAttribute('aria-controls'))
      .toBe(screen.getByRole('listbox').getAttribute('id'))
  })

  it('方向键移动活动项，Enter 选中', () => {
    const { onValueChange } = renderPanel()
    const trigger = screen.getByRole('combobox')

    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const listbox = screen.getByRole('listbox')
    expect(within(listbox).getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    expect(within(listbox).getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(listbox, { key: 'Enter' })
    expect(onValueChange.mock.calls[0]?.[0]).toEqual({ page: detailValue })
  })

  it('Escape 关闭弹层并恢复焦点', () => {
    renderPanel()
    const trigger = screen.getByRole('combobox')

    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('trigger 上 Delete 清空引用', () => {
    const { onValueChange } = renderPanel({ value: homeValue })

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Delete' })

    expect(onValueChange.mock.calls[0]?.[0]).toEqual({ page: null })
  })
})
