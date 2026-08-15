import type { ComposeAnimationPanelValue } from './types'

/** 创建与参考图一致的本地演示会话。 @public */
export function createDefaultComposeAnimationPanelValue(): ComposeAnimationPanelValue {
  return {
    model: {
      durationMs: 300,
      clips: [{
        id: 'fault-animation',
        label: 'Fault',
        startTimeMs: 0,
        endTimeMs: 300,
      }],
      tracks: [{
        id: 'fault',
        label: 'Fault',
        expanded: true,
        properties: [{
          id: 'background-fill',
          label: '背景填充',
          keyframes: [0, 100, 200, 300].map((timeMs) => ({
            id: `fault-background-fill-${timeMs}`,
            timeMs,
            value: '#FF6B6B',
            interpolation: 'linear',
          })),
        }],
      }],
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
