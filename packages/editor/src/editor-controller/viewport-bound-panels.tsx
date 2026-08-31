import { ComposeStage } from '@compose-ui/stage'
import { useSyncExternalStore } from 'react'
import type { Ref } from 'react'
import type { ComposeStageHandle, ComposeStageProps } from '@compose-ui/stage'
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
  stageRef,
  store,
  stageProps,
  surfaceSize,
  onCenterView,
}: {
  /** Stage 的命令式句柄；工具栏靠它启动命令会话。 */
  readonly stageRef: Ref<ComposeStageHandle>
  readonly store: ViewportStore
  readonly stageProps: ComposeStageProps
  readonly surfaceSize: { readonly width: number; readonly height: number } | null
  /** 「居中视图」；转交 Stage 句柄的激活场景适配。 */
  readonly onCenterView: () => void
}) {
  const viewport = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  // 宿主覆盖已由 composeEditorStageProps 在上游合并进 stageProps，这一层只补当前视口快照。
  return (
    <div className="compose-editor__stage-viewport-host">
      <ComposeStage {...stageProps} ref={stageRef} viewport={viewport} />
      <CanvasViewportControls
        store={store}
        surfaceSize={surfaceSize}
        onCenterView={onCenterView}
      />
    </div>
  )
}
