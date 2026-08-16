import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef } from 'react'
import type {
  CSSProperties,
  InputHTMLAttributes,
} from 'react'
import { cn } from '#lib/utils'

type ComposeDataAttributes = {
  readonly [name: `data-${string}`]: string | number | undefined
}

/**
 * 输入框尺寸变体。
 *
 * @remarks
 * 与 {@link ComposeButton} 的 size 变体对齐。密集面板（时间线工具栏、属性行）需要比
 * 默认表单尺寸更矮的控件，没有变体时消费方只能各自用 className 覆盖高度和字号，
 * 那既会与 Primitive 的设计对抗，也会在样式层级调整时碎掉。
 */
const composeInputVariants = cva(
  'cu:flex cu:w-full cu:min-w-0 cu:rounded-md cu:border cu:border-input cu:bg-background cu:text-foreground cu:shadow-xs cu:transition-[color,box-shadow] cu:outline-none cu:placeholder:text-muted-foreground cu:focus-visible:border-ring cu:focus-visible:ring-2 cu:focus-visible:ring-ring/50 cu:disabled:cursor-not-allowed cu:disabled:opacity-50 cu:aria-invalid:border-destructive cu:aria-invalid:ring-2 cu:aria-invalid:ring-destructive/20',
  {
    variants: {
      size: {
        default: 'cu:h-9 cu:px-3 cu:py-1 cu:text-base md:cu:text-sm',
        sm: 'cu:h-7 cu:px-2 cu:py-0.5 cu:text-xs',
        xs: 'cu:h-[22px] cu:rounded-sm cu:px-1.5 cu:py-0 cu:text-[11px]',
      },
    },
    defaultVariants: { size: 'default' },
  },
)

/**
 * Shadcn source Input 经 Compose 命名和主题边界适配后的公开属性。
 *
 * @remarks
 * 原生 `size`（字符宽度）被 Omit 掉：它与尺寸变体的 `size` 同名，交叉后类型会塌成
 * `never`。需要按字符数限宽的场景用 CSS 宽度表达，比原生属性更可控。
 */
export type ComposeInputProps =
  & Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>
  & ComposeDataAttributes
  & VariantProps<typeof composeInputVariants>

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
  function ComposeInput({ className, lang, size, style, type = 'text', ...inputProps }, ref) {
    const theme = useComposeThemeContext()
    const i18n = useComposeI18nContext()
    return (
      <input
        {...inputProps}
        ref={ref}
        className={cn(composeInputVariants({ className, size }))}
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
