import { createComposeFrameEntity } from '@compose-ui/core'
import type { ComposeDocument, ComposeEntity, JsonObject } from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import type { ComposeAnimationPanelAction } from '@compose-ui/animation-panel'
import {
  buildAnimationPanelModel,
  decodeAnimationKeyframeId,
  decodeAnimationPropertyId,
  encodeAnimationKeyframeId,
  encodeAnimationPropertyId,
  translateAnimationPanelAction,
} from './animation-document-adapter'
import { getAnimationKeyState, isAnimationPathAvailable } from './animation-key-state'

function entity(id: string, name: string, overrides: {
  readonly animation?: JsonObject
  readonly positioning?: 'flow' | 'absolute'
  readonly widthMode?: 'fixed' | 'fill' | 'hug'
} = {}): ComposeEntity {
  return {
    id,
    name,
    components: {
      Composition: { presetId: 'rectangle', baseComponentKeys: [], capabilityIds: [] },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: overrides.positioning ?? 'absolute',
        offset: { x: 10, y: 20 },
        width: { mode: overrides.widthMode ?? 'fixed', value: 100, min: null, max: null },
        height: { mode: 'fixed', value: 100, min: null, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Renderer: { type: 'rectangle', props: {} },
      Appearance: { backgroundPaint: { kind: 'solid', color: '#3b82f6' }, opacity: 1 },
      ...(overrides.animation ? { Animation: overrides.animation } : {}),
    },
  }
}

const offsetTracks = {
  clips: {
    intro: [
      {
        path: ['LayoutItem', 'offset'],
        valueKind: 'vector2',
        keyframes: [
          { id: 'a', timeMs: 0, value: { x: 0, y: 0 }, interpolation: { kind: 'linear' } },
          { id: 'b', timeMs: 300, value: { x: 120, y: 40 }, interpolation: { kind: 'linear' } },
        ],
      },
      {
        path: ['Appearance', 'opacity'],
        valueKind: 'number',
        keyframes: [
          { id: 'o1', timeMs: 100, value: 0.5, interpolation: { kind: 'hold' } },
        ],
      },
    ],
  },
} as unknown as JsonObject

/** 动画清单归属 Frame：夹具把被测 Entity 挂进一块持有清单的根 Frame。 */
const FRAME_ID = 'frame-root'

function documentWith(entities: Readonly<Record<string, ComposeEntity>>): ComposeDocument {
  return {
    schemaVersion: 7,
    canvas: {
      grid: { stepX: 8, stepY: 8, offsetX: 0, offsetY: 0, primaryLineEvery: 5, snapEnabled: true },
      smartSnap: { nodes: true, guides: true },
    },
    rootIds: [FRAME_ID],
    entities: {
      ...entities,
      [FRAME_ID]: createComposeFrameEntity({
        id: FRAME_ID,
        childIds: Object.keys(entities),
        animations: [{ id: 'intro', name: '入场', durationMs: 300, playbackMode: 'play-once' }],
      }),
    },
  }
}

describe('文档动画 → 面板会话模型', () => {
  it('OpenSpec: editor-workspace-layout / 时间线显示文档动画 / 对象轨道取 Entity 名称', () => {
    const document = documentWith({
      hero: entity('hero', '主视觉矩形', { animation: offsetTracks }),
      plain: entity('plain', '无动画'),
    })
    const model = buildAnimationPanelModel(document, FRAME_ID, 'intro')
    expect(model.durationMs).toBe(300)
    expect(model.tracks).toHaveLength(1)
    expect(model.tracks[0]?.id).toBe('hero')
    expect(model.tracks[0]?.label).toBe('主视觉矩形')
  })

  it('OpenSpec: editor-workspace-layout / 时间线显示文档动画 / vector2 是单条属性轨道', () => {
    const document = documentWith({ hero: entity('hero', '主视觉', { animation: offsetTracks }) })
    const model = buildAnimationPanelModel(document, FRAME_ID, 'intro', {
      propertyLabel: (path) => path[1] === 'offset'
        ? { label: 'Position', groupLabel: 'Position' }
        : null,
    })
    const properties = model.tracks[0]?.properties ?? []
    expect(properties).toHaveLength(2)
    const position = properties[0]!
    expect(position.label).toBe('Position')
    expect(position.valueKind).toBe('vector2')
    expect(position.keyframes.map((keyframe) => keyframe.value))
      .toEqual([{ x: 0, y: 0 }, { x: 120, y: 40 }])
    // 未提供 label 端口的路径用兜底名，不猜测。
    expect(properties[1]?.label).toBe('Appearance.opacity')
  })

  it('编码 ID 对任意字符串段无歧义且可逆', () => {
    const ref = { entityId: 'has"quote:and/slash', path: ['LayoutItem', 'offset'] }
    expect(decodeAnimationPropertyId(encodeAnimationPropertyId(ref))).toEqual(ref)
    const kfRef = { ...ref, keyframeId: 'kf:1' }
    expect(decodeAnimationKeyframeId(encodeAnimationKeyframeId(kfRef))).toEqual(kfRef)
    expect(decodeAnimationPropertyId('not-json')).toBeNull()
    expect(decodeAnimationKeyframeId('["only","two"]')).toBeNull()
  })
})

describe('面板动作 → 动画命令', () => {
  const document = documentWith({ hero: entity('hero', '主视觉', { animation: offsetTracks }) })
  const propertyId = encodeAnimationPropertyId({ entityId: 'hero', path: ['LayoutItem', 'offset'] })
  const keyframeId = encodeAnimationKeyframeId({
    entityId: 'hero',
    path: ['LayoutItem', 'offset'],
    keyframeId: 'b',
  })
  const translate = (action: ComposeAnimationPanelAction) =>
    translateAnimationPanelAction(document, 'intro', action)

  it('OpenSpec: editor-workspace-layout / 动画模式 / 会话动作不产生文档命令', () => {
    expect(translate({ kind: 'set-current-time', timeMs: 150 })).toEqual([])
    expect(translate({ kind: 'select', trackId: 'hero', propertyId: null, keyframeId: null }))
      .toEqual([])
    expect(translate({ kind: 'toggle-auto-record' })).toEqual([])
  })

  it('OpenSpec: editor-workspace-layout / 时间线显示文档动画 / 拖动关键帧翻译为移动命令', () => {
    const draft = translate({ kind: 'move-keyframe', propertyId, keyframeId, timeMs: 250 })
    expect(draft).toEqual([{
      type: 'animation.keyframe.move',
      payload: {
        animationId: 'intro',
        entityId: 'hero',
        path: ['LayoutItem', 'offset'],
        keyframeId: 'b',
        timeMs: 250,
      },
    }])
  })

  it('改值翻译为同时间 upsert，保留关键帧身份', () => {
    const draft = translate({ kind: 'set-keyframe-value', propertyId, keyframeId, value: { x: 5, y: 6 } })
    expect(draft[0]?.type).toBe('animation.keyframe.set')
    expect(draft[0]?.payload).toMatchObject({
      keyframeId: 'b',
      timeMs: 300,
      value: { x: 5, y: 6 },
      valueKind: 'vector2',
    })
  })

  it('时长与播放模式翻译为 animation.configure', () => {
    expect(translate({ kind: 'set-duration', durationMs: 500 })).toEqual([{
      type: 'animation.configure',
      payload: { animationId: 'intro', durationMs: 500 },
    }])
    expect(translate({ kind: 'set-playback-mode', mode: 'loop' })).toEqual([{
      type: 'animation.configure',
      payload: { animationId: 'intro', playbackMode: 'loop' },
    }])
  })

  it('删除与插值命令携带解码后的文档定位', () => {
    expect(translate({ kind: 'remove-keyframe', propertyId, keyframeId })[0]?.type)
      .toBe('animation.keyframe.remove')
    const interpolation = { kind: 'cubic', control: [0.42, 0, 1, 1] } as const
    expect(translate({ kind: 'set-interpolation', propertyId, keyframeId, interpolation })[0]?.payload)
      .toMatchObject({ keyframeId: 'b', interpolation })
  })

  it('无法解码的 ID 返回空命令列表而不是抛错', () => {
    expect(translate({ kind: 'move-keyframe', propertyId: 'junk', keyframeId: 'junk', timeMs: 1 }))
      .toEqual([])
  })

  it('OpenSpec: editor-workspace-layout / 时间线更多操作菜单落到可撤销命令 / 删除属性轨道', () => {
    expect(translate({ kind: 'remove-track', propertyId })).toEqual([{
      type: 'animation.track.remove',
      payload: { animationId: 'intro', entityId: 'hero', path: ['LayoutItem', 'offset'] },
    }])
  })

  it('OpenSpec: editor-workspace-layout / 时间线更多操作菜单落到可撤销命令 / 删除对象全部轨道合成一次事务', () => {
    const drafts = translate({ kind: 'remove-track-group', trackId: 'hero' })
    expect(drafts.length).toBeGreaterThan(0)
    expect(drafts.every((draft) => draft.type === 'animation.track.remove')).toBe(true)
    // 全部命令共享同一个 mergeKey，运行时才会把它们折叠成一步撤销。
    expect(new Set(drafts.map((draft) => draft.mergeKey)).size).toBe(1)
    expect(drafts[0]?.mergeKey).toBeTruthy()
  })

  it('OpenSpec: editor-workspace-layout / 时间线更多操作菜单落到可撤销命令 / 在光标时间打点取采样值', () => {
    // offset 轨道在 0 ms 是 {0,0}、300 ms 是 {120,40}（见夹具）：150 ms 线性采样即中点。
    const drafts = translate({ kind: 'add-keyframe-at-time', propertyId, timeMs: 150 })
    expect(drafts[0]?.type).toBe('animation.keyframe.set')
    expect(drafts[0]?.payload).toMatchObject({
      timeMs: 150,
      valueKind: 'vector2',
      value: { x: 60, y: 20 },
    })
  })
})

describe('菱形四态', () => {
  it('OpenSpec: editor-workspace-layout / 属性面板关键帧打点按钮 / 三态切换', () => {
    const document = documentWith({ hero: entity('hero', '主视觉', { animation: offsetTracks }) })
    const offset = ['LayoutItem', 'offset']
    // 播放头正落在 0 ms 关键帧上 → keyed；落在无帧时刻 → animated；无轨道属性 → none。
    expect(getAnimationKeyState(document, FRAME_ID, 'intro', 'hero', offset, 0)).toBe('keyed')
    expect(getAnimationKeyState(document, FRAME_ID, 'intro', 'hero', offset, 150)).toBe('animated')
    expect(getAnimationKeyState(document, FRAME_ID, 'intro', 'hero', ['Transform', 'rotation'], 0))
      .toBe('none')
  })

  it('OpenSpec: editor-workspace-layout / 属性面板关键帧打点按钮 / 布局配置导致不可动画', () => {
    const document = documentWith({
      flowing: entity('flowing', 'Flow 子项', { positioning: 'flow' }),
      hugging: entity('hugging', 'Fill 宽度', { widthMode: 'fill' }),
    })
    expect(getAnimationKeyState(document, FRAME_ID, 'intro', 'flowing', ['LayoutItem', 'offset'], 0))
      .toBe('unavailable')
    expect(getAnimationKeyState(document, FRAME_ID, 'intro', 'hugging', ['LayoutItem', 'width', 'value'], 0))
      .toBe('unavailable')
    // 同一 Entity 的其他属性不受影响。
    expect(isAnimationPathAvailable(document, 'flowing', ['Appearance', 'opacity'])).toBe(true)
    expect(isAnimationPathAvailable(document, 'hugging', ['LayoutItem', 'height', 'value']))
      .toBe(true)
  })

  it('动画或 Entity 不存在时为 unavailable', () => {
    const document = documentWith({ hero: entity('hero', '主视觉') })
    expect(getAnimationKeyState(document, FRAME_ID, 'missing', 'hero', ['Appearance', 'opacity'], 0))
      .toBe('unavailable')
    expect(getAnimationKeyState(document, FRAME_ID, 'intro', 'ghost', ['Appearance', 'opacity'], 0))
      .toBe('unavailable')
  })
})
