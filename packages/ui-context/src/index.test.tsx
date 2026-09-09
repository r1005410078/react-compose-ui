import { act, cleanup, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ComposeI18nProvider,
  ComposeThemeProvider,
  ComposeUIProvider,
  useComposeI18nContext,
  useComposeThemeContext,
} from './index'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function ContextProbe() {
  const theme = useComposeThemeContext()
  const i18n = useComposeI18nContext()
  return (
    <output>
      {JSON.stringify({
        theme: theme?.theme,
        resolvedTheme: theme?.resolvedTheme,
        accent: theme?.tokens.accent,
        border: theme?.tokens.border,
        locale: i18n?.locale,
        title: i18n?.formatMessage('editor.settings', '设置'),
        add: i18n?.formatMessage('stage.add', '添加 {label}', { label: 'Text' }),
      })}
    </output>
  )
}

describe('Compose UI contexts', () => {
  it('OpenSpec: ui-context / 共享 UI Context 包 / 组合共享 UI 环境', () => {
    render(
      <ComposeUIProvider locale="en-US" theme="light">
        <ContextProbe />
      </ComposeUIProvider>,
    )

    expect(screen.getByText(/"theme":"light"/)).toHaveTextContent(
      '"resolvedTheme":"light"',
    )
    expect(screen.getByText(/"locale":"en-US"/)).toBeInTheDocument()
  })

  it('OpenSpec: ui-context / 可嵌套主题环境 / 继承并覆盖主题', () => {
    render(
      <ComposeThemeProvider
        overrides={{
          dark: { accent: '#ff00aa', border: '#123456' },
          light: { accent: '#0055ff' },
        }}
        theme="dark"
      >
        <ComposeThemeProvider overrides={{ dark: { accent: '#00ffaa' } }}>
          <ContextProbe />
        </ComposeThemeProvider>
      </ComposeThemeProvider>,
    )

    const output = screen.getByText(/"accent":"#00ffaa"/)
    expect(output).toHaveTextContent('"border":"#123456"')
    expect(output).toHaveTextContent('"theme":"dark"')
  })

  // OpenSpec: editor-workspace-layout / 工作区主题 token / 桌面色与面板色可分
  it('两种主题下桌面色都与面板色不同，且深色的桌面更暗', () => {
    /*
     * 桌面是卡片下面那张底。深色主题此前两个值都是 `#101216`——看不出问题只是因为那时没有任何
     * 地方露出桌面；卡片化之后同值会让卡片只剩边框在说话。
     */
    const luminance = (hex: string) => Number.parseInt(hex.slice(1, 3), 16)
      + Number.parseInt(hex.slice(3, 5), 16) + Number.parseInt(hex.slice(5, 7), 16)
    function SurfaceProbe() {
      const theme = useComposeThemeContext()
      return (
        <output data-testid="surfaces">
          {JSON.stringify({
            workspaceBackground: theme?.tokens.workspaceBackground,
            panelBackground: theme?.tokens.panelBackground,
          })}
        </output>
      )
    }
    for (const theme of ['dark', 'light'] as const) {
      render(
        <ComposeThemeProvider theme={theme}>
          <SurfaceProbe />
        </ComposeThemeProvider>,
      )
      const tokens = JSON.parse(screen.getByTestId('surfaces').textContent!)
      expect(tokens.workspaceBackground).not.toBe(tokens.panelBackground)
      if (theme === 'dark') {
        expect(luminance(tokens.workspaceBackground)).toBeLessThan(luminance(tokens.panelBackground))
      }
      cleanup()
    }
  })

  it('OpenSpec: ui-context / 可嵌套主题环境 / 跟随系统主题', () => {
    let dark = false
    let listener: (() => void) | null = null
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      get matches() {
        return dark
      },
      addEventListener: (_type: string, next: () => void) => {
        listener = next
      },
      removeEventListener: vi.fn(),
    })))

    render(
      <ComposeThemeProvider theme="system">
        <ContextProbe />
      </ComposeThemeProvider>,
    )
    expect(screen.getByText(/"theme":"system"/)).toHaveTextContent(
      '"resolvedTheme":"light"',
    )

    dark = true
    act(() => listener?.())
    expect(screen.getByText(/"theme":"system"/)).toHaveTextContent(
      '"resolvedTheme":"dark"',
    )
  })

  it('OpenSpec: ui-context / 可嵌套消息覆盖 / 覆盖单条内建消息', () => {
    render(
      <ComposeI18nProvider
        locale="en-US"
        messages={{ 'stage.add': 'Insert {label}' }}
      >
        <ContextProbe />
      </ComposeI18nProvider>,
    )

    const output = screen.getByText(/"add":"Insert Text"/)
    expect(output).toHaveTextContent('"title":"设置"')
  })

  it('OpenSpec: ui-context / 可嵌套消息覆盖 / 嵌套消息覆盖', () => {
    render(
      <ComposeI18nProvider
        locale="zh-CN"
        messages={{
          'editor.settings': '首选项',
          'stage.add': '加入 {label}',
        }}
      >
        <ComposeI18nProvider
          locale="en-US"
          messages={{ 'editor.settings': 'Preferences' }}
        >
          <ContextProbe />
        </ComposeI18nProvider>
      </ComposeI18nProvider>,
    )

    const output = screen.getByText(/"locale":"en-US"/)
    expect(output).toHaveTextContent('"title":"Preferences"')
    expect(output).toHaveTextContent('"add":"加入 Text"')
  })

  it('removes system listeners when the provider unmounts', () => {
    const removeEventListener = vi.fn()
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener,
    })))
    function ListenerProbe() {
      const theme = useComposeThemeContext()
      useEffect(() => {
        expect(theme?.theme).toBe('system')
      }, [theme])
      return null
    }
    const view = render(
      <ComposeThemeProvider theme="system">
        <ListenerProbe />
      </ComposeThemeProvider>,
    )

    view.unmount()
    expect(removeEventListener).toHaveBeenCalled()
  })
})
