import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ComposePreview } from '../compose-preview'
import type { ComposePreviewProps, ComposePreviewTarget } from '../compose-preview'
import './styles.css'

type PreviewDialogScale = '1' | '0.75' | '0.5'
type PreviewDialogTarget = Extract<ComposePreviewTarget, { readonly kind: 'document' }>['kind']
  | Extract<ComposePreviewTarget, { readonly kind: 'container' }>['kind']

/** ComposePreviewDialog 的可本地化文案。 @public */
export interface ComposePreviewDialogMessages {
  /** 对话框标题。 */
  readonly title: string
  /** 完整文档范围标签。 */
  readonly document: string
  /** 指定容器范围标签。 */
  readonly selectedContainer: string
  /** 范围选择的无障碍名称。 */
  readonly target: string
  /** 缩放选择的无障碍名称。 */
  readonly scale: string
  /** 进入全屏的无障碍名称。 */
  readonly enterFullscreen: string
  /** 退出全屏的无障碍名称。 */
  readonly exitFullscreen: string
  /** 关闭操作的无障碍名称。 */
  readonly close: string
  /** 键盘关闭提示。 */
  readonly closeHint: string
}

const DEFAULT_MESSAGES: ComposePreviewDialogMessages = {
  title: 'Preview',
  document: 'Document',
  selectedContainer: 'Selected container',
  target: 'Preview target',
  scale: 'Preview scale',
  enterFullscreen: 'Enter fullscreen preview',
  exitFullscreen: 'Exit fullscreen preview',
  close: 'Close preview',
  closeHint: 'Press Esc to close preview',
}

/** ComposePreviewDialog 属性。 @public */
export interface ComposePreviewDialogProps extends Pick<ComposePreviewProps,
  | 'assetResolver'
  | 'document'
  | 'layoutRuntime'
  | 'layoutSnapshot'
  | 'page'
  | 'pageLoader'
  | 'registry'
  | 'scriptModuleLoader'
  | 'scriptScope'> {
  /** 是否显示对话框；状态完全由宿主控制。 */
  readonly open: boolean
  /** 用户请求打开或关闭对话框时调用。 */
  readonly onOpenChange: (open: boolean) => void
  /** 可选的 Hierarchy Container ID；提供后允许切换到该局部预览。 */
  readonly containerId?: string | null
  /** 覆盖由标题派生的 Dialog 无障碍名称。 */
  readonly dialogLabel?: string
  /** 覆盖默认英文文案的本地化内容。 */
  readonly messages?: Partial<ComposePreviewDialogMessages>
}

function PreviewIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

function FullscreenIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4" />
    </svg>
  )
}

/**
 * 在模态画板中输出完整文档或指定 Container 的只读预览。
 *
 * @remarks
 * Dialog 的可见性由 `open` 与 `onOpenChange` 控制；缩放、范围与全屏仅属于当前预览会话，
 * 不会改变传入的 ComposeDocument。
 *
 * @public
 */
export function ComposePreviewDialog({
  assetResolver,
  containerId,
  dialogLabel,
  document: composeDocument,
  page,
  layoutRuntime,
  layoutSnapshot,
  messages: messageOverrides,
  onOpenChange,
  open,
  pageLoader,
  registry,
  scriptModuleLoader,
  scriptScope,
}: ComposePreviewDialogProps) {
  const messages = { ...DEFAULT_MESSAGES, ...messageOverrides }
  const titleId = useId()
  const shell = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const focusBeforeOpen = useRef<HTMLElement | null>(null)
  const [scale, setScale] = useState<PreviewDialogScale>('0.75')
  const [target, setTarget] = useState<PreviewDialogTarget>('document')
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    if (open) {
      focusBeforeOpen.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
      closeButton.current?.focus()
      return
    }
    focusBeforeOpen.current?.focus()
    focusBeforeOpen.current = null
  }, [open])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(document.fullscreenElement === shell.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenChange, open])

  if (!open || typeof window === 'undefined') return null

  const activeTarget: PreviewDialogTarget = target === 'container' && containerId
    ? 'container'
    : 'document'
  const previewTarget: ComposePreviewTarget = activeTarget === 'container' && containerId
    ? { kind: 'container', entityId: containerId }
    : { kind: 'document' }
  const toggleFullscreen = () => {
    const element = shell.current
    if (!element) return
    if (document.fullscreenElement === element) {
      void document.exitFullscreen()
      return
    }
    void element.requestFullscreen().catch(() => undefined)
  }

  return createPortal(
    <div
      className="compose-preview-dialog__backdrop"
      data-compose-ui="preview-dialog-backdrop"
      data-testid="compose-preview-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false)
      }}
    >
      <div
        {...(dialogLabel ? { 'aria-label': dialogLabel } : { 'aria-labelledby': titleId })}
        aria-modal="true"
        className="compose-preview-dialog"
        data-compose-ui="preview-dialog"
        ref={shell}
        role="dialog"
      >
        <header className="compose-preview-dialog__header">
          <div className="compose-preview-dialog__title">
            <PreviewIcon />
            <span id={titleId}>{messages.title}</span>
          </div>
          <div aria-label={messages.target} className="compose-preview-dialog__target" role="group">
            <button
              aria-pressed={activeTarget === 'document'}
              type="button"
              onClick={() => setTarget('document')}
            >
              {messages.document}
            </button>
            <button
              aria-pressed={activeTarget === 'container'}
              disabled={!containerId}
              type="button"
              onClick={() => setTarget('container')}
            >
              {messages.selectedContainer}
            </button>
          </div>
          <div className="compose-preview-dialog__actions">
            <label>
              <span className="compose-preview-dialog__sr-only">{messages.scale}</span>
              <select value={scale} onChange={(event) => setScale(event.target.value as PreviewDialogScale)}>
                <option value="1">100%</option>
                <option value="0.75">75%</option>
                <option value="0.5">50%</option>
              </select>
            </label>
            <button
              aria-label={fullscreen ? messages.exitFullscreen : messages.enterFullscreen}
              type="button"
              onClick={toggleFullscreen}
            >
              <FullscreenIcon />
            </button>
            <button aria-label={messages.close} ref={closeButton} type="button" onClick={() => onOpenChange(false)}>
              <CloseIcon />
            </button>
          </div>
        </header>
        <div className="compose-preview-dialog__stage">
          <div
            className="compose-preview-dialog__artboard"
            data-testid="compose-preview-dialog-artboard"
            style={{ '--compose-preview-dialog-scale': scale } as CSSProperties}
          >
            <ComposePreview
              assetResolver={assetResolver}
              document={composeDocument}
              page={page}
              layoutRuntime={layoutRuntime}
              layoutSnapshot={layoutSnapshot}
              pageLoader={pageLoader}
              registry={registry}
              scriptModuleLoader={scriptModuleLoader}
              scriptScope={scriptScope}
              target={previewTarget}
            />
          </div>
        </div>
        <footer className="compose-preview-dialog__footer">{messages.closeHint}</footer>
      </div>
    </div>,
    document.body,
  )
}
