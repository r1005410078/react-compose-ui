import type {
  ComposeAnimationKeyframe,
  ComposeAnimationPanelValue,
  ComposeAnimationPropertyTrack,
  ComposeAnimationTrack,
} from './types'

type Interpolation = ComposeAnimationKeyframe['interpolation']

function keyframe(
  trackId: string,
  propertyId: string,
  timeMs: number,
  value: string,
  interpolation: Interpolation = 'linear',
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
  frames: readonly (readonly [timeMs: number, value: string, interpolation?: Interpolation])[],
  extras?: Pick<ComposeAnimationPropertyTrack, 'groupLabel' | 'channel' | 'displayValue'>,
): ComposeAnimationPropertyTrack {
  return {
    id: propertyId,
    label,
    ...extras,
    keyframes: frames.map(([timeMs, value, interpolation = 'linear']) => (
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
          property('fault', 'background-fill', '背景填充', [
            [0, '#FF6B6B'],
            [100, '#FF6B6B', 'ease-in'],
            [200, '#FF6B6B'],
            [300, '#4ECDC4', 'ease-out'],
          ], { displayValue: '#FF6B6B' }),
          property('fault', 'opacity', '透明度', [
            [0, '#FFFFFF'],
            [150, '#CCCCCC'],
            [300, '#FFFFFF'],
          ], { displayValue: '100%' }),
          property('fault', 'scale', '缩放', [
            [0, '#111111'],
            [100, '#333333', 'ease-out'],
            [300, '#111111'],
          ], { displayValue: '1.00' }),
        ]),
        track('rectangle', 'Rectangle', true, [
          property('rectangle', 'position-x', 'Position X', [
            [0, '#2E86F7'],
            [120, '#2E86F7'],
            [240, '#2E86F7', 'ease-in'],
          ], { groupLabel: 'Position', channel: 'X', displayValue: '437' }),
          property('rectangle', 'position-y', 'Position Y', [
            [0, '#2E86F7'],
            [80, '#5B9FF9'],
            [200, '#2E86F7'],
          ], { groupLabel: 'Position', channel: 'Y', displayValue: '463.5' }),
          property('rectangle', 'rotation', 'Rotation', [
            [0, '#888888'],
            [240, '#EEEEEE', 'ease-in'],
          ], { groupLabel: 'Rotation', displayValue: '28.404°' }),
        ]),
        track('alarm', 'Alarm', false, [
          property('alarm', 'fill-color', '填充色', [
            [40, '#E24B4B'],
            [160, '#FFB020'],
            [300, '#E24B4B'],
          ], { displayValue: '#E24B4B' }),
          property('alarm', 'visibility', '可见性', [
            [40, '#000000'],
            [100, '#FFFFFF'],
            [220, '#000000'],
            [300, '#FFFFFF'],
          ], { displayValue: 'On' }),
        ]),
        track('title', 'Title', true, [
          property('title', 'font-size', '字号', [
            [20, '#A0A0A0'],
            [140, '#FFFFFF', 'ease-out'],
            [280, '#A0A0A0'],
          ], { displayValue: '24' }),
          property('title', 'text-color', '文字色', [
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
    easingEditor: 'curve',
  }
}
