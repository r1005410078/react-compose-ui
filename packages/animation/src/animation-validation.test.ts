import type { ComposeAnimation, ComposeDocument, ComposeEntity, JsonObject } from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { collectComposeAnimationIssues } from './animation-validation'

const intro: ComposeAnimation = {
  id: 'intro',
  name: '入场动画',
  durationMs: 300,
  playbackMode: 'play-once',
}

function entity(id: string, animation?: JsonObject): ComposeEntity {
  return {
    id,
    name: id,
    components: {
      Composition: { presetId: 'rectangle', baseComponentKeys: [], capabilityIds: [] },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 0, y: 0 },
        width: { mode: 'fixed', value: 100, min: null, max: null },
        height: { mode: 'fixed', value: 100, min: null, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Renderer: { type: 'rectangle', props: {} },
      ...(animation ? { Animation: animation } : {}),
    },
  }
}

function documentWith(
  animationComponent: JsonObject | undefined,
  animations: readonly ComposeAnimation[] = [intro],
): ComposeDocument {
  return {
    schemaVersion: 6,
    canvas: {
      grid: { stepX: 8, stepY: 8, offsetX: 0, offsetY: 0, primaryLineEvery: 5, snapEnabled: true },
      smartSnap: { nodes: true, guides: true },
      guides: [],
    },
    output: { width: 1920, height: 1080, backgroundPaint: { kind: 'solid', color: '#ffffff' } },
    rootIds: ['rect'],
    entities: { rect: entity('rect', animationComponent) },
    animations,
  }
}

const numberTrack = (keyframes: readonly JsonObject[]) => ({
  path: ['Appearance', 'opacity'],
  valueKind: 'number',
  keyframes,
})

const keyframe = (id: string, timeMs: number, value: unknown = 1) => ({
  id,
  timeMs,
  value,
  interpolation: { kind: 'linear' },
}) as unknown as JsonObject

describe('动画数据校验', () => {
  it('OpenSpec: scene-animation / 动画数据校验 / 无 Animation Component 的文档没有问题', () => {
    expect(collectComposeAnimationIssues(documentWith(undefined))).toEqual([])
  })

  it('OpenSpec: scene-animation / 动画数据校验 / 合法数据没有问题', () => {
    const issues = collectComposeAnimationIssues(documentWith({
      clips: { intro: [numberTrack([keyframe('a', 0, 0), keyframe('b', 300, 1)])] },
    }))
    expect(issues).toEqual([])
  })

  it('OpenSpec: scene-animation / 动画数据校验 / 同一轨道出现重复时间', () => {
    const issues = collectComposeAnimationIssues(documentWith({
      clips: { intro: [numberTrack([keyframe('a', 100), keyframe('b', 100)])] },
    }))
    expect(issues).toContainEqual(expect.objectContaining({
      code: 'keyframe.duplicate-time',
      path: ['entities', 'rect', 'components', 'Animation', 'clips', 'intro', 0, 'keyframes', 1],
    }))
  })

  it('OpenSpec: scene-animation / 动画数据校验 / 关键帧值与 valueKind 不符', () => {
    const issues = collectComposeAnimationIssues(documentWith({
      clips: { intro: [numberTrack([keyframe('a', 0, { x: 1, y: 2 })])] },
    }))
    expect(issues).toContainEqual(expect.objectContaining({
      code: 'keyframe.value-kind-mismatch',
    }))
  })

  it('OpenSpec: scene-animation / 动画数据校验 / 关键帧超出动画时长', () => {
    const issues = collectComposeAnimationIssues(documentWith({
      clips: { intro: [numberTrack([keyframe('a', -1), keyframe('b', 500)])] },
    }))
    expect(issues.filter((issue) => issue.code === 'keyframe.out-of-range')).toHaveLength(2)
  })

  it('OpenSpec: scene-animation / 动画数据校验 / 关键帧乱序', () => {
    const issues = collectComposeAnimationIssues(documentWith({
      clips: { intro: [numberTrack([keyframe('a', 200), keyframe('b', 100)])] },
    }))
    expect(issues).toContainEqual(expect.objectContaining({ code: 'keyframe.unordered' }))
  })

  it('OpenSpec: scene-animation / 动画数据校验 / 轨道路径为空与同分组路径重复', () => {
    const empty = collectComposeAnimationIssues(documentWith({
      clips: { intro: [{ path: [], valueKind: 'number', keyframes: [] }] },
    }))
    expect(empty).toContainEqual(expect.objectContaining({ code: 'track.invalid-path' }))

    const duplicated = collectComposeAnimationIssues(documentWith({
      clips: { intro: [numberTrack([]), numberTrack([])] },
    }))
    expect(duplicated).toContainEqual(expect.objectContaining({
      code: 'track.duplicate-path',
      path: ['entities', 'rect', 'components', 'Animation', 'clips', 'intro', 1, 'path'],
    }))
  })

  it('OpenSpec: scene-animation / 动画数据校验 / 插值与空间切线形状非法', () => {
    const badInterpolation = collectComposeAnimationIssues(documentWith({
      clips: {
        intro: [numberTrack([{
          id: 'a', timeMs: 0, value: 1, interpolation: { kind: 'cubic', control: [0, 0, 1] },
        } as unknown as JsonObject])],
      },
    }))
    expect(badInterpolation).toContainEqual(expect.objectContaining({
      code: 'keyframe.invalid-interpolation',
    }))

    const badSpatial = collectComposeAnimationIssues(documentWith({
      clips: {
        intro: [{
          path: ['LayoutItem', 'offset'],
          valueKind: 'vector2',
          keyframes: [{
            id: 'a',
            timeMs: 0,
            value: { x: 0, y: 0 },
            interpolation: { kind: 'linear' },
            spatial: { mode: 'wobbly', inX: 0, inY: 0, outX: 0, outY: 0 },
          }],
        }],
      },
    } as unknown as JsonObject))
    expect(badSpatial).toContainEqual(expect.objectContaining({
      code: 'keyframe.invalid-spatial',
    }))
  })

  it('OpenSpec: scene-animation / 动画数据校验 / 悬空动画分组', () => {
    const issues = collectComposeAnimationIssues(documentWith({
      clips: { ghost: [numberTrack([keyframe('a', 0)])] },
    }))
    expect(issues).toContainEqual(expect.objectContaining({
      code: 'animation.dangling-clip',
      path: ['entities', 'rect', 'components', 'Animation', 'clips', 'ghost'],
    }))
  })

  it('OpenSpec: scene-animation / 动画数据校验 / Component 形状非法', () => {
    expect(collectComposeAnimationIssues(documentWith({ clips: 'nope' } as unknown as JsonObject)))
      .toContainEqual(expect.objectContaining({ code: 'animation.invalid-component' }))
    expect(collectComposeAnimationIssues(documentWith({ notClips: {} })))
      .toContainEqual(expect.objectContaining({ code: 'animation.invalid-component' }))
  })
})
