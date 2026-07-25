import type { ComponentInspectorProps } from '@compose-ui/component-registry'
import type { ComposeFrameNode } from '@compose-ui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBasicMaterials } from '../index'

afterEach(cleanup)

describe('@compose-ui/materials Frame', () => {
  it('提供稳定的默认 preset 和独立 style 副本', () => {
    const materials = createBasicMaterials()
    const preset = materials.framePresets[0]
    expect(preset).toMatchObject({
      id: 'frame',
      label: 'Frame',
      name: 'Frame',
      defaultSize: { width: 1280, height: 720 },
    })
    expect(preset?.createDefaultStyle()).toEqual({
      backgroundColor: '#f8fafc',
      borderColor: '#d1d5db',
      borderWidth: 1,
      borderRadius: 0,
      opacity: 1,
      shadow: null,
    })
    expect(preset?.createDefaultStyle()).not.toBe(preset?.createDefaultStyle())
  })

  it('OpenSpec: basic-materials / Container Inspector / Frame 使用公共原子编辑路径', () => {
    const materials = createBasicMaterials({ idFactory: () => 'container-command' })
    const dispatch = vi.fn<ComponentInspectorProps['dispatch']>()
    const frame: ComposeFrameNode = {
      id: 'frame-1',
      kind: 'frame',
      name: 'Dashboard',
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0 },
      childIds: [],
      style: materials.framePresets[0]?.createDefaultStyle(),
    }
    render(<materials.ContainerInspector dispatch={dispatch} node={frame} />)

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Wallboard' } })

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'transaction.batch',
      meta: expect.objectContaining({
        label: 'Update Dashboard · Name "Dashboard" → "Wallboard"',
      }),
      payload: {
        commands: [
          expect.objectContaining({
            type: 'node.rename',
            payload: { nodeId: 'frame-1', name: 'Wallboard' },
          }),
        ],
      },
    }))
  })
})
