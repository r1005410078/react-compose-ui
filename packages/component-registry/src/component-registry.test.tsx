import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type {
  ComposeComponentNode,
  EditorCommand,
  JsonObject,
} from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as registryPackage from './index'

type Definition = {
  type: string
  label: string
  defaultSize: { width: number; height: number }
  createDefaultProps(): JsonObject
  renderer(props: {
    node: ComposeComponentNode
    props: JsonObject
    mode: 'editor' | 'preview'
  }): React.ReactNode
  inspector?(props: {
    node: ComposeComponentNode
    dispatch(command: EditorCommand): unknown
  }): React.ReactNode
}

type Registry = {
  get(type: string): Definition | undefined
  list(): readonly Definition[]
  createSeed(type: string):
    | {
        ok: true
        seed: {
          componentType: string
          props: JsonObject
          width: number
          height: number
        }
      }
    | { ok: false; error: { code: string; message: string } }
}

const api = registryPackage as unknown as {
  createComponentRegistry(definitions: readonly Definition[]): Registry
  RegistryComponent(props: {
    registry: Registry
    node: ComposeComponentNode
    mode: 'editor' | 'preview'
  }): React.ReactNode
  RegistryInspector(props: {
    registry: Registry
    node: ComposeComponentNode
    dispatch(command: EditorCommand): unknown
  }): React.ReactNode
}

afterEach(cleanup)

function node(componentType = 'text'): ComposeComponentNode {
  return {
    id: 'a',
    kind: 'component',
    name: 'A',
    visible: true,
    locked: false,
    transform: { x: 0, y: 0, width: 100, height: 50, rotation: 0 },
    componentType,
    props: { text: 'Hello' },
  }
}

function definition(type = 'text', label = '文本'): Definition {
  return {
    type,
    label,
    defaultSize: { width: 100, height: 50 },
    createDefaultProps: () => ({ text: 'Hello', nested: { count: 1 } }),
    renderer: ({ props, mode }) => <span>{mode}:{String(props.text)}</span>,
  }
}

describe('ComponentRegistry', () => {
  it('OpenSpec: component-registry / 独立宿主组件注册表 / 创建有序注册表', () => {
    const input = [definition('text', '文本'), definition('chart', '图表')]
    const registry = api.createComponentRegistry(input)
    input.reverse()

    expect(registry.get('text')?.label).toBe('文本')
    expect(registry.list().map((item) => item.type)).toEqual(['text', 'chart'])
  })

  it('OpenSpec: component-registry / 独立宿主组件注册表 / 拒绝重复或非法 definition', () => {
    expect(() => api.createComponentRegistry([
      definition('same'),
      definition('same'),
    ])).toThrow(/same/)
    expect(() => api.createComponentRegistry([definition('')])).toThrow(/type/)
    expect(() => api.createComponentRegistry([{
      ...definition('size'),
      defaultSize: { width: 0, height: 50 },
    }])).toThrow(/width/)
    expect(() => api.createComponentRegistry([{
      ...definition('json'),
      createDefaultProps: () => ({ invalid: Number.NaN }),
    }])).toThrow(/JSON/)
  })

  it('OpenSpec: component-registry / 独立宿主组件注册表 / 隔离多个注册表实例', () => {
    const first = api.createComponentRegistry([definition('first')])
    const second = api.createComponentRegistry([definition('second')])

    expect(first.get('first')).toBeDefined()
    expect(first.get('second')).toBeUndefined()
    expect(second.get('second')).toBeDefined()
    expect(second.get('first')).toBeUndefined()
  })

  it('OpenSpec: component-registry / 可序列化组件默认值 / 创建独立组件种子', () => {
    const registry = api.createComponentRegistry([definition()])
    const first = registry.createSeed('text')
    const second = registry.createSeed('text')
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) return

    expect(first.seed).toEqual(second.seed)
    expect(first.seed.props).not.toBe(second.seed.props)
    expect(first.seed.props.nested).not.toBe(second.seed.props.nested)
    expect(first.seed).toMatchObject({ width: 100, height: 50 })
  })

  it('OpenSpec: component-registry / 可序列化组件默认值 / 默认值 factory 返回非法数据', () => {
    let attempt = 0
    const registry = api.createComponentRegistry([{
      ...definition(),
      createDefaultProps: () => {
        attempt += 1
        return attempt === 1 ? { valid: true } : { invalid: () => undefined } as never
      },
    }])

    expect(registry.createSeed('text')).toMatchObject({
      ok: false,
      error: { code: 'definition.invalid-props' },
    })
  })

  it('OpenSpec: component-registry / Renderer 与 Inspector 上下文 / 渲染编辑和预览内容', () => {
    const renderer = vi.fn(definition().renderer)
    const registry = api.createComponentRegistry([{ ...definition(), renderer }])
    const view = render(
      <api.RegistryComponent mode="editor" node={node()} registry={registry} />,
    )
    expect(screen.getByText('editor:Hello')).toBeInTheDocument()

    view.rerender(
      <api.RegistryComponent mode="preview" node={node()} registry={registry} />,
    )
    expect(screen.getByText('preview:Hello')).toBeInTheDocument()
    expect(renderer.mock.calls[0]?.[0].props).toEqual({ text: 'Hello' })
  })

  it('OpenSpec: component-registry / Renderer 与 Inspector 上下文 / Inspector 派发属性命令', () => {
    const dispatch = vi.fn()
    const registry = api.createComponentRegistry([{
      ...definition(),
      inspector: ({ node: current, dispatch: send }) => (
        <button
          type="button"
          onClick={() => send({
            id: 'property',
            type: 'node.props.set',
            payload: { nodeId: current.id, path: ['text'], value: 'Changed' },
          })}
        >
          修改属性
        </button>
      ),
    }])
    render(<api.RegistryInspector dispatch={dispatch} node={node()} registry={registry} />)

    fireEvent.click(screen.getByRole('button', { name: '修改属性' }))
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'node.props.set',
      payload: expect.objectContaining({ nodeId: 'a' }),
    }))
  })

  it('OpenSpec: component-registry / 未知和失败 Renderer 隔离 / 遇到未知组件类型', () => {
    const registry = api.createComponentRegistry([definition()])
    render(<api.RegistryComponent mode="editor" node={node('host.missing')} registry={registry} />)

    expect(screen.getByRole('status', { name: /host\.missing/ })).toBeInTheDocument()
  })

  it('OpenSpec: component-registry / 未知和失败 Renderer 隔离 / Renderer 抛出异常', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const registry = api.createComponentRegistry([
      {
        ...definition('broken'),
        renderer: () => {
          throw new Error('renderer exploded')
        },
        inspector: () => {
          throw new Error('inspector exploded')
        },
      },
      definition('healthy'),
    ])
    const { rerender } = render(
      <>
        <api.RegistryComponent mode="editor" node={node('broken')} registry={registry} />
        <api.RegistryComponent mode="editor" node={node('healthy')} registry={registry} />
      </>,
    )
    expect(screen.getByRole('status', { name: /broken/ })).toBeInTheDocument()
    expect(screen.getByText('editor:Hello')).toBeInTheDocument()

    rerender(<api.RegistryInspector dispatch={vi.fn()} node={node('broken')} registry={registry} />)
    expect(screen.getByRole('status', { name: /broken/ })).toBeInTheDocument()
    consoleError.mockRestore()
  })
})
