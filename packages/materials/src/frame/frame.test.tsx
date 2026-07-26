import type { ComponentInspectorProps } from '@compose-ui/component-registry'
import type { ComposeFrameNode } from '@compose-ui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBasicMaterials } from '../index'

afterEach(cleanup)

describe('@compose-ui/materials Frame', () => {
  // OpenSpec: basic-materials / 独立基础物料包 / 创建统一 Frame 物料
  it('提供稳定的默认 preset 和独立 style 副本', () => {
    const materials = createBasicMaterials()
    const preset = materials.framePresets[0]
    expect(preset).toMatchObject({
      id: 'frame',
      label: 'Frame',
      name: 'Frame',
      defaultSize: { width: 1280, height: 720 },
      defaultClipContent: true,
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

  // OpenSpec: basic-materials / 完整基础物料与 Inspector / 编辑 Frame 裁剪和旋转
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
    clipContent: true,
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

    dispatch.mockClear()
    fireEvent.click(screen.getByLabelText('Clip content'))
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'transaction.batch',
      payload: {
        commands: [
          expect.objectContaining({
            type: 'frame.clip-content.set',
            payload: { frameId: 'frame-1', clipContent: false },
          }),
        ],
      },
    }))

    dispatch.mockClear()
    fireEvent.change(screen.getByLabelText('Rotation'), { target: { value: '15' } })
    fireEvent.blur(screen.getByLabelText('Rotation'))
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'transaction.batch',
      payload: {
        commands: [
          expect.objectContaining({
            type: 'node.transform.set',
            payload: {
              updates: [
                expect.objectContaining({
                  nodeId: 'frame-1',
                  transform: expect.objectContaining({ rotation: 15 }),
                }),
              ],
            },
          }),
        ],
      },
    }))
  })
})
