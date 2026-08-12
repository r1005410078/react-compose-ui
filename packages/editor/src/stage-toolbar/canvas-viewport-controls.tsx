import { zoomViewportAt } from '@compose-ui/stage-engine'
import { useSyncExternalStore } from 'react'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { getEditorMessages } from '../editor-i18n'
import type { ViewportStore } from '../editor-controller/viewport-store'
import { StageToolbarIcon } from './stage-toolbar-icons'

type CanvasViewportControlsProps = {
  readonly store: ViewportStore
  readonly surfaceSize: { readonly width: number; readonly height: number } | null
}

/** 置于画布左上角的视口控制；视口属于会话状态而非文档。 @internal */
export function CanvasViewportControls({ store, surfaceSize }: CanvasViewportControlsProps) {
  const viewport = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage).stageToolbar
  const titled = (label: string) => ({ 'aria-label': label, title: label })
  const center = () => {
    if (!surfaceSize) return
    store.setViewport({ x: surfaceSize.width / 2, y: surfaceSize.height / 2, zoom: 1 })
  }
  const zoom = (factor: number) => {
    if (!surfaceSize) return
    const origin = { x: surfaceSize.width / 2, y: surfaceSize.height / 2 }
    store.setViewport((current) => zoomViewportAt(
      current,
      origin,
      Math.max(0.1, Math.min(8, current.zoom * factor)),
    ))
  }
  // 点击百分比以画布中心为锚点还原 100%，与命令面板 zoomReset 一致。
  const resetZoom = () => {
    if (!surfaceSize) return
    const origin = { x: surfaceSize.width / 2, y: surfaceSize.height / 2 }
    store.setViewport((current) => zoomViewportAt(current, origin, 1))
  }

  return (
    <div aria-label={messages.zoomTools} className="compose-editor__canvas-viewport-controls" role="group">
      <button {...titled(messages.centerView)} disabled={!surfaceSize} type="button" onClick={center}>
        <StageToolbarIcon name="center-view" />
      </button>
      <button {...titled(messages.zoomOut)} disabled={!surfaceSize} type="button" onClick={() => zoom(1 / 1.2)}>
        <StageToolbarIcon name="zoom-out" />
      </button>
      <button
        {...titled(messages.resetZoom)}
        className="compose-editor__canvas-zoom-value"
        disabled={!surfaceSize}
        type="button"
        onClick={resetZoom}
      >
        {Math.round(viewport.zoom * 100)}%
      </button>
      <button {...titled(messages.zoomIn)} disabled={!surfaceSize} type="button" onClick={() => zoom(1.2)}>
        <StageToolbarIcon name="zoom-in" />
      </button>
    </div>
  )
}
