import type { ComposeComponentNode, ComposeFrameNode } from '@compose-ui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComposeBasicMaterials } from '../../index'

afterEach(cleanup)

function componentNode(componentType: string): ComposeComponentNode {
  return {
    id: `${componentType}-1`,
    kind: 'component',
    name: componentType,
    visible: true,
    locked: false,
    transform: { x: 10, y: 20, width: 240, height: 140, rotation: 0 },
    componentType,
    props: componentType === 'text'
      ? { text: 'Text', color: 'rgb(23 32 51)', fontSize: 24 }
      : componentType === 'svg'
        ? { alt: 'SVG', fit: 'contain', overrideFill: true, fillColor: '#fff', overrideStroke: false, strokeColor: '#000' }
        : { alt: 'Image', fit: 'contain' },
  }
}

const frameNode: ComposeFrameNode = {
  id: 'frame-1',
  kind: 'frame',
  name: 'Frame',
  visible: true,
  locked: false,
  transform: { x: 10, y: 20, width: 240, height: 140, rotation: 0 },
  childIds: [],
  clipContent: true,
}

describe('OpenSpec: basic-materials / 基础物料使用共享语义 Inspector', () => {
  it('OpenSpec: basic-materials / 基础物料使用共享语义 Inspector / 编辑物料复合几何与样式', () => {
    const materials = createComposeBasicMaterials({ idFactory: () => 'semantic-command' })
    const Inspector = materials.registry.get('rectangle')?.inspector
    const dispatch = vi.fn()
    expect(Inspector).toBeDefined()
    if (!Inspector) return
    render(<Inspector dispatch={dispatch} node={componentNode('rectangle')} />)

    expect(screen.getByTestId('semantic-editor-vector2')).toBeInTheDocument()
    expect(screen.getByTestId('semantic-editor-size')).toBeInTheDocument()
    expect(screen.getAllByTestId('semantic-editor-color')).not.toHaveLength(0)
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Position X' }), {
      target: { value: '42' },
    })
    fireEvent.blur(screen.getByRole('spinbutton', { name: 'Position X' }))

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'transaction.batch',
      payload: expect.objectContaining({
        commands: expect.arrayContaining([
          expect.objectContaining({
            type: 'node.transform.set',
            payload: expect.objectContaining({
              updates: [expect.objectContaining({
                nodeId: 'rectangle-1',
                transform: expect.objectContaining({ x: 42 }),
              })],
            }),
          }),
        ]),
      }),
    }))
  })

  it.each(['rectangle', 'text', 'image', 'svg'] as const)(
    'OpenSpec: basic-materials / 基础物料使用共享语义 Inspector / 切换物料可见性 - %s',
    (componentType) => {
      const materials = createComposeBasicMaterials({ idFactory: () => 'visibility-command' })
      const Inspector = materials.registry.get(componentType)?.inspector
      const dispatch = vi.fn()
      expect(Inspector).toBeDefined()
      if (!Inspector) return
      render(<Inspector dispatch={dispatch} node={componentNode(componentType)} />)

      fireEvent.click(screen.getByLabelText('Visibility'))
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        type: 'transaction.batch',
        payload: expect.objectContaining({
          commands: [expect.objectContaining({
            type: 'node.set-visibility',
            payload: { nodeIds: [`${componentType}-1`], visible: false },
          })],
        }),
      }))
    },
  )

  it('OpenSpec: basic-materials / 基础物料使用共享语义 Inspector / 切换物料可见性 - Frame', () => {
    const materials = createComposeBasicMaterials({ idFactory: () => 'visibility-command' })
    const dispatch = vi.fn()
    render(<materials.ContainerInspector dispatch={dispatch} node={frameNode} />)

    fireEvent.click(screen.getByLabelText('Visibility'))
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'transaction.batch',
      payload: expect.objectContaining({
        commands: [expect.objectContaining({
          type: 'node.set-visibility',
          payload: { nodeIds: ['frame-1'], visible: false },
        })],
      }),
    }))
  })
})
