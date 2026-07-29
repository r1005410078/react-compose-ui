import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  BUILTIN_COMMAND_TYPES,
  type ComposeEntity,
  type EditorCommand,
  type JsonObject,
} from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComposeBuiltinComponentDefinitions } from '../builtin-components'

function entity(components: Readonly<Record<string, JsonObject>> = {}): ComposeEntity {
  return {
    id: 'entity-a',
    name: 'Title',
    components: {
      Composition: {
        presetId: null,
        baseComponentKeys: ['Transform', 'Visibility', 'Lock'],
        capabilityIds: [],
      },
      Transform: {
        position: { x: 10, y: 20 },
        size: { width: 180, height: 40 },
        rotation: 0,
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      ...components,
    },
  }
}

function inspectorOf(key: string) {
  let commandIndex = 0
  const definitions = createComposeBuiltinComponentDefinitions(() => `id-${commandIndex++}`)
  const definition = definitions.find((item) => item.key === key)
  if (!definition?.inspector) throw new Error(`${key} 缺少 inspector`)
  return definition.inspector
}

afterEach(cleanup)

describe('内建 Component inspectors', () => {
  it('OpenSpec: 基础物料 / 内建 Component 定义自带 Inspector', () => {
    const definitions = createComposeBuiltinComponentDefinitions(() => 'id')
    for (const key of ['Transform', 'Visibility', 'Lock', 'Appearance', 'Hierarchy', 'TransformConstraints']) {
      expect(definitions.find((item) => item.key === key)?.inspector, key).toBeDefined()
    }
    expect(definitions.find((item) => item.key === 'Composition')?.hidden).toBe(true)
    expect(definitions.find((item) => item.key === 'Renderer')?.hidden).toBe(true)
  })

  it('OpenSpec: 基础物料 / Transform Inspector 派发 setTransform 并跟随外部值', () => {
    const dispatch = vi.fn()
    const Inspector = inspectorOf('Transform')
    const target = entity()
    const { rerender } = render(
      <Inspector
        componentKey="Transform"
        dispatch={dispatch}
        entity={target}
        readOnly={false}
        value={target.components.Transform!}
      />,
    )
    const x = screen.getByRole('spinbutton', { name: '位置 X' })
    expect(x).toHaveValue(10)

    fireEvent.change(x, { target: { value: '42' } })
    fireEvent.blur(x)
    const command = dispatch.mock.lastCall?.[0] as EditorCommand
    expect(command.type).toBe(BUILTIN_COMMAND_TYPES.setTransform)
    expect(command.meta?.mergeKey).toBe(`inspector:entity-a:${BUILTIN_COMMAND_TYPES.setTransform}`)
    expect(command.payload).toMatchObject({
      operation: 'set',
      updates: [{
        entityId: 'entity-a',
        transform: expect.objectContaining({ position: { x: 42, y: 20 } }),
      }],
    })

    const moved = entity({
      Transform: {
        position: { x: 99, y: 20 },
        size: { width: 180, height: 40 },
        rotation: 0,
      },
    })
    rerender(
      <Inspector
        componentKey="Transform"
        dispatch={dispatch}
        entity={moved}
        readOnly={false}
        value={moved.components.Transform!}
      />,
    )
    expect(screen.getByRole('spinbutton', { name: '位置 X' })).toHaveValue(99)
  })

  it('OpenSpec: 基础物料 / Lock Inspector 在 readOnly 上下文仍可解除锁定', () => {
    const dispatch = vi.fn()
    const Inspector = inspectorOf('Lock')
    const locked = entity({ Lock: { locked: true } })
    render(
      <Inspector
        componentKey="Lock"
        dispatch={dispatch}
        entity={locked}
        readOnly
        value={locked.components.Lock!}
      />,
    )
    const checkbox = screen.getByRole('checkbox', { name: '锁定' })
    expect(checkbox).not.toBeDisabled()
    fireEvent.click(checkbox)
    const command = dispatch.mock.lastCall?.[0] as EditorCommand
    expect(command.type).toBe(BUILTIN_COMMAND_TYPES.setLock)
    expect(command.payload).toEqual({ entityIds: ['entity-a'], locked: false })
  })

  it('OpenSpec: 基础物料 / Hierarchy Inspector 展示子项数量并切换 Clip', () => {
    const dispatch = vi.fn()
    const Inspector = inspectorOf('Hierarchy')
    const container = entity({
      Hierarchy: { childIds: ['a', 'b'] },
      Clip: { enabled: true },
    })
    render(
      <Inspector
        componentKey="Hierarchy"
        dispatch={dispatch}
        entity={container}
        readOnly={false}
        value={container.components.Hierarchy!}
      />,
    )
    expect(screen.getByRole('spinbutton', { name: '子项数量' })).toHaveValue(2)
    fireEvent.click(screen.getByRole('checkbox', { name: '裁剪内容' }))
    const command = dispatch.mock.lastCall?.[0] as EditorCommand
    expect(command.type).toBe(BUILTIN_COMMAND_TYPES.setClip)
    expect(command.payload).toEqual({ entityIds: ['entity-a'], enabled: false })
  })

  it('OpenSpec: 基础物料 / Appearance Inspector 保留未编辑的 shadow 数据', () => {
    const dispatch = vi.fn()
    const Inspector = inspectorOf('Appearance')
    const shadowed = entity({
      Appearance: {
        backgroundColor: '#111111',
        shadow: { color: '#00000040', offsetX: 0, offsetY: 4, blur: 12, spread: 0 },
      },
    })
    render(
      <Inspector
        componentKey="Appearance"
        dispatch={dispatch}
        entity={shadowed}
        readOnly={false}
        value={shadowed.components.Appearance!}
      />,
    )
    const opacity = screen.getByRole('spinbutton', { name: '透明度' })
    fireEvent.change(opacity, { target: { value: '0.5' } })
    fireEvent.blur(opacity)
    const command = dispatch.mock.lastCall?.[0] as EditorCommand
    expect(command.type).toBe(BUILTIN_COMMAND_TYPES.setAppearance)
    expect(command.payload).toMatchObject({
      entityId: 'entity-a',
      appearance: expect.objectContaining({
        opacity: 0.5,
        shadow: { color: '#00000040', offsetX: 0, offsetY: 4, blur: 12, spread: 0 },
      }),
    })
  })
})
