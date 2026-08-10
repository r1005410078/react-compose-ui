import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

afterEach(() => { cleanup() })

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

  it('OpenSpec: editor-workspace-layout / Canvas Map 输出尺寸与背景 Inspector / 重置输出背景', () => {
    const dispatch = vi.fn()
    render(
      <CanvasInspector
        dispatch={dispatch}
        document={documentFixture()}
        idFactory={() => 'canvas-output-reset'}
      />,
    )

    // 输出尺寸没有实例无关的默认值，只有背景可重置。
    expect(screen.queryByRole('button', { name: '重置 输出尺寸' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重置 输出背景' }))

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.lastCall?.[0]).toMatchObject({
      type: 'output.configure',
      payload: {
        width: 1280,
        height: 720,
        backgroundPaint: { kind: 'solid', color: 'transparent' },
      },
    })
  })

  it('OpenSpec: editor-workspace-layout / 页面脚本作为 Canvas Inspector 属性 / 页面与 Inspector 目标切换', () => {
    render(
      <CanvasInspector
        dispatch={vi.fn()}
        document={documentFixture()}
        idFactory={() => 'canvas-page-script'}
        pageScriptInspector={<div>Counter.setup.js 返回成员</div>}
      />,
    )

    expect(screen.getAllByRole('searchbox', { name: '搜索属性' })).toHaveLength(1)
    expect(screen.getByText('Counter.setup.js 返回成员')).toBeInTheDocument()
    const field = screen.getByText('Counter.setup.js 返回成员').closest('[data-property-path]')
    expect(field).toHaveAttribute('data-property-path', 'pageScript')
    expect(field).toHaveAttribute('data-property-layout', 'full-width')
  })
})
