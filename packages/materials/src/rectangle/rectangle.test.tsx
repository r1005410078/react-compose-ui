import { RegistryComponent } from '@compose-ui/component-registry'
import type { ComposeComponentNode } from '@compose-ui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBasicMaterials } from '../index'

afterEach(cleanup)

function rectangleNode(
  overrides: Partial<ComposeComponentNode> = {},
): ComposeComponentNode {
  return {
    id: 'rectangle-1',
    kind: 'component',
    name: 'Rectangle',
    visible: true,
    locked: false,
    transform: { x: 10, y: 20, width: 240, height: 140, rotation: 0 },
    componentType: 'rectangle',
    props: {},
    ...overrides,
  }
}

describe('@compose-ui/materials Rectangle', () => {
  it('OpenSpec: basic-materials / 完整基础物料与 Inspector / 兼容旧 Rectangle props', () => {
    const materials = createBasicMaterials()
    render(
      <RegistryComponent
        mode="preview"
        node={rectangleNode({
          props: { color: '#ff00aa', opacity: 0.4, cornerRadius: 18 },
        })}
        registry={materials.registry}
      />,
    )

    expect(screen.getByTestId('compose-material-rectangle')).toHaveStyle({
      backgroundColor: '#ff00aa',
      borderRadius: '18px',
      opacity: '0.4',
    })

    cleanup()
    const Inspector = materials.registry.get('rectangle')?.inspector
    const dispatch = vi.fn()
    expect(Inspector).toBeDefined()
    if (!Inspector) return
    render(
      <Inspector
        dispatch={dispatch}
        node={rectangleNode({
          props: { color: '#ff00aa', opacity: 0.4, cornerRadius: 18 },
        })}
      />,
    )
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Legacy rectangle' },
    })
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'transaction.batch',
      payload: {
        commands: expect.arrayContaining([
          expect.objectContaining({ type: 'node.rename' }),
          expect.objectContaining({
            type: 'node.style.set',
            payload: expect.objectContaining({
              value: expect.objectContaining({
                backgroundColor: '#ff00aa',
                borderRadius: 18,
                opacity: 0.4,
              }),
            }),
          }),
        ]),
      },
    }))
    expect(
      (dispatch.mock.calls[0]?.[0] as {
        payload: { commands: readonly { type: string }[] }
      }).payload.commands,
    ).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'node.props.set' }),
    ]))
  })

  it('OpenSpec: basic-materials / 完整基础物料与 Inspector / 编辑基础物料', () => {
    const materials = createBasicMaterials({ idFactory: () => 'material-command' })
    const definition = materials.registry.get('rectangle')
    const Inspector = definition?.inspector
    const dispatch = vi.fn()
    expect(Inspector).toBeDefined()
    if (!Inspector) return
    render(
      <Inspector
        dispatch={dispatch}
        node={rectangleNode({
          style: definition?.createDefaultStyle?.(),
        })}
      />,
    )

    fireEvent.change(screen.getByLabelText('Background'), {
      target: { value: '#123456' },
    })
    fireEvent.blur(screen.getByLabelText('Background'))

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      id: 'material-command',
      type: 'transaction.batch',
      meta: expect.objectContaining({
        label: expect.stringMatching(/^Update Rectangle · Background /),
        source: 'inspector',
        targetIds: ['rectangle-1'],
      }),
      payload: {
        commands: [
          expect.objectContaining({
            type: 'node.style.set',
            payload: expect.objectContaining({
              nodeId: 'rectangle-1',
              path: [],
              value: expect.objectContaining({ backgroundColor: '#123456' }),
            }),
          }),
        ],
      },
    }))
  })
})
