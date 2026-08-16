import type { ComposeAnimation, ComposeDocument, ComposeEntity, JsonObject } from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { applyComposeAnimationAtTime, sampleComposeAnimationTrack } from './animation-sampler'
import type { ComposeAnimationTrack, ComposeKeyframeInterpolation } from './animation-types'

function track(
  valueKind: ComposeAnimationTrack['valueKind'],
  keyframes: readonly { time: number; value: unknown; ease?: ComposeKeyframeInterpolation }[],
  path: readonly string[] = ['Appearance', 'opacity'],
): ComposeAnimationTrack {
  return {
    path,
    valueKind,
    keyframes: keyframes.map((item, index) => ({
      id: `k${index}`,
      timeMs: item.time,
      value: item.value as never,
      interpolation: item.ease ?? { kind: 'linear' },
    })),
  }
}

describe('单轨道采样', () => {
  it('OpenSpec: scene-animation / 动画采样器 / hold 插值在段内保持前值', () => {
    const held = track('number', [
      { time: 0, value: 0, ease: { kind: 'hold' } },
      { time: 100, value: 10 },
    ])
    expect(sampleComposeAnimationTrack(held, 0)).toBe(0)
    expect(sampleComposeAnimationTrack(held, 50)).toBe(0)
    expect(sampleComposeAnimationTrack(held, 99)).toBe(0)
    expect(sampleComposeAnimationTrack(held, 100)).toBe(10)
  })

  it('OpenSpec: scene-animation / 动画采样器 / linear 插值', () => {
    const linear = track('number', [{ time: 0, value: 0 }, { time: 100, value: 10 }])
    expect(sampleComposeAnimationTrack(linear, 25)).toBeCloseTo(2.5)
    expect(sampleComposeAnimationTrack(linear, 50)).toBeCloseTo(5)
  })

  it('OpenSpec: scene-animation / 动画采样器 / cubic 按 cubic-bezier 重映射时间', () => {
    const ease = { kind: 'cubic', control: [0.42, 0, 0.58, 1] } as const
    const eased = track('number', [
      { time: 0, value: 0, ease },
      { time: 100, value: 100 },
    ])
    // 对称的缓入缓出在中点仍然是 50，两端则明显慢于线性。
    expect(sampleComposeAnimationTrack(eased, 50)).toBeCloseTo(50, 5)
    expect(sampleComposeAnimationTrack(eased, 25) as number).toBeLessThan(25)
    expect(sampleComposeAnimationTrack(eased, 75) as number).toBeGreaterThan(75)
    // 端点必须精确命中，不能被迭代误差带偏。
    expect(sampleComposeAnimationTrack(eased, 0)).toBe(0)
    expect(sampleComposeAnimationTrack(eased, 100)).toBe(100)
  })

  it('OpenSpec: scene-animation / 动画采样器 / 播放头超出关键帧范围', () => {
    const clamped = track('number', [{ time: 100, value: 3 }, { time: 300, value: 9 }])
    expect(sampleComposeAnimationTrack(clamped, 0)).toBe(3)
    expect(sampleComposeAnimationTrack(clamped, 500)).toBe(9)
  })

  it('OpenSpec: scene-animation / 动画采样器 / 空轨道与单帧轨道', () => {
    expect(sampleComposeAnimationTrack(track('number', []), 0)).toBeUndefined()
    expect(sampleComposeAnimationTrack(track('number', [{ time: 50, value: 7 }]), 999)).toBe(7)
  })

  it('OpenSpec: scene-animation / 动画采样器 / 颜色与 vector2 轨道', () => {
    const color = track('color', [{ time: 0, value: '#000000' }, { time: 100, value: '#ffffff' }])
    expect(sampleComposeAnimationTrack(color, 50)).toBe('#808080')
    const vector = track('vector2', [
      { time: 0, value: { x: 0, y: 0 } },
      { time: 100, value: { x: 100, y: 50 } },
    ], ['LayoutItem', 'offset'])
    expect(sampleComposeAnimationTrack(vector, 50)).toEqual({ x: 50, y: 25 })
  })

  it('OpenSpec: scene-animation / 动画数据校验 / 坏数据不让采样崩溃', () => {
    const broken = track('number', [{ time: 0, value: 'nope' }, { time: 100, value: 10 }])
    expect(() => sampleComposeAnimationTrack(broken, 50)).not.toThrow()
    expect(sampleComposeAnimationTrack(broken, 50)).toBeUndefined()
  })
})

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
      Appearance: { backgroundPaint: { kind: 'solid', color: '#3b82f6' }, opacity: 1 },
      ...(animation ? { Animation: animation } : {}),
    },
  }
}

function documentWith(entities: Readonly<Record<string, ComposeEntity>>): ComposeDocument {
  return {
    schemaVersion: 6,
    canvas: {
      grid: { stepX: 8, stepY: 8, offsetX: 0, offsetY: 0, primaryLineEvery: 5, snapEnabled: true },
      smartSnap: { nodes: true, guides: true },
      guides: [],
    },
    output: { width: 1920, height: 1080, backgroundPaint: { kind: 'solid', color: '#ffffff' } },
    rootIds: Object.keys(entities),
    entities,
    animations: [intro],
  }
}

const offsetClip = {
  clips: {
    intro: [{
      path: ['LayoutItem', 'offset'],
      valueKind: 'vector2',
      keyframes: [
        { id: 'a', timeMs: 0, value: { x: 0, y: 0 }, interpolation: { kind: 'linear' } },
        { id: 'b', timeMs: 300, value: { x: 300, y: 90 }, interpolation: { kind: 'linear' } },
      ],
    }],
  },
} as unknown as JsonObject

describe('把动画套用到文档', () => {
  it('OpenSpec: scene-animation / 动画采样器 / 按时刻写入采样值', () => {
    const document = documentWith({ moving: entity('moving', offsetClip) })
    const next = applyComposeAnimationAtTime(document, 'intro', 100)
    const layoutItem = next.entities.moving?.components.LayoutItem as { offset: unknown }
    expect(layoutItem.offset).toEqual({ x: 100, y: 30 })
    // 同一 Component 内未被动画的字段必须原样保留。
    expect((next.entities.moving?.components.LayoutItem as { positioning: string }).positioning)
      .toBe('absolute')
  })

  it('OpenSpec: scene-animation / 动画采样器 / 未被动画的 Entity 保持引用相等', () => {
    const entities: Record<string, ComposeEntity> = { moving: entity('moving', offsetClip) }
    for (let index = 0; index < 9; index += 1) entities[`static${index}`] = entity(`static${index}`)
    const document = documentWith(entities)
    const next = applyComposeAnimationAtTime(document, 'intro', 150)
    for (let index = 0; index < 9; index += 1) {
      expect(next.entities[`static${index}`]).toBe(document.entities[`static${index}`])
    }
    expect(next.entities.moving).not.toBe(document.entities.moving)
  })

  it('OpenSpec: scene-animation / 动画采样器 / 没有命中时返回原文档引用', () => {
    const document = documentWith({ plain: entity('plain') })
    expect(applyComposeAnimationAtTime(document, 'intro', 100)).toBe(document)
    expect(applyComposeAnimationAtTime(document, 'missing', 100)).toBe(document)
  })

  it('OpenSpec: scene-animation / 动画数据校验 / 失效路径与坏数据被静默跳过', () => {
    const document = documentWith({
      broken: entity('broken', {
        clips: {
          intro: [
            // 指向不存在的 Component，采样时应当跳过而不是凭空造一个。
            { path: ['Ghost', 'value'], valueKind: 'number', keyframes: [
              { id: 'a', timeMs: 0, value: 1, interpolation: { kind: 'linear' } },
            ] },
            { path: ['Appearance', 'opacity'], valueKind: 'number', keyframes: [
              { id: 'b', timeMs: 0, value: 0, interpolation: { kind: 'linear' } },
              { id: 'c', timeMs: 300, value: 1, interpolation: { kind: 'linear' } },
            ] },
          ],
        },
      } as unknown as JsonObject),
    })
    const next = applyComposeAnimationAtTime(document, 'intro', 150)
    expect(next.entities.broken?.components.Ghost).toBeUndefined()
    expect((next.entities.broken?.components.Appearance as { opacity: number }).opacity)
      .toBeCloseTo(0.5)
  })
})
