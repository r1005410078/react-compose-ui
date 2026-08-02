import { ComposeStage } from '@compose-ui/stage'
import { useSyncExternalStore } from 'react'
import type { ComponentProps } from 'react'
import type { ComposeStageProps } from '@compose-ui/stage'
import { DefaultStageToolbar } from '../stage-toolbar'
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
  ...hostProps
}: Partial<ComposeStageProps> & {
  readonly store: ViewportStore
  readonly stageProps: ComposeStageProps
}) {
  const viewport = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  // ComposeEditor 用 cloneElement 往 controller.stage 上注入 assetResolver、shortcuts 与
  // onToolChange。这一层是宿主与 ComposeStage 之间新增的节点，必须原样透传这些属性，
  // 并保持「注入值覆盖 controller 默认值」的既有优先级。
  return <ComposeStage {...stageProps} {...hostProps} viewport={viewport} />
}

/** 订阅视口并把当前快照注入默认工具栏；缩放读数需要随平移与缩放更新。 */
export function ViewportBoundStageToolbar({
  store,
  ...toolbarProps
}: Omit<ComponentProps<typeof DefaultStageToolbar>, 'viewport'> & {
  readonly store: ViewportStore
}) {
  const viewport = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  return <DefaultStageToolbar {...toolbarProps} viewport={viewport} />
}
