import { useContext } from 'react'
import { I18nContext, ThemeContext } from './context-internals'
import type {
  ComposeI18nContextValue,
  ComposeThemeContextValue,
} from './types'

/**
 * 读取最近的主题环境。
 *
 * @returns Provider 外返回 null，便于独立组件保留其历史默认值。
 * @public
 */
export function useComposeThemeContext(): ComposeThemeContextValue | null {
  return useContext(ThemeContext)
}

/**
 * 读取最近的国际化环境。
 *
 * @returns Provider 外返回 null，便于独立组件保留其历史默认语言。
 * @public
 */
export function useComposeI18nContext(): ComposeI18nContextValue | null {
  return useContext(I18nContext)
}
