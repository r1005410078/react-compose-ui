import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import type {
  DialogBackdropProps as BaseBackdropProps,
  DialogCloseProps as BaseCloseProps,
  DialogDescriptionProps as BaseDescriptionProps,
  DialogPopupProps as BasePopupProps,
  DialogPortalProps as BasePortalProps,
  DialogRootProps as BaseRootProps,
  DialogTitleProps as BaseTitleProps,
  DialogTriggerProps as BaseTriggerProps,
  DialogViewportProps as BaseViewportProps,
} from '@base-ui/react/dialog'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import { forwardRef } from 'react'
import type {
  CSSProperties,
  HTMLAttributes,
} from 'react'
import { cn } from '#lib/utils'

/** Compose Dialog 开关变化回调。 */
export type ComposeDialogOpenChange = (open: boolean) => void

/** Compose Dialog Root 的公开属性。 */
export interface ComposeDialogProps extends Omit<BaseRootProps, 'onOpenChange'> {
  /** Dialog 可见状态变化后的通知。 */
  readonly onOpenChange?: ComposeDialogOpenChange
}

/**
 * Shadcn/Base UI Dialog 的 Compose 命名 Root。
 *
 * @remarks
 * Root 不产生额外 DOM。配合 `ComposeDialogPortal` 时，内容会挂到 document body，使 Dialog 的遮罩
 * 覆盖完整浏览器视口，不被 Dockview 或任意嵌入容器裁剪。
 *
 * @public
 */
export function ComposeDialog({ onOpenChange, ...props }: ComposeDialogProps) {
  return (
    <DialogPrimitive.Root
      {...props}
      onOpenChange={(open) => onOpenChange?.(open)}
    />
  )
}

/** Compose Dialog Trigger 属性。 */
export type ComposeDialogTriggerProps = BaseTriggerProps

/** 打开 Dialog 的标准 button。 */
export const ComposeDialogTrigger = forwardRef<HTMLButtonElement, ComposeDialogTriggerProps>(
  function ComposeDialogTrigger({ className, ...props }, ref) {
    return (
      <DialogPrimitive.Trigger
        {...props}
        ref={ref}
        className={cn(className)}
        data-compose-ui="dialog-trigger"
        data-slot="dialog-trigger"
      />
    )
  },
)

/** Compose Dialog Portal 属性。Dialog 不支持限定 container，以保持全视口行为。 */
export type ComposeDialogPortalProps = Omit<BasePortalProps, 'container'>

/** 将 Dialog 的各部分挂到 document body。 */
export const ComposeDialogPortal = forwardRef<HTMLDivElement, ComposeDialogPortalProps>(
  function ComposeDialogPortal(props, ref) {
    return <DialogPrimitive.Portal {...props} ref={ref} />
  },
)

/** Compose Dialog Backdrop 属性。 */
export type ComposeDialogBackdropProps = BaseBackdropProps

/** 覆盖完整 visual viewport 的半透明遮罩。 */
export const ComposeDialogBackdrop = forwardRef<HTMLDivElement, ComposeDialogBackdropProps>(
  function ComposeDialogBackdrop({ className, ...props }, ref) {
    return (
      <DialogPrimitive.Backdrop
        {...props}
        ref={ref}
        className={cn(
          'cu:fixed cu:inset-0 cu:z-[20000] cu:bg-black/80 cu:data-[ending-style]:opacity-0',
          className,
        )}
        data-compose-ui="dialog-backdrop"
        data-slot="dialog-backdrop"
      />
    )
  },
)

/** Compose Dialog Viewport 属性。 */
export type ComposeDialogViewportProps = BaseViewportProps

/** 覆盖完整 visual viewport、负责居中和滚动的 Dialog 容器。 */
export const ComposeDialogViewport = forwardRef<HTMLDivElement, ComposeDialogViewportProps>(
  function ComposeDialogViewport({ className, ...props }, ref) {
    return (
      <DialogPrimitive.Viewport
        {...props}
        ref={ref}
        className={cn(
          'cu:fixed cu:inset-0 cu:z-[20000] cu:grid cu:place-items-center cu:overflow-y-auto cu:p-4',
          className,
        )}
        data-compose-ui="dialog-viewport"
        data-slot="dialog-viewport"
      />
    )
  },
)

/** Compose Dialog Content 属性。 */
export type ComposeDialogContentProps = BasePopupProps

/**
 * 居中的 Dialog 内容表面。
 *
 * @remarks
 * Portal 脱离 Provider 根节点的 CSS 继承链，因此 Content 主动同步解析后的 Compose Theme 与 locale。
 *
 * @public
 */
export const ComposeDialogContent = forwardRef<HTMLDivElement, ComposeDialogContentProps>(
  function ComposeDialogContent({ className, style, ...props }, ref) {
    const theme = useComposeThemeContext()
    const i18n = useComposeI18nContext()
    return (
      <DialogPrimitive.Popup
        {...props}
        ref={ref}
        aria-modal="true"
        className={cn(
          'cu:w-full cu:max-w-md cu:max-h-[calc(100dvh-2rem)] cu:overflow-y-auto cu:rounded-lg cu:border cu:border-border cu:bg-background cu:p-6 cu:text-foreground cu:shadow-lg cu:outline-none cu:data-[ending-style]:opacity-0',
          className,
        )}
        data-compose-theme={theme?.resolvedTheme ?? 'dark'}
        data-compose-ui="dialog"
        data-slot="dialog-content"
        lang={i18n?.locale ?? 'zh-CN'}
        style={{
          ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
          ...style,
        } as CSSProperties}
      />
    )
  },
)

/** Compose Dialog Header 属性。 */
export type ComposeDialogHeaderProps = HTMLAttributes<HTMLDivElement>

/** Dialog 标题区域的布局容器。 */
export const ComposeDialogHeader = forwardRef<HTMLDivElement, ComposeDialogHeaderProps>(
  function ComposeDialogHeader({ className, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        className={cn('cu:flex cu:flex-col cu:gap-1.5 cu:text-left', className)}
        data-slot="dialog-header"
      />
    )
  },
)

/** Compose Dialog Footer 属性。 */
export type ComposeDialogFooterProps = HTMLAttributes<HTMLDivElement>

/** Dialog 操作区域的布局容器。 */
export const ComposeDialogFooter = forwardRef<HTMLDivElement, ComposeDialogFooterProps>(
  function ComposeDialogFooter({ className, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        className={cn('cu:mt-6 cu:flex cu:flex-wrap cu:justify-end cu:gap-2', className)}
        data-slot="dialog-footer"
      />
    )
  },
)

/** Compose Dialog Title 属性。 */
export type ComposeDialogTitleProps = BaseTitleProps

/** 为 Dialog 提供可访问名称的标题。 */
export const ComposeDialogTitle = forwardRef<HTMLHeadingElement, ComposeDialogTitleProps>(
  function ComposeDialogTitle({ className, ...props }, ref) {
    return (
      <DialogPrimitive.Title
        {...props}
        ref={ref}
        className={cn('cu:text-lg cu:font-semibold cu:leading-none cu:tracking-tight cu:text-foreground', className)}
        data-slot="dialog-title"
      />
    )
  },
)

/** Compose Dialog Description 属性。 */
export type ComposeDialogDescriptionProps = BaseDescriptionProps

/** Dialog 的补充说明。 */
export const ComposeDialogDescription = forwardRef<
  HTMLParagraphElement,
  ComposeDialogDescriptionProps
>(function ComposeDialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      {...props}
      ref={ref}
      className={cn('cu:mt-2 cu:text-sm cu:text-muted-foreground', className)}
      data-slot="dialog-description"
    />
  )
})

/** Compose Dialog Close 属性。 */
export type ComposeDialogCloseProps = BaseCloseProps

/** 关闭 Dialog 的标准 button。 */
export const ComposeDialogClose = forwardRef<HTMLButtonElement, ComposeDialogCloseProps>(
  function ComposeDialogClose({ className, ...props }, ref) {
    return (
      <DialogPrimitive.Close
        {...props}
        ref={ref}
        className={cn(
          'cu:inline-flex cu:h-9 cu:items-center cu:justify-center cu:rounded-md cu:border cu:border-border cu:bg-background cu:px-3 cu:text-sm cu:font-medium cu:text-foreground cu:transition-colors cu:outline-none cu:hover:bg-muted cu:focus-visible:border-ring cu:focus-visible:ring-2 cu:focus-visible:ring-ring/50 cu:disabled:pointer-events-none cu:disabled:opacity-50',
          className,
        )}
        data-slot="dialog-close"
      />
    )
  },
)
