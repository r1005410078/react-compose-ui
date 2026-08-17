import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ComposeDocument, ComposeEntity, EditorCommand, JsonObject } from '@compose-ui/core'
import { useAnimationMode } from './use-animation-mode'

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

const movingClips = {
  clips: {
    intro: [{
      path: ['LayoutItem', 'offset'],
      valueKind: 'vector2',
      keyframes: [
        { id: 'a', timeMs: 0, value: { x: 0, y: 0 }, interpolation: { kind: 'linear' } },
        { id: 'b', timeMs: 300, value: { x: 300, y: 0 }, interpolation: { kind: 'linear' } },
      ],
    }],
  },
} as unknown as JsonObject

function documentWith(
  entities: Readonly<Record<string, ComposeEntity>>,
  hasAnimation = true,
): ComposeDocument {
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
    ...(hasAnimation
      ? { animations: [{ id: 'intro', name: '入场', durationMs: 300, playbackMode: 'play-once' as const }] }
      : {}),
  }
}

function setup(document: ComposeDocument) {
  const dispatched: EditorCommand[] = []
  let seq = 0
  const view = renderHook(() => useAnimationMode({
    document,
    dispatch: (command) => {
      dispatched.push(command)
      return { status: 'noop', command } as never
    },
    idFactory: () => `id-${seq += 1}`,
  }))
  return { dispatched, view }
}

describe('useAnimationMode', () => {
  it('OpenSpec: editor-workspace-layout / 空动画的创建引导 / 水合绑定动画清单', () => {
    const { dispatched, view } = setup(documentWith({ rect: entity('rect') }, false))
    // 无动画：面板显示空模型，animationId 为 null。
    expect(view.result.current.animationId).toBeNull()
    expect(view.result.current.panelValue?.model.tracks).toEqual([])
    act(() => view.result.current.hydrateAnimation({
      id: 'intro',
      name: '动画 1',
      durationMs: 300,
      playbackMode: 'play-once',
    }))
    expect(dispatched).toHaveLength(1)
    expect(dispatched[0]).toMatchObject({
      type: 'animation.create',
      payload: { animationId: 'intro', name: '动画 1', durationMs: 300 },
      meta: { source: 'animation-mode' },
    })
  })

  it('OpenSpec: editor-workspace-layout / 空动画的创建引导 / 带绑定的清单水合为一次事务', () => {
    const { dispatched, view } = setup(documentWith({ rect: entity('rect') }, false))
    act(() => view.result.current.hydrateAnimation({
      id: 'intro',
      name: '动画 1',
      durationMs: 300,
      playbackMode: 'loop',
      bindings: { playing: { scope: 'page', exportName: 'animate' } },
    }))
    expect(dispatched).toHaveLength(2)
    expect(dispatched[0]).toMatchObject({ type: 'animation.create' })
    expect(dispatched[1]).toMatchObject({
      type: 'animation.configure',
      payload: { animationId: 'intro' },
    })
    // 共享 mergeKey：创建与绑定合成一次可撤销事务。
    expect(dispatched[0]?.meta?.mergeKey).toBeDefined()
    expect(dispatched[0]?.meta?.mergeKey).toBe(dispatched[1]?.meta?.mergeKey)
  })

  it('OpenSpec: 画布动画绑定属性 / 解除绑定移除镜像清单', () => {
    const { dispatched, view } = setup(documentWith({ rect: entity('rect') }))
    act(() => view.result.current.removeAnimation('intro'))
    expect(dispatched).toHaveLength(1)
    expect(dispatched[0]).toMatchObject({
      type: 'animation.delete',
      payload: { animationId: 'intro' },
    })
  })

  it('OpenSpec: editor-workspace-layout / 动画模式 / 播放头驱动画布且不产生命令', () => {
    const { dispatched, view } = setup(documentWith({ moving: entity('moving', movingClips) }))
    act(() => view.result.current.setActive(true))
    act(() => view.result.current.onPanelValueChange({
      ...view.result.current.panelValue!,
      currentTimeMs: 150,
    }))
    const sampled = view.result.current.displayDocument!
    const layoutItem = sampled.entities.moving?.components.LayoutItem as { offset: { x: number } }
    expect(layoutItem.offset.x).toBeCloseTo(150)
    // 播放头是会话状态：不派发任何命令。
    expect(dispatched).toEqual([])
    // 会话动作（播放头）经 onPanelAction 也不产生命令。
    act(() => view.result.current.onPanelAction({ kind: 'set-current-time', timeMs: 200 }))
    expect(dispatched).toEqual([])
  })

  it('OpenSpec: editor-workspace-layout / 动画模式 / 退出模式后画布恢复基础文档', () => {
    const document = documentWith({ moving: entity('moving', movingClips) })
    const { view } = setup(document)
    act(() => view.result.current.setActive(true))
    act(() => view.result.current.onPanelValueChange({
      ...view.result.current.panelValue!,
      currentTimeMs: 150,
    }))
    expect(view.result.current.displayDocument).not.toBe(document)
    act(() => view.result.current.setActive(false))
    expect(view.result.current.displayDocument).toBe(document)
  })

  it('OpenSpec: editor-workspace-layout / 属性面板关键帧打点按钮 / 打点与删点', () => {
    const { dispatched, view } = setup(documentWith({ moving: entity('moving', movingClips) }))
    // 播放头 0 ms 已有关键帧 a → keyed → 点击删除。
    expect(view.result.current.keyStateFor('moving', ['LayoutItem', 'offset'])).toBe('keyed')
    act(() => view.result.current.toggleKey(
      'moving', ['LayoutItem', 'offset'], 'vector2', { x: 0, y: 0 },
    ))
    expect(dispatched[0]).toMatchObject({
      type: 'animation.keyframe.remove',
      payload: { keyframeId: 'a' },
    })
    // 无轨道属性 → none → 点击写入当前值。
    expect(view.result.current.keyStateFor('moving', ['Appearance', 'opacity'])).toBe('none')
    act(() => view.result.current.toggleKey('moving', ['Appearance', 'opacity'], 'number', 1))
    expect(dispatched[1]).toMatchObject({
      type: 'animation.keyframe.set',
      payload: { valueKind: 'number', timeMs: 0, value: 1 },
    })
  })

  it('时间线编辑动作翻译为命令派发', () => {
    const { dispatched, view } = setup(documentWith({ moving: entity('moving', movingClips) }))
    const panelKeyframeId = view.result.current.panelValue!
      .model.tracks[0]!.properties[0]!.keyframes[1]!.id
    const panelPropertyId = view.result.current.panelValue!.model.tracks[0]!.properties[0]!.id
    act(() => view.result.current.onPanelAction({
      kind: 'move-keyframe',
      propertyId: panelPropertyId,
      keyframeId: panelKeyframeId,
      timeMs: 250,
    }))
    expect(dispatched[0]).toMatchObject({
      type: 'animation.keyframe.move',
      payload: { entityId: 'moving', keyframeId: 'b', timeMs: 250 },
    })
  })
})
