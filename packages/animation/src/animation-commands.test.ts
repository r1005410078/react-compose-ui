import {
  BUILTIN_COMMAND_TYPES,
  type ComposeAnimation,
  type ComposeDocument,
  type ComposeEntity,
  type EditorCommand,
  type JsonObject,
  createTransactionRuntime,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import {
  COMPOSE_ANIMATION_COMMAND_TYPES,
  createComposeAnimationCommandHandlers,
} from './animation-commands'
import { getComposeEntityTracks } from './animation-component'
import { COMPOSE_ANIMATION_COMPONENT_KEY } from './animation-types'

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

function documentWith(
  entities: Readonly<Record<string, ComposeEntity>>,
  // 用 null 表达"文档没有 animations 字段"；传 undefined 会落回默认参数。
  animations: readonly ComposeAnimation[] | null = [intro],
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
    ...(animations ? { animations } : {}),
  }
}

let commandSeq = 0
function command(type: string, payload: JsonObject): EditorCommand {
  commandSeq += 1
  return { id: `cmd-${commandSeq}`, type, payload }
}

function runtime(document: ComposeDocument) {
  // 内建 handler 由 `createTransactionRuntime` 自己注册，这里只注入动画包的。
  return createTransactionRuntime({
    document,
    handlers: createComposeAnimationCommandHandlers(),
  })
}

const opacityKeyframe = (timeMs: number, value: number, keyframeId = `k-${timeMs}`) => ({
  animationId: 'intro',
  entityId: 'rect',
  path: ['Appearance', 'opacity'],
  valueKind: 'number',
  keyframeId,
  timeMs,
  value,
})

describe('动画清单命令', () => {
  it('OpenSpec: scene-animation / 动画编辑命令 / 创建动画写入清单并可撤销', () => {
    const host = runtime(documentWith({ rect: entity('rect') }, null))
    expect(host.document.animations).toBeUndefined()
    const result = host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.create, {
      animationId: 'intro', name: '入场动画', durationMs: 300,
    }))
    expect(result.status).toBe('committed')
    expect(host.document.animations).toEqual([
      { id: 'intro', name: '入场动画', durationMs: 300, playbackMode: 'play-once' },
    ])
    host.undo()
    // 原文档没有 animations 字段，撤销后必须彻底消失而不是留下空数组。
    expect(host.document.animations).toBeUndefined()
  })

  it('OpenSpec: scene-animation / 动画编辑命令 / 重复 ID 与非法时长被拒绝', () => {
    const host = runtime(documentWith({ rect: entity('rect') }))
    expect(host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.create, {
      animationId: 'intro', name: '重复', durationMs: 300,
    })).status).toBe('rejected')
    expect(host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.create, {
      animationId: 'other', name: '零时长', durationMs: 0,
    })).status).toBe('rejected')
  })

  it('OpenSpec: scene-animation / 动画编辑命令 / 配置动画参数与播放绑定', () => {
    const host = runtime(documentWith({ rect: entity('rect') }))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.configure, {
      animationId: 'intro',
      playbackMode: 'loop',
      bindings: { playing: { scope: 'page', exportName: 'isReady' } },
    }))
    expect(host.document.animations?.[0]).toEqual({
      id: 'intro',
      name: '入场动画',
      durationMs: 300,
      playbackMode: 'loop',
      bindings: { playing: { scope: 'page', exportName: 'isReady' } },
    })
  })

  it('OpenSpec: compose-preview / 动画自动播放 / 配置自动播放且 false 不留字段', () => {
    const host = runtime(documentWith({ rect: entity('rect') }))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.configure, {
      animationId: 'intro',
      autoplay: true,
    }))
    expect(host.document.animations?.[0]?.autoplay).toBe(true)
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.configure, {
      animationId: 'intro',
      autoplay: false,
    }))
    // 关闭序列化为删除字段：清单不长期携带无信息量的 `autoplay: false`。
    expect(host.document.animations?.[0]).not.toHaveProperty('autoplay')
    expect(host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.configure, {
      animationId: 'intro',
      autoplay: 'yes',
    })).status).toBe('rejected')
  })
})

describe('关键帧命令', () => {
  it('OpenSpec: scene-animation / 动画编辑命令 / 首次打点自动建立 Component 与轨道', () => {
    const host = runtime(documentWith({ rect: entity('rect') }))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, opacityKeyframe(0, 0.2)))
    const tracks = getComposeEntityTracks(host.document.entities.rect!, 'intro')
    expect(tracks).toHaveLength(1)
    expect(tracks[0]?.path).toEqual(['Appearance', 'opacity'])
    expect(tracks[0]?.valueKind).toBe('number')
    expect(tracks[0]?.keyframes).toEqual([
      { id: 'k-0', timeMs: 0, value: 0.2, interpolation: { kind: 'linear' } },
    ])
  })

  it('OpenSpec: scene-animation / 动画编辑命令 / 同一时间再次打点替换值', () => {
    const host = runtime(documentWith({ rect: entity('rect') }))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, opacityKeyframe(200, 0.2)))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, {
      ...opacityKeyframe(200, 0.9), keyframeId: 'different-id',
    }))
    const keyframes = getComposeEntityTracks(host.document.entities.rect!, 'intro')[0]?.keyframes
    expect(keyframes).toHaveLength(1)
    expect(keyframes?.[0]?.value).toBe(0.9)
    // 替换值不应当换掉关键帧身份，否则时间线上的选中态会莫名其妙丢失。
    expect(keyframes?.[0]?.id).toBe('k-200')
  })

  it('OpenSpec: scene-animation / 动画编辑命令 / 关键帧按时间升序插入', () => {
    const host = runtime(documentWith({ rect: entity('rect') }))
    for (const timeMs of [300, 0, 150]) {
      host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, opacityKeyframe(timeMs, 1)))
    }
    const keyframes = getComposeEntityTracks(host.document.entities.rect!, 'intro')[0]?.keyframes
    expect(keyframes?.map((item) => item.timeMs)).toEqual([0, 150, 300])
  })

  it('OpenSpec: scene-animation / 动画编辑命令 / 撤销打点恢复原文档', () => {
    const document = documentWith({ rect: entity('rect') })
    const host = runtime(document)
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, opacityKeyframe(0, 0.2)))
    expect(host.document.entities.rect?.components[COMPOSE_ANIMATION_COMPONENT_KEY]).toBeDefined()
    host.undo()
    expect(host.document.entities.rect?.components[COMPOSE_ANIMATION_COMPONENT_KEY]).toBeUndefined()
    expect(host.document).toEqual(document)
  })

  it('OpenSpec: scene-animation / 动画编辑命令 / 越界与形状不符的打点被拒绝', () => {
    const host = runtime(documentWith({ rect: entity('rect') }))
    expect(host.dispatch(command(
      COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe,
      opacityKeyframe(400, 1),
    )).status).toBe('rejected')
    expect(host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, {
      ...opacityKeyframe(0, 1), value: { x: 1, y: 2 },
    })).status).toBe('rejected')
  })

  it('OpenSpec: scene-animation / 动画编辑命令 / 移动关键帧到已占用时间被拒绝', () => {
    const host = runtime(documentWith({ rect: entity('rect') }))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, opacityKeyframe(0, 0)))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, opacityKeyframe(100, 1)))
    const before = host.document
    const result = host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.moveKeyframe, {
      animationId: 'intro',
      entityId: 'rect',
      path: ['Appearance', 'opacity'],
      keyframeId: 'k-0',
      timeMs: 100,
    }))
    expect(result.status).toBe('rejected')
    if (result.status === 'rejected') {
      expect(result.issues[0]?.code).toBe('keyframe.duplicate-time')
    }
    expect(host.document).toBe(before)
  })

  it('OpenSpec: scene-animation / 动画编辑命令 / 移动关键帧后保持升序', () => {
    const host = runtime(documentWith({ rect: entity('rect') }))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, opacityKeyframe(0, 0)))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, opacityKeyframe(100, 1)))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.moveKeyframe, {
      animationId: 'intro',
      entityId: 'rect',
      path: ['Appearance', 'opacity'],
      keyframeId: 'k-0',
      timeMs: 250,
    }))
    const keyframes = getComposeEntityTracks(host.document.entities.rect!, 'intro')[0]?.keyframes
    expect(keyframes?.map((item) => [item.id, item.timeMs])).toEqual([['k-100', 100], ['k-0', 250]])
  })

  it('OpenSpec: scene-animation / 动画编辑命令 / 设置插值与空间切线', () => {
    const host = runtime(documentWith({ rect: entity('rect') }))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, {
      animationId: 'intro',
      entityId: 'rect',
      path: ['LayoutItem', 'offset'],
      valueKind: 'vector2',
      keyframeId: 'v0',
      timeMs: 0,
      value: { x: 0, y: 0 },
    }))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setInterpolation, {
      animationId: 'intro',
      entityId: 'rect',
      path: ['LayoutItem', 'offset'],
      keyframeId: 'v0',
      interpolation: { kind: 'cubic', control: [0.42, 0, 0.58, 1] },
    }))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setSpatialTangent, {
      animationId: 'intro',
      entityId: 'rect',
      path: ['LayoutItem', 'offset'],
      keyframeId: 'v0',
      spatial: { mode: 'smooth', inX: -10, inY: 0, outX: 10, outY: 0 },
    }))
    const keyframe = getComposeEntityTracks(host.document.entities.rect!, 'intro')[0]?.keyframes[0]
    expect(keyframe?.interpolation).toEqual({ kind: 'cubic', control: [0.42, 0, 0.58, 1] })
    expect(keyframe?.spatial).toEqual({ mode: 'smooth', inX: -10, inY: 0, outX: 10, outY: 0 })

    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setSpatialTangent, {
      animationId: 'intro',
      entityId: 'rect',
      path: ['LayoutItem', 'offset'],
      keyframeId: 'v0',
      spatial: null,
    }))
    expect(getComposeEntityTracks(host.document.entities.rect!, 'intro')[0]?.keyframes[0]?.spatial)
      .toBeUndefined()
  })

  it('OpenSpec: scene-animation / 动画编辑命令 / 删空关键帧与轨道后不留空壳', () => {
    const host = runtime(documentWith({ rect: entity('rect') }))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, opacityKeyframe(0, 0)))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.removeKeyframe, {
      animationId: 'intro',
      entityId: 'rect',
      path: ['Appearance', 'opacity'],
      keyframeId: 'k-0',
    }))
    // 最后一个关键帧被删掉后，空轨道、空分组与 Component 都不该留下。
    expect(host.document.entities.rect?.components[COMPOSE_ANIMATION_COMPONENT_KEY]).toBeUndefined()
  })

  it('OpenSpec: scene-animation / 动画编辑命令 / 删除轨道', () => {
    const host = runtime(documentWith({ rect: entity('rect') }))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, opacityKeyframe(0, 0)))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, {
      animationId: 'intro',
      entityId: 'rect',
      path: ['Transform', 'rotation'],
      valueKind: 'number',
      keyframeId: 'r0',
      timeMs: 0,
      value: 0,
    }))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.removeTrack, {
      animationId: 'intro', entityId: 'rect', path: ['Appearance', 'opacity'],
    }))
    const tracks = getComposeEntityTracks(host.document.entities.rect!, 'intro')
    expect(tracks.map((track) => track.path)).toEqual([['Transform', 'rotation']])
  })
})

describe('删除动画', () => {
  it('OpenSpec: scene-animation / 动画编辑命令 / 删除动画清理所有 Entity 分组', () => {
    const host = runtime(documentWith({
      a: entity('a'), b: entity('b'), c: entity('c'),
    }))
    for (const entityId of ['a', 'b', 'c']) {
      host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, {
        ...opacityKeyframe(0, 0.5), entityId,
      }))
    }
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.delete, { animationId: 'intro' }))
    expect(host.document.animations).toEqual([])
    for (const entityId of ['a', 'b', 'c']) {
      expect(host.document.entities[entityId]?.components[COMPOSE_ANIMATION_COMPONENT_KEY])
        .toBeUndefined()
    }
  })

  it('OpenSpec: scene-animation / 动画编辑命令 / 删除动画只清理自己的分组', () => {
    const host = runtime(documentWith({ rect: entity('rect') }, [
      intro,
      { id: 'outro', name: '退场', durationMs: 200, playbackMode: 'loop' },
    ]))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, opacityKeyframe(0, 0.5)))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, {
      ...opacityKeyframe(0, 0.9), animationId: 'outro',
    }))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.delete, { animationId: 'intro' }))
    expect(getComposeEntityTracks(host.document.entities.rect!, 'intro')).toEqual([])
    expect(getComposeEntityTracks(host.document.entities.rect!, 'outro')).toHaveLength(1)
  })
})

describe('结构操作自动带上动画', () => {
  it('OpenSpec: scene-animation / Entity 动画 Component / 动画数据随 Entity 复制', () => {
    const host = runtime(documentWith({ rect: entity('rect') }))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, opacityKeyframe(0, 0.25)))
    // `entity.duplicate` 由调用方构造副本：副本就是原 Entity 的结构克隆，
    // 因此轨道天然跟着走——不需要任何动画专属的搬迁逻辑。
    const source = host.document.entities.rect!
    const copy = { ...source, id: 'rect-copy', name: 'rect copy' }
    expect(copy.components[COMPOSE_ANIMATION_COMPONENT_KEY]).toBeDefined()
    const result = host.dispatch(command(BUILTIN_COMMAND_TYPES.duplicateEntity, {
      entities: { 'rect-copy': copy },
      rootIds: ['rect-copy'],
      parentId: null,
    }))
    expect(result.status).toBe('committed')
    const copied = getComposeEntityTracks(host.document.entities['rect-copy']!, 'intro')
    expect(copied).toHaveLength(1)
    expect(copied[0]?.keyframes[0]?.value).toBe(0.25)
  })

  it('OpenSpec: scene-animation / Entity 动画 Component / 删除 Entity 一并移除其动画', () => {
    const host = runtime(documentWith({ rect: entity('rect') }))
    host.dispatch(command(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, opacityKeyframe(0, 0.25)))
    const withAnimation = host.document
    host.dispatch(command(BUILTIN_COMMAND_TYPES.deleteEntity, { entityIds: ['rect'] }))
    expect(host.document.entities.rect).toBeUndefined()
    host.undo()
    expect(host.document).toEqual(withAnimation)
  })
})
