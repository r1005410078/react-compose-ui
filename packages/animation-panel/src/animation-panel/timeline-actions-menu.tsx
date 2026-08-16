import {
  ComposeButton,
  ComposeContextMenu,
  ComposeContextMenuContent,
  ComposeContextMenuItem,
  ComposeContextMenuSeparator,
} from '@compose-ui/components'
import type {
  ComposeContextMenuOpenEvent,
  ComposeContextMenuRootProps,
} from '@compose-ui/components'
import { MoreActionsIcon } from './animation-icons'

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

/**
 * 行上的"更多操作"按钮。
 *
 * @remarks
 * 用按钮自身的矩形算出锚点交给控制器，因此它和右键走同一条 `openAt` 路径、同一份菜单。
 * 可见性由 CSS 控制（行悬停或 `:focus-within` 时显现），但占位宽度常驻，显现时不引起布局跳动；
 * 菜单打开期间由行上的 `data-menu-open` 维持可见——否则指针一离开行按钮就消失，
 * 菜单会挂在一个看不见的锚点上。
 */
export function MoreActionsButton({
  label,
  onOpen,
}: {
  readonly label: string
  readonly onOpen: (event: ComposeContextMenuOpenEvent) => void
}) {
  return (
    <ComposeButton
      aria-haspopup="menu"
      aria-label={label}
      className="compose-animation-timeline__track-action compose-animation-timeline__more-actions"
      size="icon-xs"
      variant="ghost"
      onClick={(event) => {
        event.stopPropagation()
        // 坐标自己按按钮矩形算：键盘激活（Enter/Space）的 click 事件 clientX/clientY 是 0，
        // 直接透传会把菜单锚到视口左上角。仍以事件形状交给控制器，才能记住返回焦点目标。
        const rect = event.currentTarget.getBoundingClientRect()
        onOpen({
          clientX: rect.left,
          clientY: rect.bottom,
          currentTarget: event.currentTarget,
        })
      }}
    ><MoreActionsIcon /></ComposeButton>
  )
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
