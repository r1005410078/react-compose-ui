import type {
  ComposeAnimationInterpolation,
  ComposeAnimationKeyframe,
  ComposeAnimationKeyframeValue,
  ComposeAnimationPanelValue,
  ComposeAnimationPropertyTrack,
  ComposeAnimationTrack,
  ComposeAnimationValueKind,
} from './types'

const LINEAR: ComposeAnimationInterpolation = { kind: 'linear' }
/** 演示用的标准缓入 / 缓出（CSS ease-in / ease-out 的控制点）。 */
const EASE_IN: ComposeAnimationInterpolation = { kind: 'cubic', control: [0.42, 0, 1, 1] }
const EASE_OUT: ComposeAnimationInterpolation = { kind: 'cubic', control: [0, 0, 0.58, 1] }

type Frame = readonly [
  timeMs: number,
  value: ComposeAnimationKeyframeValue,
  interpolation?: ComposeAnimationInterpolation,
]

function keyframe(
  trackId: string,
  propertyId: string,
  timeMs: number,
  value: ComposeAnimationKeyframeValue,
  interpolation: ComposeAnimationInterpolation = LINEAR,
): ComposeAnimationKeyframe {
  return {
    id: `${trackId}-${propertyId}-${timeMs}`,
    timeMs,
    value,
    interpolation,
  }
}

function property(
  trackId: string,
  propertyId: string,
  label: string,
  valueKind: ComposeAnimationValueKind,
  frames: readonly Frame[],
  extras?: Pick<ComposeAnimationPropertyTrack, 'groupLabel' | 'channel' | 'displayValue'>,
): ComposeAnimationPropertyTrack {
  return {
    id: propertyId,
    label,
    valueKind,
    ...extras,
    keyframes: frames.map(([timeMs, value, interpolation = LINEAR]) => (
      keyframe(trackId, propertyId, timeMs, value, interpolation)
    )),
  }
}

function track(
  id: string,
  label: string,
  expanded: boolean,
  properties: readonly ComposeAnimationPropertyTrack[],
): ComposeAnimationTrack {
  return { id, label, expanded, properties }
}

/**
 * 创建不含任何轨道的空会话。
 *
 * @remarks
 * 非受控且未提供 `defaultValue` 时 Provider 使用它——面板不再回退到演示数据，
 * 否则初始空页面会伪装成"已经有动画"，与创建引导直接冲突。
 *
 * @public
 */
export function createEmptyComposeAnimationPanelValue(): ComposeAnimationPanelValue {
  return {
    model: { durationMs: 300, tracks: [] },
    currentTimeMs: 0,
    selectedKeyframeId: null,
    selectedTrackId: null,
    selectedPropertyId: null,
    selectedClipId: null,
    isPlaying: false,
    playbackMode: 'play-once',
    autoRecord: true,
  }
}

/** 创建多物体、多属性的本地演示会话（左侧信息对齐 Rive 时间线）。 @public */
export function createDefaultComposeAnimationPanelValue(): ComposeAnimationPanelValue {
  return {
    model: {
      durationMs: 300,
      clips: [
        { id: 'fault-animation', trackId: 'fault', label: 'Fault', startTimeMs: 0, endTimeMs: 300 },
        { id: 'rectangle-animation', trackId: 'rectangle', label: 'Rectangle', startTimeMs: 0, endTimeMs: 240 },
        { id: 'alarm-animation', trackId: 'alarm', label: 'Alarm', startTimeMs: 40, endTimeMs: 300 },
        { id: 'text-title-animation', trackId: 'title', label: 'Title', startTimeMs: 20, endTimeMs: 280 },
      ],
      tracks: [
        track('fault', 'Fault', true, [
          property('fault', 'background-fill', '背景填充', 'color', [
            [0, '#FF6B6B'],
            [100, '#FF6B6B', EASE_IN],
            [200, '#FF6B6B'],
            [300, '#4ECDC4', EASE_OUT],
          ], { displayValue: '#FF6B6B' }),
          property('fault', 'opacity', '透明度', 'number', [
            [0, 1],
            [150, 0.8],
            [300, 1],
          ], { displayValue: '100%' }),
          property('fault', 'scale', '缩放', 'number', [
            [0, 1],
            [100, 1.2, EASE_OUT],
            [300, 1],
          ], { displayValue: '1.00' }),
        ]),
        track('rectangle', 'Rectangle', true, [
          property('rectangle', 'position', 'Position', 'vector2', [
            [0, { x: 437, y: 463.5 }],
            [120, { x: 520, y: 430 }],
            [240, { x: 437, y: 463.5 }, EASE_IN],
          ], { groupLabel: 'Position', displayValue: '437' }),
          property('rectangle', 'rotation', 'Rotation', 'number', [
            [0, 0],
            [240, 28.404, EASE_IN],
          ], { groupLabel: 'Rotation', displayValue: '28.404°' }),
        ]),
        track('alarm', 'Alarm', false, [
          property('alarm', 'fill-color', '填充色', 'color', [
            [40, '#E24B4B'],
            [160, '#FFB020'],
            [300, '#E24B4B'],
          ], { displayValue: '#E24B4B' }),
          property('alarm', 'opacity', '透明度', 'number', [
            [40, 0],
            [100, 1],
            [220, 0],
            [300, 1],
          ], { displayValue: 'On' }),
        ]),
        track('title', 'Title', true, [
          property('title', 'font-size', '字号', 'number', [
            [20, 18],
            [140, 24, EASE_OUT],
            [280, 18],
          ], { displayValue: '24' }),
          property('title', 'text-color', '文字色', 'color', [
            [20, '#8E99A7'],
            [100, '#E7EBF1'],
            [280, '#3B8EF0'],
          ], { displayValue: '#E7EBF1' }),
        ]),
      ],
    },
    currentTimeMs: 200,
    selectedKeyframeId: 'fault-background-fill-200',
    selectedTrackId: 'fault',
    selectedPropertyId: null,
    selectedClipId: 'fault-animation',
    isPlaying: false,
    playbackMode: 'play-once',
    autoRecord: true,
  }
}
