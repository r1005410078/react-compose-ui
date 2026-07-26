import { ComposeRegistryComponent } from '@compose-ui/component-registry'
import type { ComposeComponentNode } from '@compose-ui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComposeBasicMaterials } from '../index'

afterEach(cleanup)

function textNode(
  overrides: Partial<ComposeComponentNode> = {},
): ComposeComponentNode {
  return {
    id: 'text-1',
    kind: 'component',
    name: 'Text',
    visible: true,
    locked: false,
    transform: { x: 10, y: 20, width: 280, height: 72, rotation: 0 },
    componentType: 'text',
    props: { text: 'Text', color: '#172033', fontSize: 24 },
    ...overrides,
  }
}

describe('@compose-ui/materials Text', () => {
  it('使用文档 props 渲染文字内容与排版', () => {
    const materials = createComposeBasicMaterials()
    render(
      <ComposeRegistryComponent
        mode="preview"
        node={textNode({
          props: { text: 'Dashboard', color: '#ff00aa', fontSize: 32 },
        })}
        registry={materials.registry}
      />,
    )

    expect(screen.getByTestId('compose-material-text')).toHaveTextContent('Dashboard')
    expect(screen.getByTestId('compose-material-text')).toHaveStyle({
      color: '#ff00aa',
      fontSize: '32px',
    })
  })

  it('OpenSpec: basic-materials / 完整基础物料与 Inspector / 编辑基础物料 - Text props', () => {
    const materials = createComposeBasicMaterials({ idFactory: () => 'text-command' })
    const definition = materials.registry.get('text')
    const Inspector = definition?.inspector
    const dispatch = vi.fn()
    expect(Inspector).toBeDefined()
    if (!Inspector) return
    render(
      <Inspector
        dispatch={dispatch}
        node={textNode({
          style: definition?.createDefaultStyle?.(),
        })}
      />,
    )

    fireEvent.change(screen.getByLabelText('Text'), {
      target: { value: 'Updated copy' },
    })

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'transaction.batch',
      meta: expect.objectContaining({
        label: 'Update Text · Text "Text" → "Updated copy"',
      }),
      payload: {
        commands: [
          expect.objectContaining({
            type: 'node.props.set',
            payload: {
              nodeId: 'text-1',
              path: [],
              value: {
                text: 'Updated copy',
                color: '#172033',
                fontSize: 24,
              },
            },
          }),
        ],
      },
    }))
  })
})
