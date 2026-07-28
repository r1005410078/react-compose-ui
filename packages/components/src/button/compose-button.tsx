import { Button as ButtonPrimitive } from '@base-ui/react/button'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import { cva, type VariantProps } from 'class-variance-authority'
import type { CSSProperties } from 'react'
import { cn } from '#lib/utils'

const composeButtonVariants = cva(
  'cu:group/button cu:inline-flex cu:shrink-0 cu:items-center cu:justify-center cu:rounded-md cu:border cu:border-transparent cu:bg-clip-padding cu:text-sm cu:font-medium cu:whitespace-nowrap cu:transition-all cu:outline-none cu:select-none cu:focus-visible:border-ring cu:focus-visible:ring-2 cu:focus-visible:ring-ring/50 cu:active:not-aria-[haspopup]:translate-y-px cu:disabled:pointer-events-none cu:disabled:opacity-50 cu:aria-invalid:border-destructive cu:aria-invalid:ring-2 cu:aria-invalid:ring-destructive/20 cu:[&_svg]:pointer-events-none cu:[&_svg]:shrink-0 cu:[&_svg:not([class*=size-])]:size-4',
  {
    variants: {
      variant: {
        default: 'cu:bg-primary cu:text-primary-foreground cu:hover:bg-primary/80',
        outline:
          'cu:border-border cu:bg-background cu:hover:bg-muted cu:hover:text-foreground cu:aria-expanded:bg-muted cu:aria-expanded:text-foreground',
        secondary:
          'cu:bg-secondary cu:text-secondary-foreground cu:hover:bg-secondary/80 cu:aria-expanded:bg-secondary cu:aria-expanded:text-secondary-foreground',
        ghost:
          'cu:hover:bg-muted cu:hover:text-foreground cu:aria-expanded:bg-muted cu:aria-expanded:text-foreground',
        destructive:
          'cu:bg-destructive cu:text-destructive-foreground cu:hover:bg-destructive/90 cu:focus-visible:border-destructive/40 cu:focus-visible:ring-destructive/20',
        link: 'cu:text-primary cu:underline-offset-4 cu:hover:underline',
      },
      size: {
        default: 'cu:h-8 cu:gap-1.5 cu:px-2.5',
        xs: 'cu:h-6 cu:gap-1 cu:px-2 cu:text-xs',
        sm: 'cu:h-7 cu:gap-1 cu:px-2.5 cu:text-[0.8rem]',
        lg: 'cu:h-9 cu:gap-1.5 cu:px-3',
        icon: 'cu:size-8',
        'icon-xs': 'cu:size-6',
        'icon-sm': 'cu:size-7',
        'icon-lg': 'cu:size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ComposeDataAttributes = {
  readonly [name: `data-${string}`]: string | number | undefined
}

/** Shadcn source Button 经 Compose 命名、主题和样式边界适配后的公开属性。 */
export type ComposeButtonProps = ButtonPrimitive.Props
  & VariantProps<typeof composeButtonVariants>
  & ComposeDataAttributes

/**
 * 通用按钮 Primitive。
 *
 * @remarks
 * 组件源码以 Shadcn Button 为基础并由本包维护。它会在自身根节点写入 Compose Theme token，
 * 因此既可独立使用，也会跟随 `ComposeThemeProvider` 的 Dark/Light 与 token 覆盖。
 *
 * @public
 */
export function ComposeButton({
  className,
  lang,
  size,
  style,
  variant,
  ...buttonProps
}: ComposeButtonProps) {
  const theme = useComposeThemeContext()
  const i18n = useComposeI18nContext()

  return (
    <ButtonPrimitive
      {...buttonProps}
      className={cn(composeButtonVariants({ className, size, variant }))}
      data-compose-theme={theme?.resolvedTheme ?? 'dark'}
      data-compose-ui="button"
      data-slot="button"
      lang={lang ?? i18n?.locale ?? 'zh-CN'}
      style={{
        ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
        ...style,
      } as CSSProperties}
    />
  )
}
