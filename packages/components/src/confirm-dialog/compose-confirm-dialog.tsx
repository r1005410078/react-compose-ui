import { AlertDialog } from '@base-ui/react/alert-dialog'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import type { CSSProperties } from 'react'

/** 受控确认对话框属性。 */
export interface ComposeConfirmDialogProps {
  readonly open: boolean
  readonly title: string
  readonly description: string
  readonly confirmLabel: string
  readonly cancelLabel: string
  readonly destructive?: boolean
  onConfirm(): void
  onOpenChange(open: boolean): void
}

/**
 * 基于 Base UI AlertDialog 的 Compose 确认对话框。
 *
 * @public
 */
export function ComposeConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onOpenChange,
}: ComposeConfirmDialogProps) {
  const theme = useComposeThemeContext()
  const i18n = useComposeI18nContext()
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="cu:fixed cu:inset-0 cu:z-[20000] cu:bg-black/80" />
        <AlertDialog.Viewport className="cu:fixed cu:inset-0 cu:z-[20000] cu:grid cu:place-items-center cu:p-4">
          <AlertDialog.Popup
            className="cu:w-full cu:max-w-sm cu:rounded-lg cu:border cu:border-border cu:bg-background cu:p-6 cu:text-foreground cu:shadow-lg cu:outline-none"
            data-compose-theme={theme?.resolvedTheme ?? 'dark'}
            data-compose-ui="confirm-dialog"
            lang={i18n?.locale ?? 'zh-CN'}
            style={theme ? createComposeThemeStyle(theme.tokens) as CSSProperties : undefined}
          >
            <AlertDialog.Title className="cu:text-lg cu:font-semibold cu:leading-none cu:tracking-tight">{title}</AlertDialog.Title>
            <AlertDialog.Description className="cu:mt-2 cu:text-sm cu:text-muted-foreground">
              {description}
            </AlertDialog.Description>
            <div className="cu:mt-6 cu:flex cu:flex-wrap cu:justify-end cu:gap-2">
              <AlertDialog.Close className="cu:inline-flex cu:h-9 cu:items-center cu:justify-center cu:rounded-md cu:border cu:border-border cu:bg-background cu:px-3 cu:text-sm cu:font-medium cu:text-foreground cu:transition-colors cu:hover:bg-muted cu:focus-visible:border-ring cu:focus-visible:ring-2 cu:focus-visible:ring-ring/50">
                {cancelLabel}
              </AlertDialog.Close>
              <button
                className={destructive
                  ? 'cu:inline-flex cu:h-9 cu:items-center cu:justify-center cu:rounded-md cu:bg-destructive cu:px-3 cu:text-sm cu:font-medium cu:text-destructive-foreground cu:transition-colors cu:hover:bg-destructive/90 cu:focus-visible:border-destructive cu:focus-visible:ring-2 cu:focus-visible:ring-destructive/20'
                  : 'cu:inline-flex cu:h-9 cu:items-center cu:justify-center cu:rounded-md cu:bg-primary cu:px-3 cu:text-sm cu:font-medium cu:text-primary-foreground cu:transition-colors cu:hover:bg-primary/80 cu:focus-visible:border-ring cu:focus-visible:ring-2 cu:focus-visible:ring-ring/50'}
                data-danger={destructive ? 'true' : undefined}
                type="button"
                onClick={onConfirm}
              >{confirmLabel}</button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
