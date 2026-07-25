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
