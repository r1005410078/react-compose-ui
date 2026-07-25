import { createContext } from 'react'
import type {
  ComposeI18nContextValue,
  ComposeMessageOverrides,
  ComposeThemeContextValue,
  ComposeThemeOverrides,
} from './types'

export interface InternalThemeContextValue extends ComposeThemeContextValue {
  readonly overrides: ComposeThemeOverrides
}

export interface InternalI18nContextValue extends ComposeI18nContextValue {
  readonly messages: ComposeMessageOverrides
}

export const ThemeContext = createContext<InternalThemeContextValue | null>(null)
export const I18nContext = createContext<InternalI18nContextValue | null>(null)
