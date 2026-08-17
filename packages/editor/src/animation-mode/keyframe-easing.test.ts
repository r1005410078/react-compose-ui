import type { ComposeDocument, ComposeEntity, JsonObject } from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { encodeAnimationKeyframeId } from './animation-document-adapter'
import { resolveAnimationKeyframeEasing } from './keyframe-easing'

const tracks = {
  clips: {
    intro: [
      {
        path: ['LayoutItem', 'offset'],
        valueKind: 'vector2',
        keyframes: [
          { id: 'a', timeMs: 0, value: { x: 0, y: 0 }, interpolation: { kind: 'linear' } },
          {
            id: 'b',
            timeMs: 300,
            value: { x: 120, y: 40 },
            interpolation: { kind: 'cubic', control: [0.42, 0, 0.58, 1] },
          },
        ],
      },
    ],
  },
} as unknown as JsonObject

function entity(animation?: JsonObject): ComposeEntity {
  return {
    id: 'hero',
    name: '主视觉',
    components: {
      Composition: { presetId: 'rectangle', baseComponentKeys: [], capabilityIds: [] },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 10, y: 20 },
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

function documentWith(target: ComposeEntity): ComposeDocument {
  return {
    schemaVersion: 6,
    canvas: {
      grid: { stepX: 8, stepY: 8, offsetX: 0, offsetY: 0, primaryLineEvery: 5, snapEnabled: true },
      smartSnap: { nodes: true, guides: true },
      guides: [],
    },
    output: { width: 1920, height: 1080, backgroundPaint: { kind: 'solid', color: '#ffffff' } },
    rootIds: [target.id],
    entities: { [target.id]: target },
    animations: [{ id: 'intro', name: '入场', durationMs: 300, playbackMode: 'play-once' }],
  }
}

const document = documentWith(entity(tracks))

function panelId(keyframeId: string) {
  return encodeAnimationKeyframeId({
    entityId: 'hero',
    path: ['LayoutItem', 'offset'],
    keyframeId,
  })
}

describe('选中关键帧的缓动上下文', () => {
  it('OpenSpec: editor-workspace-layout / 画布 Inspector 关键帧缓动编辑 / 解析出向区间与展示名', () => {
    const easing = resolveAnimationKeyframeEasing(
      document,
      'intro',
      panelId('a'),
      (path) => (path[1] === 'offset' ? { label: '位置' } : null),
    )
    expect(easing).toEqual({
      entityId: 'hero',
      path: ['LayoutItem', 'offset'],
      keyframeId: 'a',
      interpolation: { kind: 'linear' },
      timeMs: 0,
      nextTimeMs: 300,
      entityName: '主视觉',
      propertyLabel: '位置',
    })
  })

  it('OpenSpec: editor-workspace-layout / 关键帧缓动写入文档并可撤销 / 末帧没有出向区间', () => {
    const easing = resolveAnimationKeyframeEasing(document, 'intro', panelId('b'))
    expect(easing?.nextTimeMs).toBeNull()
    // 末帧仍然携带插值：拖动改变前后顺序后它会重新参与求值。
    expect(easing?.interpolation).toEqual({ kind: 'cubic', control: [0.42, 0, 0.58, 1] })
    // 未提供 label 端口时用路径兜底，不猜测名称。
    expect(easing?.propertyLabel).toBe('LayoutItem.offset')
  })

  it('OpenSpec: editor-workspace-layout / 画布 Inspector 关键帧缓动编辑 / 失效选择不产生上下文', () => {
    expect(resolveAnimationKeyframeEasing(document, 'intro', null)).toBeNull()
    expect(resolveAnimationKeyframeEasing(document, null, panelId('a'))).toBeNull()
    expect(resolveAnimationKeyframeEasing(undefined, 'intro', panelId('a'))).toBeNull()
    // 已被删除的关键帧、不参与动画的 Entity 与非本 adapter 的 ID 一律解不出。
    expect(resolveAnimationKeyframeEasing(document, 'intro', panelId('missing'))).toBeNull()
    expect(resolveAnimationKeyframeEasing(documentWith(entity()), 'intro', panelId('a'))).toBeNull()
    expect(resolveAnimationKeyframeEasing(document, 'intro', 'not-a-panel-id')).toBeNull()
  })
})
