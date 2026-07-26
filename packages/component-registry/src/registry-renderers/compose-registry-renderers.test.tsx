import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type {
  ComposeAssetReference,
  ComposeAssetResolver,
  ComposeResolvedAsset,
} from '@compose-ui/assets'
import type {
  ComposeComponentNode,
  EditorCommand,
  JsonObject,
  NodeStyle,
} from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as registryPackage from '../index'

type Definition = {
  type: string
  label: string
  defaultName?: string
  defaultSize: { width: number; height: number }
  createDefaultProps(): JsonObject
  createDefaultStyle?(): NodeStyle
  paletteHidden?: boolean
  assetDrop?: {
    accepts(input: { name: string; mediaType: string }): boolean
    createSeed(input: {
      reference: ComposeAssetReference
      resolved: ComposeResolvedAsset
      name: string
    }): Promise<{
      name: string
      props: JsonObject
      width: number
      height: number
    }>
  }
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
          name: string
          props: JsonObject
          style?: NodeStyle
          width: number
          height: number
        }
      }
    | { ok: false; error: { code: string; message: string } }
  createAssetSeed(input: {
    reference: ComposeAssetReference
    resolved: ComposeResolvedAsset
    name: string
  }): Promise<
    | { ok: true; seed: { componentType: string; name: string; props: JsonObject; width: number; height: number } }
    | { ok: false; error: { code: string; message: string } }
  >
}

const api = registryPackage as unknown as {
  createComposeComponentRegistry(definitions: readonly Definition[]): Registry
  ComposeRegistryComponent(props: {
    registry: Registry
    node: ComposeComponentNode
    mode: 'editor' | 'preview'
    assetResolver?: ComposeAssetResolver
  }): React.ReactNode
  ComposeRegistryInspector(props: {
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

describe('ComposeComponentRegistry', () => {
  it('OpenSpec: component-registry / Definition 资源创建协议 / 从图片资源创建 seed', async () => {
    const first = {
      ...definition('image'),
      paletteHidden: true,
      assetDrop: {
        accepts: ({ mediaType }: { mediaType: string }) => mediaType === 'image/png',
        createSeed: async ({ reference, name }: {
          reference: ComposeAssetReference
          name: string
        }) => ({
          name,
          props: { asset: reference },
          width: 320,
          height: 180,
        }),
      },
    }
    const registry = api.createComposeComponentRegistry([first, definition('fallback')])
    const reference = {
      providerId: 'library',
      assetKey: 'hero',
      scope: 'persistent' as const,
    }
    const result = await registry.createAssetSeed({
      reference,
      resolved: {
        blob: new Blob(['image']),
        revision: '1',
        mediaType: 'image/png',
      },
      name: 'hero.png',
    })
    expect(result).toEqual({
      ok: true,
      seed: {
        componentType: 'image',
        name: 'hero.png',
        props: { asset: reference },
        width: 320,
        height: 180,
      },
    })
    expect(registry.list()[0]?.paletteHidden).toBe(true)
  })

  it('OpenSpec: component-registry / Definition 资源创建协议 / 资源 factory 失败', async () => {
    const registry = api.createComposeComponentRegistry([{
      ...definition('broken'),
      assetDrop: {
        accepts: () => true,
        createSeed: async () => {
          throw new Error('decode failed')
        },
      },
    }])
    const result = await registry.createAssetSeed({
      reference: { providerId: 'p', assetKey: 'a', scope: 'persistent' },
      resolved: {
        blob: new Blob(),
        revision: '1',
        mediaType: 'image/png',
      },
      name: 'broken.png',
    })
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'definition.asset-factory-failed' },
    })
  })

  it('OpenSpec: component-registry / 组件默认节点样式 / 创建带独立 style 的组件种子', () => {
    const registry = api.createComposeComponentRegistry([{
      ...definition(),
      createDefaultStyle: () => ({
        backgroundColor: '#2463eb',
        shadow: {
          color: '#00000040',
          offsetX: 0,
          offsetY: 4,
          blur: 12,
          spread: 0,
        },
      }),
    }])

    const first = registry.createSeed('text')
    const second = registry.createSeed('text')
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.seed.style).toEqual(second.seed.style)
    expect(first.seed.style).not.toBe(second.seed.style)
    expect(first.seed.style?.shadow).not.toBe(second.seed.style?.shadow)
  })

  it('OpenSpec: component-registry / 组件默认节点样式 / 拒绝非法默认 style', () => {
    expect(() => api.createComposeComponentRegistry([{
      ...definition(),
      createDefaultStyle: () => ({ opacity: 2 }),
    }])).toThrow(/style/)
    expect(() => api.createComposeComponentRegistry([{
      ...definition(),
      createDefaultStyle: () => ({ opacity: undefined }),
    }])).toThrow(/style/)

    let attempt = 0
    const registry = api.createComposeComponentRegistry([{
      ...definition(),
      createDefaultStyle: () => {
        attempt += 1
        return attempt === 1 ? { opacity: 1 } : { shadow: 'invalid' } as never
      },
    }])
    expect(registry.createSeed('text')).toMatchObject({
      ok: false,
      error: { code: 'definition.invalid-style' },
    })
  })

  it('OpenSpec: component-registry / 独立宿主组件注册表 / 创建有序注册表', () => {
    const input = [definition('text', '文本'), definition('chart', '图表')]
    const registry = api.createComposeComponentRegistry(input)
    input.reverse()

    expect(registry.get('text')?.label).toBe('文本')
    expect(registry.list().map((item) => item.type)).toEqual(['text', 'chart'])
  })

  it('OpenSpec: component-registry / 独立宿主组件注册表 / 拒绝重复或非法 definition', () => {
    expect(() => api.createComposeComponentRegistry([
      definition('same'),
      definition('same'),
    ])).toThrow(/same/)
    expect(() => api.createComposeComponentRegistry([definition('')])).toThrow(/type/)
    expect(() => api.createComposeComponentRegistry([{
      ...definition('size'),
      defaultSize: { width: 0, height: 50 },
    }])).toThrow(/width/)
    expect(() => api.createComposeComponentRegistry([{
      ...definition('json'),
      createDefaultProps: () => ({ invalid: Number.NaN }),
    }])).toThrow(/JSON/)
  })

  it('OpenSpec: component-registry / 独立宿主组件注册表 / 隔离多个注册表实例', () => {
    const first = api.createComposeComponentRegistry([definition('first')])
    const second = api.createComposeComponentRegistry([definition('second')])

    expect(first.get('first')).toBeDefined()
    expect(first.get('second')).toBeUndefined()
    expect(second.get('second')).toBeDefined()
    expect(second.get('first')).toBeUndefined()
  })

  it('OpenSpec: component-registry / 可序列化组件默认值 / 创建独立组件种子', () => {
    const registry = api.createComposeComponentRegistry([definition()])
    const first = registry.createSeed('text')
    const second = registry.createSeed('text')
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) return

    expect(first.seed).toEqual(second.seed)
    expect(first.seed.props).not.toBe(second.seed.props)
    expect(first.seed.props.nested).not.toBe(second.seed.props.nested)
    expect(first.seed).toMatchObject({ width: 100, height: 50 })
    expect(first.seed.name).toBe('文本')
  })

  it('OpenSpec: component-registry / 可序列化组件默认值 / 默认值 factory 返回非法数据', () => {
    let attempt = 0
    const registry = api.createComposeComponentRegistry([{
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
    const registry = api.createComposeComponentRegistry([{ ...definition(), renderer }])
    const view = render(
      <api.ComposeRegistryComponent mode="editor" node={node()} registry={registry} />,
    )
    expect(screen.getByText('editor:Hello')).toBeInTheDocument()

    view.rerender(
      <api.ComposeRegistryComponent mode="preview" node={node()} registry={registry} />,
    )
    expect(screen.getByText('preview:Hello')).toBeInTheDocument()
    expect(renderer.mock.calls[0]?.[0].props).toEqual({ text: 'Hello' })
  })

  it('OpenSpec: component-registry / Renderer 资源解析上下文 / 独立组件无 Resolver', () => {
    const renderer = vi.fn(definition().renderer)
    const registry = api.createComposeComponentRegistry([{ ...definition(), renderer }])
    render(<api.ComposeRegistryComponent mode="editor" node={node()} registry={registry} />)
    expect(renderer.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      assetResolver: undefined,
    }))
  })

  it('OpenSpec: component-registry / Renderer 与 Inspector 上下文 / Inspector 派发属性命令', () => {
    const dispatch = vi.fn()
    const registry = api.createComposeComponentRegistry([{
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
    render(<api.ComposeRegistryInspector dispatch={dispatch} node={node()} registry={registry} />)

    fireEvent.click(screen.getByRole('button', { name: '修改属性' }))
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'node.props.set',
      payload: expect.objectContaining({ nodeId: 'a' }),
    }))
  })

  it('OpenSpec: component-registry / 未知和失败 Renderer 隔离 / 遇到未知组件类型', () => {
    const registry = api.createComposeComponentRegistry([definition()])
    render(<api.ComposeRegistryComponent mode="editor" node={node('host.missing')} registry={registry} />)

    expect(screen.getByRole('status', { name: /host\.missing/ })).toBeInTheDocument()
  })

  it('OpenSpec: component-registry / 未知和失败 Renderer 隔离 / Renderer 抛出异常', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const registry = api.createComposeComponentRegistry([
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
        <api.ComposeRegistryComponent mode="editor" node={node('broken')} registry={registry} />
        <api.ComposeRegistryComponent mode="editor" node={node('healthy')} registry={registry} />
      </>,
    )
    expect(screen.getByRole('status', { name: /broken/ })).toBeInTheDocument()
    expect(screen.getByText('editor:Hello')).toBeInTheDocument()

    rerender(<api.ComposeRegistryInspector dispatch={vi.fn()} node={node('broken')} registry={registry} />)
    expect(screen.getByRole('status', { name: /broken/ })).toBeInTheDocument()
    consoleError.mockRestore()
  })
})
