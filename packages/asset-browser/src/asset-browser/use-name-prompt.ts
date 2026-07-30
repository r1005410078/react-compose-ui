import { useCallback, useState } from 'react'

/** 一次取名请求的呈现内容。 @internal */
export interface AssetNamePromptRequest {
  readonly title: string
  readonly initialValue: string
  readonly confirmLabel: string
}

/** 命名对话框当前的请求与提交处理。 @internal */
export interface AssetNamePromptState {
  readonly request: AssetNamePromptRequest
  readonly onSubmit: (value: string) => void
}

/** 命名对话框状态机句柄。 @internal */
export interface AssetNamePromptHandle {
  readonly state: AssetNamePromptState | null
  /**
   * 打开命名对话框。
   *
   * @remarks
   * 提交后对话框保持打开，由 `onSubmit` 在成功时调用 {@link AssetNamePromptHandle.close}。
   * 这样写入失败时用户能在原对话框中修正名称重试，而不是被迫重新打开。
   */
  open: (request: AssetNamePromptRequest, onSubmit: (value: string) => void) => void
  close: () => void
}

/**
 * 管理命名对话框的打开、提交与关闭。
 *
 * @remarks
 * 内建的新建文件、新建目录、重命名共用这一个状态机，避免每个入口各自维护一份对话框状态。
 * @internal
 */
export function useAssetNamePrompt(): AssetNamePromptHandle {
  const [state, setState] = useState<AssetNamePromptState | null>(null)
  const open = useCallback((
    request: AssetNamePromptRequest,
    onSubmit: (value: string) => void,
  ) => {
    setState({ request, onSubmit })
  }, [])
  const close = useCallback(() => { setState(null) }, [])
  return { state, open, close }
}
