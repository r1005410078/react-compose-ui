import { AlertDialog } from '@base-ui/react/alert-dialog'
import { useComposeThemeContext, createComposeThemeStyle } from '@compose-ui/ui-context'
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
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="cu:fixed cu:inset-0 cu:z-[20000] cu:bg-black/50" />
        <AlertDialog.Viewport className="cu:fixed cu:inset-0 cu:z-[20000] cu:grid cu:place-items-center cu:p-4">
          <AlertDialog.Popup
            className="cu:w-full cu:max-w-sm cu:rounded-md cu:border cu:border-border cu:bg-popover cu:p-5 cu:text-popover-foreground cu:shadow-lg cu:outline-none"
            data-compose-ui="confirm-dialog"
            style={theme ? createComposeThemeStyle(theme.tokens) as CSSProperties : undefined}
          >
            <AlertDialog.Title className="cu:text-sm cu:font-medium">{title}</AlertDialog.Title>
            <AlertDialog.Description className="cu:mt-2 cu:text-sm cu:text-muted-foreground">
              {description}
            </AlertDialog.Description>
            <div className="cu:mt-5 cu:flex cu:justify-end cu:gap-2">
              <AlertDialog.Close className="cu:rounded-sm cu:border cu:border-border cu:bg-secondary cu:px-3 cu:py-2 cu:text-sm">
                {cancelLabel}
              </AlertDialog.Close>
              <button
                className={destructive
                  ? 'cu:rounded-sm cu:border cu:border-destructive cu:bg-destructive/10 cu:px-3 cu:py-2 cu:text-sm cu:text-destructive'
                  : 'cu:rounded-sm cu:border cu:border-primary cu:bg-primary cu:px-3 cu:py-2 cu:text-sm cu:text-primary-foreground'}
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
