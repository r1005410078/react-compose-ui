import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  createDefaultCanvasSettings,
  type ComposeDocument,
  type ComposeEntity,
  type EditorCommand,
} from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MultiSelectionInspector } from './multi-selection-inspector'
import { TextStyleInspector } from './text-style-inspector'

function textEntity(id: string, styleId?: string): ComposeEntity {
  return {
    id,
    name: id,
    components: {
      Composition: { presetId: 'text', baseComponentKeys: [], capabilityIds: [] },
      Renderer: { type: 'text', props: { text: id } },
      ...(styleId === undefined ? {} : { Style: { text: styleId } }),
    },
  }
}

function documentWith(entities: readonly ComposeEntity[]): ComposeDocument {
  return {
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
    rootIds: entities.map((entity) => entity.id),
    entities: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
    styles: {
      'style-title': { name: '标题', props: { fontSize: 26 } },
      'style-body': { name: '正文', props: { fontSize: 12 } },
    },
  }
}

let counter = 0
const idFactory = () => `cmd-${(counter += 1)}`

afterEach(cleanup)

describe('TextStyleInspector 样式表入口', () => {
  it('OpenSpec: core / 文字样式 / 重命名走同一条 upsert 且 props 原样保留', () => {
    const dispatch = vi.fn<(command: EditorCommand) => unknown>()
    const entity = textEntity('a', 'style-title')
    render(
      <TextStyleInspector
        dispatch={dispatch}
        document={documentWith([entity])}
        entities={[entity]}
        idFactory={idFactory}
        readOnly={false}
        zh
      />,
    )

    const input = screen.getByRole('textbox', { name: '样式名称' })
    expect(input).toHaveValue('标题')
    fireEvent.change(input, { target: { value: '大标题' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    const command = dispatch.mock.calls[0]?.[0]
    expect(command?.type).toBe('document.style.text.set')
    expect(command?.payload).toMatchObject({
      styleId: 'style-title',
      name: '大标题',
      props: { fontSize: 26 },
    })
  })

  it('OpenSpec: core / 文字样式 / 删除前说出跟随者数量，确认后才派发', () => {
    const dispatch = vi.fn<(command: EditorCommand) => unknown>()
    const entities = [textEntity('a', 'style-title'), textEntity('b', 'style-title')]
    render(
      <TextStyleInspector
        dispatch={dispatch}
        document={documentWith(entities)}
        entities={[entities[0]!]}
        idFactory={idFactory}
        readOnly={false}
        zh
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '删除样式' }))
    // 删除不追着解除引用，跟随者会回到默认排版——那是一次看得见的改动，数量必须写在确认框里。
    expect(screen.getByRole('alertdialog')).toHaveTextContent('正被 2 处跟随')
    expect(dispatch).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({
      type: 'document.style.text.remove',
      payload: { styleId: 'style-title' },
    })
    // 确认框的开合归调用方那份状态：不清的话删除发生了、模态框却留着，整个编辑器点不动。
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('OpenSpec: core / 文字样式 / 多选应用一条 batch 覆盖全部目标', () => {
    const dispatch = vi.fn<(command: EditorCommand) => unknown>()
    const entities = [textEntity('a'), textEntity('b')]
    render(
      <TextStyleInspector
        dispatch={dispatch}
        document={documentWith(entities)}
        entities={entities}
        idFactory={idFactory}
        readOnly={false}
        zh
      />,
    )

    fireEvent.change(screen.getByRole('combobox', { name: /文字样式/ }), {
      target: { value: 'style-body' },
    })

    expect(dispatch).toHaveBeenCalledTimes(1)
    const command = dispatch.mock.calls[0]?.[0]
    expect(command?.type).toBe('transaction.batch')
    expect(command?.meta?.targetIds).toEqual(['a', 'b'])
    // 提取与写回要从「这一条」取值，多选没有这一条，因此两颗按钮都不出。
    expect(screen.queryByRole('button', { name: '提取为样式' })).toBeNull()
    expect(screen.queryByRole('button', { name: '把这一条写回样式' })).toBeNull()
  })

  it('OpenSpec: core / 文字样式 / 混合与「不跟随」是两个选项', () => {
    const entities = [textEntity('a', 'style-title'), textEntity('b', 'style-body')]
    render(
      <TextStyleInspector
        dispatch={vi.fn()}
        document={documentWith(entities)}
        entities={entities}
        idFactory={idFactory}
        readOnly={false}
        zh
      />,
    )

    const select = screen.getByRole('combobox', { name: /文字样式/ })
    expect(select).toHaveValue('__mixed__')
    // 画成空选项会让用户读成「这一批已经都不跟随了」，而事实是两条都在跟。
    expect(screen.getByRole('option', { name: '多种样式' })).toBeDisabled()
    expect(screen.getByRole('option', { name: '不跟随' })).not.toBeDisabled()
  })
})

describe('MultiSelectionInspector', () => {
  it('OpenSpec: core / 文字样式 / 多选面板只多出样式一段', () => {
    const entities = [textEntity('a'), textEntity('b')]
    render(
      <MultiSelectionInspector
        dispatch={vi.fn()}
        document={documentWith(entities)}
        idFactory={idFactory}
        selectedIds={['a', 'b']}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('只选中一个')
    expect(screen.getByRole('combobox', { name: /文字样式/ })).toBeInTheDocument()
  })

  it('OpenSpec: core / 文字样式 / 选中的都没有 Renderer 时整段不出', () => {
    const container: ComposeEntity = {
      id: 'c',
      name: 'c',
      components: {
        Composition: { presetId: 'container', baseComponentKeys: [], capabilityIds: [] },
        Hierarchy: { childIds: [] },
      },
    }
    render(
      <MultiSelectionInspector
        dispatch={vi.fn()}
        document={documentWith([container])}
        idFactory={idFactory}
        selectedIds={['c']}
      />,
    )
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})
