import { ComposeStage } from '@compose-ui/stage'
import { useSyncExternalStore } from 'react'
import type { ComposeStageProps } from '@compose-ui/stage'
import { CanvasViewportControls } from '../stage-toolbar'
import type { ViewportStore } from './viewport-store'

/**
 * 订阅视口并把当前快照注入受控 Stage。
 *
 * @remarks
 * 视口是外部状态源，默认工作区里只有这里和工具栏订阅它。平移帧因此不会唤醒场景树、
 * Inspector 与命令面板。
 */
export function ViewportBoundStage({
  store,
  stageProps,
  surfaceSize,
}: {
  readonly store: ViewportStore
  readonly stageProps: ComposeStageProps
  readonly surfaceSize: { readonly width: number; readonly height: number } | null
}) {
  const viewport = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  // 宿主覆盖已由 composeEditorStageProps 在上游合并进 stageProps，这一层只补当前视口快照。
  return (
    <div className="compose-editor__stage-viewport-host">
      <ComposeStage {...stageProps} viewport={viewport} />
      <CanvasViewportControls store={store} surfaceSize={surfaceSize} />
    </div>
  )
}
