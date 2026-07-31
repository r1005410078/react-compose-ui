import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  createDefaultCanvasSettings,
  type ComposeDocument,
} from '@compose-ui/core'
import { CanvasInspector } from './canvas-inspector'

function documentFixture(): ComposeDocument {
  return {
    schemaVersion: 6,
    canvas: createDefaultCanvasSettings(),
    output: {
      width: 1280,
      height: 720,
      backgroundPaint: { kind: 'solid', color: '#0cdeab' },
    },
    rootIds: [],
    entities: {},
  }
}

describe('CanvasInspector', () => {
  it('OpenSpec: editor-workspace-layout / 隐式 Canvas Inspector / 点击输出并编辑背景 Paint', () => {
    render(
      <CanvasInspector
        dispatch={vi.fn()}
        document={documentFixture()}
        idFactory={() => 'canvas-output-paint'}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '输出背景' }))
    expect(screen.getByRole('button', { name: '纯色' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '线性' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '渐变' }))
    expect(screen.getByRole('button', { name: '线性' })).toBeInTheDocument()
  })
})
