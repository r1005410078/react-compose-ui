import type { HTMLAttributes, ReactNode } from 'react'

/** 动画抵达边界后的播放方式。 @public */
export type ComposeAnimationPlaybackMode = 'play-once' | 'loop' | 'ping-pong'

/** 单个可编辑关键帧。 @public */
export interface ComposeAnimationKeyframe {
  /** 在属性轨道内稳定的标识。 */
  readonly id: string
  /** 相对动画开头的毫秒位置。 */
  readonly timeMs: number
  /** 当前仅用于展示的颜色值。 */
  readonly value: string
  /** 进入此关键帧的局部插值方式。 */
  readonly interpolation: 'linear' | 'ease-in' | 'ease-out'
}

/** 时间线中可选择和调整范围的动画片段。 @public */
export interface ComposeAnimationClip {
  /** 在动画面板会话内稳定的标识。 */
  readonly id: string
  /**
   * 片段所属的对象轨道 ID。
   *
   * @remarks
   * 必填而不是可选：可选字段会让"按 label 或 ID 前缀猜测归属"的分支永远留在代码里，
   * 而那种猜测在宿主数据的标识恰好撞车时会把片段渲染到错误的行上。
   */
  readonly trackId: string
  /** 用户可见的片段名称。 */
  readonly label: string
  /** 片段在时间轴上的起始毫秒。 */
  readonly startTimeMs: number
  /** 片段在时间轴上的结束毫秒。 */
  readonly endTimeMs: number
}

/** 由关键帧组成的可动画属性轨道。 @public */
export interface ComposeAnimationPropertyTrack {
  /** 属性轨道的稳定标识。 */
  readonly id: string
  /** 用户可见的属性名称（完整名，如 Position X / 背景填充）。 */
  readonly label: string
  /**
   * 左侧列表主名称（Rive 式，如 Position）；缺省使用 `label`。
   * @remarks 与 `channel` 搭配时，主名称显示在左，分量显示在右。
   */
  readonly groupLabel?: string
  /** 分量通道标记（如 X / Y）；无分量时省略。 */
  readonly channel?: string
  /**
   * 右侧展示值（如 `911.6`、`28.404°`）；缺省取当前播放头附近关键帧的 `value`。
   * @remarks 演示会话可用人类可读数值；颜色属性可继续用 hex。
   */
  readonly displayValue?: string
  /** 属性轨道的关键帧。 */
  readonly keyframes: readonly ComposeAnimationKeyframe[]
}

/** 时间线中的一组对象轨道。 @public */
export interface ComposeAnimationTrack {
  /** 对象轨道的稳定标识。 */
  readonly id: string
  /** 用户可见的对象名称。 */
  readonly label: string
  /** 默认是否展开属性轨道。 */
  readonly expanded: boolean
  /** 当前对象下的属性轨道。 */
  readonly properties: readonly ComposeAnimationPropertyTrack[]
}

/** 时间线中的本地可编辑轨道数据。 @public */
export interface ComposeAnimationPanelModel {
  /** 可编辑区域总时长，单位为毫秒。 */
  readonly durationMs: number
  /** 自顶向下显示的对象轨道。 */
  readonly tracks: readonly ComposeAnimationTrack[]
  /** 可选的动画片段；省略时，时间线使用覆盖全时长的默认片段。 */
  readonly clips?: readonly ComposeAnimationClip[]
}

/** 动画面板的可控会话快照。 @public */
export interface ComposeAnimationPanelValue {
  /** 轨道及关键帧数据。 */
  readonly model: ComposeAnimationPanelModel
  /** 当前播放头毫秒位置。 */
  readonly currentTimeMs: number
  /** 已选关键帧 ID；无选择时为 null。 */
  readonly selectedKeyframeId: string | null
  /** 已选对象轨道 ID；无选择时为 null。 */
  readonly selectedTrackId?: string | null
  /** 已选属性轨道 ID；无选择时为 null。 */
  readonly selectedPropertyId?: string | null
  /** 已选动画片段 ID；无选择时为 null。 */
  readonly selectedClipId?: string | null
  /** 是否正在本地播放。 */
  readonly isPlaying: boolean
  /** 动画抵达边界后的播放方式。 */
  readonly playbackMode: ComposeAnimationPlaybackMode
  /** 是否显示本地自动记录状态。 */
  readonly autoRecord: boolean
  /** 右侧缓动编辑器的活动标签。 */
  readonly easingEditor: 'curve' | 'spring'
}

/** Provider 的受控或非受控会话属性。 @public */
export interface ComposeAnimationPanelProviderProps {
  /** 受控会话值；提供后宿主必须回传 `onValueChange`。 */
  readonly value?: ComposeAnimationPanelValue
  /** 非受控模式的初始会话值。 */
  readonly defaultValue?: ComposeAnimationPanelValue
  /** 每个本地会话操作产生的下一个完整快照。 */
  readonly onValueChange?: (value: ComposeAnimationPanelValue) => void
  /** 底部和右侧动画区域。 */
  readonly children: ReactNode
}

/** 底部动画时间线的标准容器属性。 @public */
export type ComposeAnimationTimelineProps = HTMLAttributes<HTMLElement>

/** 右侧关键帧属性面板的标准容器属性。 @public */
export type ComposeAnimationInspectorProps = HTMLAttributes<HTMLElement>
