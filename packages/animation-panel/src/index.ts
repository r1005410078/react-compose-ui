/**
 * 可独立嵌入的动画时间线与关键帧属性组件；不持有或修改 ComposeDocument、Stage 和 Preview。
 *
 * @packageDocumentation
 */
import './styles.css'

export {
  ComposeAnimationInspector,
  ComposeAnimationPanelProvider,
  ComposeAnimationTimeline,
  createDefaultComposeAnimationPanelValue,
  createEmptyComposeAnimationPanelValue,
} from './animation-panel'
export type {
  ComposeAnimationInspectorProps,
  ComposeAnimationClip,
  ComposeAnimationInterpolation,
  ComposeAnimationKeyframe,
  ComposeAnimationKeyframeValue,
  ComposeAnimationPanelAction,
  ComposeAnimationPanelModel,
  ComposeAnimationPanelProviderProps,
  ComposeAnimationPanelValue,
  ComposeAnimationPlaybackMode,
  ComposeAnimationPropertyTrack,
  ComposeAnimationTimelineProps,
  ComposeAnimationTrack,
  ComposeAnimationValueKind,
  ComposeAnimationVector2Value,
} from './animation-panel'
