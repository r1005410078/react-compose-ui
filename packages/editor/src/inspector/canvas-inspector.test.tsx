import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createDefaultCanvasSettings,
  type ComposeDocument,
} from '@compose-ui/core'
import { ComposePropertyPanelSection } from '@compose-ui/property-panel'
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
    // 注入内容是共享 Root 内的 Section：与输出分组同一个属性面板、同一个搜索工具栏。
    render(
      <CanvasInspector
        dispatch={vi.fn()}
        document={documentFixture()}
        idFactory={() => 'canvas-page-script'}
        animationInspector={(
          <ComposePropertyPanelSection title="动画">
            <div>Home.animation.json 绑定</div>
          </ComposePropertyPanelSection>
        )}
        pageScriptInspector={(
          <ComposePropertyPanelSection title="页面脚本">
            <div>Counter.setup.js 返回成员</div>
          </ComposePropertyPanelSection>
        )}
      />,
    )

    expect(screen.getAllByRole('searchbox', { name: '搜索属性' })).toHaveLength(1)
    expect(screen.getByText('Counter.setup.js 返回成员')).toBeInTheDocument()
    // 三个分组按 输出 → 动画 → 页面脚本 排列，动画在页面脚本上方。
    const groupTitles = screen.getAllByRole('button', { expanded: true })
      .map((button) => button.textContent)
      .filter((text) => ['输出', '动画', '页面脚本'].includes(text ?? ''))
    expect(groupTitles).toEqual(['输出', '动画', '页面脚本'])
  })
})
