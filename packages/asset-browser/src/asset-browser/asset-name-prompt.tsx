import {
  ComposeButton,
  ComposeDialog,
  ComposeDialogBackdrop,
  ComposeDialogContent,
  ComposeDialogFooter,
  ComposeDialogHeader,
  ComposeDialogPortal,
  ComposeDialogTitle,
  ComposeDialogViewport,
  ComposeInput,
} from '@compose-ui/components'
import { useRef, useState } from 'react'
import type { AssetBrowserMessages } from '../asset-browser-i18n'
import type { AssetNamePromptRequest } from './use-name-prompt'

/**
 * 渲染命名对话框。
 *
 * @remarks
 * 由调用方按 {@link AssetNamePromptHandle.state} 条件挂载，使每次打开都以请求的初始值重建
 * 输入草稿。
 * @internal
 */
export function AssetNamePromptDialog({
  messages,
  request,
  onClose,
  onSubmit,
}: {
  readonly messages: AssetBrowserMessages
  readonly request: AssetNamePromptRequest
  readonly onClose: () => void
  readonly onSubmit: (value: string) => void
}) {
  const [value, setValue] = useState(request.initialValue)
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <ComposeDialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <ComposeDialogPortal>
        <ComposeDialogBackdrop />
        <ComposeDialogViewport>
          <ComposeDialogContent initialFocus={inputRef}>
            <form className="cu:grid cu:gap-5" onSubmit={(event) => {
              event.preventDefault()
              onSubmit(value)
            }}>
              <ComposeDialogHeader>
                <ComposeDialogTitle>{request.title}</ComposeDialogTitle>
              </ComposeDialogHeader>
              <label className="cu:grid cu:gap-2 cu:text-sm cu:font-medium cu:text-foreground">
                <span>{messages.name}</span>
                <ComposeInput
                  ref={inputRef}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
              </label>
              <ComposeDialogFooter>
                <ComposeButton
                  type="button"
                  variant="outline"
                  onClick={onClose}
                >{messages.cancel}</ComposeButton>
                <ComposeButton type="submit">{request.confirmLabel}</ComposeButton>
              </ComposeDialogFooter>
            </form>
          </ComposeDialogContent>
        </ComposeDialogViewport>
      </ComposeDialogPortal>
    </ComposeDialog>
  )
}
