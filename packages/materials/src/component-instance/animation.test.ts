import {
  createComposeGroupEntitySeed,
  createEmptyComposePageDocument,
  getComposeTransform,
  type ComposeDocument,
  type ComposeEntity,
  type JsonObject,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { sampleComponentInstanceDocument } from './animation'

function rectangle(components: Record<string, JsonObject> = {}): ComposeEntity {
  return {
    id: 'rectangle',
    name: 'Rectangle',
    components: {
      LayoutItem: {
        offset: { x: 0, y: 0 },
        width: { mode: 'fixed', value: 40 },
        height: { mode: 'fixed', value: 40 },
      },
      Transform: { rotation: 0 },
      ...components,
    },
  }
}

/** `items` 由调用方给出，因此可以造出「清单里没有这条」与「有这条但没有轨道」两种状态。 */
function document(options: {
  readonly items?: readonly JsonObject[]
  readonly tracks?: JsonObject
} = {}): ComposeDocument {
  const root = createComposeGroupEntitySeed({
    id: 'root',
    name: 'Switch',
    childIds: ['rectangle'],
    size: { width: 120, height: 80 },
  })
  return {
    ...createEmptyComposePageDocument(),
    rootIds: ['root'],
    entities: {
      root: {
        ...root,
        components: {
          ...root.components,
          Frame: { size: { width: 120, height: 80 }, guides: [] },
          Animations: { items: options.items ?? [] },
        },
      },
      rectangle: rectangle(options.tracks ? { Animation: options.tracks } : {}),
    },
  }
}

const SWITCH_ITEM: JsonObject = {
  id: 'switch',
  name: '合分闸',
  durationMs: 1000,
  playbackMode: 'play-once',
}

const SWITCH_TRACKS: JsonObject = {
  clips: {
    switch: [{
      path: ['Transform', 'rotation'],
      valueKind: 'number',
      keyframes: [
        { id: 'a', timeMs: 0, value: 0, interpolation: { kind: 'linear' } },
        { id: 'b', timeMs: 1000, value: 90, interpolation: { kind: 'linear' } },
      ],
    }],
  },
}

function rotationAt(timeMs: unknown, animationId: unknown = 'switch') {
  const source = document({ items: [SWITCH_ITEM], tracks: SWITCH_TRACKS })
  const sampled = sampleComponentInstanceDocument(source, animationId, timeMs)
  return getComposeTransform(sampled.entities.rectangle!).rotation
}

describe('OpenSpec: basic-materials / 组件实例的动画播放头', () => {
  it('按播放头采样嵌套文档', () => {
    expect(rotationAt(0)).toBe(0)
    expect(rotationAt(500)).toBe(45)
    expect(rotationAt(1000)).toBe(90)
  })

  it('播放头超出时长与负值都被钳制', () => {
    expect(rotationAt(9_000)).toBe(90)
    expect(rotationAt(-400)).toBe(0)
    // 非有限数值按 0 处理，而不是让 NaN 顺着插值传进关键帧求值。
    expect(rotationAt(Number.NaN)).toBe(0)
    expect(rotationAt('1000')).toBe(0)
  })

  it('没选动画时返回原文档引用', () => {
    const source = document({ items: [SWITCH_ITEM], tracks: SWITCH_TRACKS })
    // 引用相等是嵌套 Runtime 不做多余 Yoga 重解的依据，等值副本在这里不够。
    expect(sampleComponentInstanceDocument(source, null, 500)).toBe(source)
    expect(sampleComponentInstanceDocument(source, undefined, 500)).toBe(source)
    expect(sampleComponentInstanceDocument(source, '', 500)).toBe(source)
  })

  it('失效动画 id 不采样也不回退到第一条', () => {
    const source = document({ items: [SWITCH_ITEM], tracks: SWITCH_TRACKS })
    const sampled = sampleComponentInstanceDocument(source, 'gone', 1000)

    expect(sampled).toBe(source)
    // 回退到清单第一条的实现会在这里给出 90——只有一条动画时它看起来永远是对的。
    expect(getComposeTransform(sampled.entities.rectangle!).rotation).toBe(0)
  })

  it('动画存在但没有任何轨道时返回原文档引用', () => {
    const source = document({ items: [SWITCH_ITEM] })
    expect(sampleComponentInstanceDocument(source, 'switch', 500)).toBe(source)
  })

  it('清单为空时不采样', () => {
    const source = document({ tracks: SWITCH_TRACKS })
    expect(sampleComponentInstanceDocument(source, 'switch', 1000)).toBe(source)
  })

  it('采样不改动入参文档', () => {
    const source = document({ items: [SWITCH_ITEM], tracks: SWITCH_TRACKS })
    const before = structuredClone(source)
    sampleComponentInstanceDocument(source, 'switch', 1000)

    // 采样只作用于呈现：结果喂给嵌套 Runtime，作者文档、实例覆盖与组件源都不受影响。
    expect(source).toEqual(before)
  })
})
