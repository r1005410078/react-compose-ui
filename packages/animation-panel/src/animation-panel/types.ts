import type { HTMLAttributes, ReactNode } from 'react'

/** 动画抵达边界后的播放方式。 @public */
export type ComposeAnimationPlaybackMode = 'play-once' | 'loop' | 'ping-pong'

/**
 * 关键帧到下一帧之间的插值方式。
 *
 * @remarks
 * 与文档动画模型（`@compose-ui/animation`）同构，但只是类型形状对齐——本包仍不依赖
 * `core` 或任何文档协议。`cubic` 的 `control` 是标准 CSS `cubic-bezier(x1, y1, x2, y2)`。
 *
 * @public
 */
export type ComposeAnimationInterpolation =
  | { readonly kind: 'hold' }
  | { readonly kind: 'linear' }
  | { readonly kind: 'cubic'; readonly control: readonly [number, number, number, number] }

/** 二维向量关键帧值。 @public */
export interface ComposeAnimationVector2Value {
  readonly x: number
  readonly y: number
}

/** 关键帧值：数值、二维向量或颜色字符串，由所属轨道的 `valueKind` 判别。 @public */
export type ComposeAnimationKeyframeValue = number | string | ComposeAnimationVector2Value

/** 轨道值的语义，决定右侧属性面板的值控件与展示格式。 @public */
export type ComposeAnimationValueKind = 'number' | 'vector2' | 'color'

/** 单个可编辑关键帧。 @public */
export interface ComposeAnimationKeyframe {
  /** 在属性轨道内稳定的标识。 */
  readonly id: string
  /** 相对动画开头的毫秒位置。 */
  readonly timeMs: number
  /** 形状由所属轨道的 `valueKind` 决定。 */
  readonly value: ComposeAnimationKeyframeValue
  /** 本帧到下一帧之间的插值方式。 */
  readonly interpolation: ComposeAnimationInterpolation
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
  /** 轨道值的语义；决定值编辑控件，不再把所有值当作颜色处理。 */
  readonly valueKind: ComposeAnimationValueKind
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

/**
 * 描述一次用户操作本身的语义动作。
 *
 * @remarks
 * 受控宿主用它把面板操作翻译成文档命令，而不必从两份 `ComposeAnimationPanelValue`
 * 快照里 diff 反推"发生了什么"——播放期间快照每帧更新一次，diff 既脆弱又昂贵。
 * 播放头推进只产生 `set-current-time`，绝不混入编辑动作。
 *
 * @public
 */
export type ComposeAnimationPanelAction =
  | { readonly kind: 'set-current-time'; readonly timeMs: number }
  | {
      readonly kind: 'select'
      readonly trackId: string | null
      readonly propertyId: string | null
      readonly keyframeId: string | null
    }
  | {
      readonly kind: 'add-keyframe'
      readonly propertyId: string
      readonly keyframeId: string
      readonly timeMs: number
      readonly value: ComposeAnimationKeyframeValue
    }
  | {
      readonly kind: 'move-keyframe'
      readonly propertyId: string
      readonly keyframeId: string
      readonly timeMs: number
    }
  | {
      readonly kind: 'remove-keyframe'
      readonly propertyId: string
      readonly keyframeId: string
    }
  | {
      readonly kind: 'set-keyframe-value'
      readonly propertyId: string
      readonly keyframeId: string
      readonly value: ComposeAnimationKeyframeValue
    }
  | {
      readonly kind: 'set-interpolation'
      readonly propertyId: string
      readonly keyframeId: string
      readonly interpolation: ComposeAnimationInterpolation
    }
  | { readonly kind: 'set-duration'; readonly durationMs: number }
  | { readonly kind: 'set-playback-mode'; readonly mode: ComposeAnimationPlaybackMode }
  | { readonly kind: 'toggle-auto-record' }
  /** 删除一条属性轨道及其全部关键帧。 */
  | { readonly kind: 'remove-track'; readonly propertyId: string }
  /** 删除一个对象轨道下的全部属性轨道；宿主应合成一次事务。 */
  | { readonly kind: 'remove-track-group'; readonly trackId: string }
  /**
   * 在指定时间打一个关键帧，值由宿主决定。
   *
   * @remarks
   * 与 `add-keyframe` 的区别是不带 `value`：面板不掌握文档当前值，也不应复制宿主的插值实现。
   */
  | { readonly kind: 'add-keyframe-at-time'; readonly propertyId: string; readonly timeMs: number }

/** Provider 的受控或非受控会话属性。 @public */
export interface ComposeAnimationPanelProviderProps {
  /** 受控会话值；提供后宿主必须回传 `onValueChange`。 */
  readonly value?: ComposeAnimationPanelValue
  /** 非受控模式的初始会话值；省略时从空会话开始，不再回退到演示数据。 */
  readonly defaultValue?: ComposeAnimationPanelValue
  /** 每个本地会话操作产生的下一个完整快照。 */
  readonly onValueChange?: (value: ComposeAnimationPanelValue) => void
  /** 每次用户操作时给出的语义动作；与 `onValueChange` 可同时使用。 */
  readonly onAction?: (action: ComposeAnimationPanelAction) => void
  /** 底部和右侧动画区域。 */
  readonly children: ReactNode
}

/** 底部动画时间线的容器属性。 @public */
export interface ComposeAnimationTimelineProps extends HTMLAttributes<HTMLElement> {
  /**
   * 会话不含任何轨道时渲染的空状态内容。
   *
   * @remarks
   * 省略时渲染一个中性的无数据提示。空状态下不渲染播放控件或占位轨道。
   */
  readonly emptyState?: ReactNode
}

/** 右侧关键帧属性面板的标准容器属性。 @public */
export type ComposeAnimationInspectorProps = HTMLAttributes<HTMLElement>
