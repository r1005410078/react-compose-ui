import {
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  I18nContext,
  ThemeContext,
} from './context-internals'
import type {
  InternalI18nContextValue,
  InternalThemeContextValue,
} from './context-internals'
import type {
  ComposeI18nProviderProps,
  ComposeResolvedTheme,
  ComposeThemeOverrides,
  ComposeThemeProviderProps,
  ComposeThemeTokens,
  ComposeUIProviderProps,
} from './types'
import './styles.css'

const DEFAULT_THEME_TOKENS: Readonly<Record<ComposeResolvedTheme, ComposeThemeTokens>> = {
  dark: {
    workspaceBackground: '#101216',
    panelBackground: '#101216',
    surfaceRaised: '#181b20',
    surfaceSunken: '#15181d',
    surfaceActive: '#20242b',
    surfaceControl: '#1d2025',
    surfaceHover: '#292e36',
    surfaceSelected: '#1b395f',
    border: '#303640',
    borderStrong: '#414853',
    text: '#e6edf7',
    textStrong: '#f4f7fb',
    textMuted: '#8e98a8',
    textSubtle: '#aeb7c4',
    accent: '#3687ff',
    focus: '#4d9cff',
    danger: '#ff9c9c',
    scrollbar: '#454d59',
    shadow: 'rgb(0 0 0 / 45%)',
  },
  light: {
    workspaceBackground: '#f3f5f8',
    panelBackground: '#ffffff',
    surfaceRaised: '#eef1f5',
    surfaceSunken: '#e9edf2',
    surfaceActive: '#ffffff',
    surfaceControl: '#f8f9fb',
    surfaceHover: '#e5eaf0',
    surfaceSelected: '#dbeafe',
    border: '#c8d0da',
    borderStrong: '#aeb8c5',
    text: '#263241',
    textStrong: '#101828',
    textMuted: '#667085',
    textSubtle: '#475467',
    accent: '#1769d2',
    focus: '#1769d2',
    danger: '#b42318',
    scrollbar: '#98a2b3',
    shadow: 'rgb(16 24 40 / 18%)',
  },
}

function mergeThemeOverrides(
  parent: ComposeThemeOverrides | undefined,
  next: ComposeThemeOverrides | undefined,
): ComposeThemeOverrides {
  return {
    dark: { ...parent?.dark, ...next?.dark },
    light: { ...parent?.light, ...next?.light },
  }
}

function browserPrefersDark() {
  return typeof matchMedia === 'function'
    ? matchMedia('(prefers-color-scheme: dark)').matches
    : true
}

/**
 * 在 React 子树中提供可继承的主题偏好与语义 token。
 *
 * @param props - 可选主题、按 Dark/Light 分组的 token 覆盖和 React 子树。
 * @returns Theme Context Provider。
 * @public
 */
export function ComposeThemeProvider({
  children,
  theme,
  overrides,
}: ComposeThemeProviderProps) {
  const parent = useContext(ThemeContext)
  const selectedTheme = theme ?? parent?.theme ?? 'dark'
  const [systemDark, setSystemDark] = useState(browserPrefersDark)

  useEffect(() => {
    if (selectedTheme !== 'system' || typeof matchMedia !== 'function') return
    const query = matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [selectedTheme])

  const resolvedTheme = selectedTheme === 'system'
    ? systemDark ? 'dark' : 'light'
    : selectedTheme
  const mergedOverrides = useMemo(
    () => mergeThemeOverrides(parent?.overrides, overrides),
    [overrides, parent?.overrides],
  )
  const value = useMemo<InternalThemeContextValue>(() => ({
    theme: selectedTheme,
    resolvedTheme,
    tokens: {
      ...DEFAULT_THEME_TOKENS[resolvedTheme],
      ...mergedOverrides[resolvedTheme],
    },
    overrides: mergedOverrides,
  }), [mergedOverrides, resolvedTheme, selectedTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

function formatTemplate(
  template: string,
  variables?: Readonly<Record<string, string | number>>,
) {
  if (!variables) return template
  return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key)
      ? String(variables[key])
      : match)
}

/**
 * 在 React 子树中提供可继承的语言和单条内建消息覆盖。
 *
 * @param props - 可选语言、稳定 message ID 模板覆盖和 React 子树。
 * @returns I18n Context Provider。
 * @public
 */
export function ComposeI18nProvider({
  children,
  locale,
  messages,
}: ComposeI18nProviderProps) {
  const parent = useContext(I18nContext)
  const resolvedLocale = locale ?? parent?.locale ?? 'zh-CN'
  const mergedMessages = useMemo(
    () => ({ ...parent?.messages, ...messages }),
    [messages, parent?.messages],
  )
  const value = useMemo<InternalI18nContextValue>(() => ({
    locale: resolvedLocale,
    messages: mergedMessages,
    formatMessage: (id, fallback, variables) =>
      formatTemplate(mergedMessages[id] ?? fallback, variables),
  }), [mergedMessages, resolvedLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/**
 * 同时提供共享主题和国际化环境。
 *
 * @param props - Theme/I18n Provider 的组合属性。
 * @returns 按 Theme → I18n 顺序组合的 Provider。
 * @public
 */
export function ComposeUIProvider({
  children,
  theme,
  overrides,
  locale,
  messages,
}: ComposeUIProviderProps) {
  return (
    <ComposeThemeProvider overrides={overrides} theme={theme}>
      <ComposeI18nProvider locale={locale} messages={messages}>
        {children}
      </ComposeI18nProvider>
    </ComposeThemeProvider>
  )
}
