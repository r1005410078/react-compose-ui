import { useCallback, useRef, useState } from 'react'

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
  /** 对话框被取消或关闭时调用；用于结束等待中的宿主取名。 */
  readonly onCancel?: () => void
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
  /**
   * 打开命名对话框并等待用户确认。
   *
   * @returns 用户确认的名称；取消或关闭时为 null。
   * @remarks
   * 与 {@link AssetNamePromptHandle.open} 不同，这里在提交时立即关闭对话框 —— 宿主拿到名称后
   * 自行处理失败，Asset Browser 无从判断宿主的写入是否成功。
   */
  promptName: (request: AssetNamePromptRequest) => Promise<string | null>
  close: () => void
}

/**
 * 管理命名对话框的打开、提交与关闭。
 *
 * @remarks
 * 内建的新建文件、新建目录、重命名与宿主菜单项的取名共用这一个状态机，避免每个入口各自
 * 维护一份对话框状态。
 * @internal
 */
export function useAssetNamePrompt(): AssetNamePromptHandle {
  const [state, setState] = useState<AssetNamePromptState | null>(null)
  // 关闭路径有多条（取消按钮、遮罩、Escape、宿主主动关闭），用 ref 保证等待中的取名
  // 只被结束一次。
  const cancelRef = useRef<(() => void) | null>(null)

  const finishCancel = useCallback(() => {
    const cancel = cancelRef.current
    cancelRef.current = null
    cancel?.()
  }, [])

  const open = useCallback((
    request: AssetNamePromptRequest,
    onSubmit: (value: string) => void,
  ) => {
    finishCancel()
    setState({ request, onSubmit })
  }, [finishCancel])

  const close = useCallback(() => {
    finishCancel()
    setState(null)
  }, [finishCancel])

  const promptName = useCallback((
    request: AssetNamePromptRequest,
  ) => new Promise<string | null>((resolve) => {
    finishCancel()
    let settled = false
    const settle = (value: string | null) => {
      if (settled) return
      settled = true
      cancelRef.current = null
      resolve(value)
    }
    cancelRef.current = () => { settle(null) }
    setState({
      request,
      onSubmit: (value) => {
        settle(value)
        setState(null)
      },
      onCancel: () => { settle(null) },
    })
  }), [finishCancel])

  return { state, open, promptName, close }
}
