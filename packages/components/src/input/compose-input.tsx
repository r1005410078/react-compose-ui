import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import { forwardRef } from 'react'
import type {
  CSSProperties,
  InputHTMLAttributes,
} from 'react'
import { cn } from '#lib/utils'

type ComposeDataAttributes = {
  readonly [name: `data-${string}`]: string | number | undefined
}

/** Shadcn source Input 经 Compose 命名和主题边界适配后的公开属性。 */
export type ComposeInputProps = InputHTMLAttributes<HTMLInputElement> & ComposeDataAttributes

/**
 * 通用单行输入框 Primitive。
 *
 * @remarks
 * 组件以 Shadcn Input 的源码样式为基础。它会在根节点同步 Compose Theme token，因此既能在
 * Dialog Portal 内继承主题，也可脱离 Provider 安全地以 Dark fallback 独立使用。
 *
 * @public
 */
export const ComposeInput = forwardRef<HTMLInputElement, ComposeInputProps>(
  function ComposeInput({ className, lang, style, type = 'text', ...inputProps }, ref) {
    const theme = useComposeThemeContext()
    const i18n = useComposeI18nContext()
    return (
      <input
        {...inputProps}
        ref={ref}
        className={cn(
          'cu:flex cu:h-9 cu:w-full cu:min-w-0 cu:rounded-md cu:border cu:border-input cu:bg-background cu:px-3 cu:py-1 cu:text-base cu:text-foreground cu:shadow-xs cu:transition-[color,box-shadow] cu:outline-none cu:placeholder:text-muted-foreground cu:focus-visible:border-ring cu:focus-visible:ring-2 cu:focus-visible:ring-ring/50 cu:disabled:cursor-not-allowed cu:disabled:opacity-50 md:cu:text-sm cu:aria-invalid:border-destructive cu:aria-invalid:ring-2 cu:aria-invalid:ring-destructive/20',
          className,
        )}
        data-compose-theme={theme?.resolvedTheme ?? 'dark'}
        data-compose-ui="input"
        data-slot="input"
        lang={lang ?? i18n?.locale ?? 'zh-CN'}
        style={{
          ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
          ...style,
        } as CSSProperties}
        type={type}
      />
    )
  },
)
