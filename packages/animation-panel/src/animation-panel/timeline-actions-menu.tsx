import {
  ComposeContextMenu,
  ComposeContextMenuContent,
  ComposeContextMenuItem,
  ComposeContextMenuSeparator,
} from '@compose-ui/components'
import type { ComposeContextMenuRootProps } from '@compose-ui/components'

/**
 * 更多操作菜单的命中目标。
 *
 * @remarks
 * 判别联合而不是可选字段：菜单条目由目标种类决定，用可选字段会让"车道右键才有的时间"
 * 在对象行上也成为合法输入。`lane` 与 `keyframe` 只可能来自右键——按钮锚定在行上，
 * 不表达时间位置。
 */
export type TimelineMenuTarget =
  | { readonly kind: 'track'; readonly trackId: string; readonly label: string }
  | {
      readonly kind: 'property'
      readonly propertyId: string
      readonly label: string
    }
  | {
      readonly kind: 'lane'
      readonly propertyId: string
      readonly label: string
      readonly timeMs: number
    }
  | {
      readonly kind: 'keyframe'
      readonly propertyId: string
      readonly keyframeId: string
      readonly label: string
    }

/** 菜单条目文案；由时间线按当前 locale 传入，组件自身不做本地化。 */
export interface TimelineActionsMenuMessages {
  readonly removeTrack: string
  readonly removeTrackGroup: string
  readonly addKeyframeAtPlayhead: string
  readonly addKeyframeAtPointer: string
  readonly removeKeyframe: string
  readonly previousKeyframe: string
  readonly nextKeyframe: string
}

/** 更多操作菜单的受控属性；打开与定位由宿主的 `useComposeContextMenu` 控制器负责。 */
export interface TimelineActionsMenuProps {
  readonly messages: TimelineActionsMenuMessages
  readonly rootProps: ComposeContextMenuRootProps
  readonly target: TimelineMenuTarget | null
  readonly onAddKeyframeAtTime: (propertyId: string, timeMs: number) => void
  readonly onAddKeyframeAtPlayhead: (propertyId: string) => void
  readonly onRemoveKeyframe: (keyframeId: string) => void
  readonly onRemoveTrack: (propertyId: string) => void
  readonly onRemoveTrackGroup: (trackId: string) => void
  readonly onSeekAdjacentKeyframe: (propertyId: string, direction: 'previous' | 'next') => void
}

/**
 * 时间线对象行、属性行、关键帧车道与单个关键帧的更多操作菜单。
 *
 * @remarks
 * 右键与行上的"更多操作"按钮共用同一个实例：两者都通过控制器的 `openAt` 打开，只是一个传
 * 右键事件、一个传按钮的屏幕坐标，因此同一行两条入口的条目必然一致。
 * 菜单只发出语义回调，不认识文档结构。
 */
export function TimelineActionsMenu({
  messages,
  rootProps,
  target,
  onAddKeyframeAtPlayhead,
  onAddKeyframeAtTime,
  onRemoveKeyframe,
  onRemoveTrack,
  onRemoveTrackGroup,
  onSeekAdjacentKeyframe,
}: TimelineActionsMenuProps) {
  return (
    <ComposeContextMenu {...rootProps}>
      <ComposeContextMenuContent>
        {target?.kind === 'track' ? (
          <ComposeContextMenuItem
            variant="destructive"
            onClick={() => onRemoveTrackGroup(target.trackId)}
          >
            {messages.removeTrackGroup}
          </ComposeContextMenuItem>
        ) : null}
        {target?.kind === 'property' ? (
          <>
            <ComposeContextMenuItem
              onClick={() => onAddKeyframeAtPlayhead(target.propertyId)}
            >
              {messages.addKeyframeAtPlayhead}
            </ComposeContextMenuItem>
            <ComposeContextMenuItem
              onClick={() => onSeekAdjacentKeyframe(target.propertyId, 'previous')}
            >
              {messages.previousKeyframe}
            </ComposeContextMenuItem>
            <ComposeContextMenuItem
              onClick={() => onSeekAdjacentKeyframe(target.propertyId, 'next')}
            >
              {messages.nextKeyframe}
            </ComposeContextMenuItem>
            <ComposeContextMenuSeparator />
            <ComposeContextMenuItem
              variant="destructive"
              onClick={() => onRemoveTrack(target.propertyId)}
            >
              {messages.removeTrack}
            </ComposeContextMenuItem>
          </>
        ) : null}
        {target?.kind === 'lane' ? (
          <ComposeContextMenuItem
            onClick={() => onAddKeyframeAtTime(target.propertyId, target.timeMs)}
          >
            {messages.addKeyframeAtPointer}
          </ComposeContextMenuItem>
        ) : null}
        {target?.kind === 'keyframe' ? (
          <ComposeContextMenuItem
            variant="destructive"
            onClick={() => onRemoveKeyframe(target.keyframeId)}
          >
            {messages.removeKeyframe}
          </ComposeContextMenuItem>
        ) : null}
      </ComposeContextMenuContent>
    </ComposeContextMenu>
  )
}
