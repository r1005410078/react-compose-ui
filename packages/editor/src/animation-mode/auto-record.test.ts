import { describe, expect, it } from 'vitest'
import {
  applyComposeAnimationAtTime,
  createComposeAnimationCommandHandlers,
  findComposeAnimationTrack,
} from '@compose-ui/animation'
import {
  BUILTIN_COMMAND_TYPES,
  createTransactionRuntime,
  getComposeLayoutItem,
} from '@compose-ui/core'
import type { ComposeDocument, ComposeEntity, EditorCommand, JsonObject } from '@compose-ui/core'
import { rewriteAutoRecordCommand } from './auto-record'

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
        { id: 'b', timeMs: 400, value: { x: 400, y: 0 }, interpolation: { kind: 'linear' } },
      ],
    }],
  },
} as unknown as JsonObject

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
    animations: [{ id: 'intro', name: '入场', durationMs: 400, playbackMode: 'play-once' }],
  }
}

function createRuntime(document: ComposeDocument) {
  return createTransactionRuntime({
    document,
    handlers: createComposeAnimationCommandHandlers(),
  })
}

let seq = 0
const context = (playheadMs: number) => ({
  animationId: 'intro',
  playheadMs,
  idFactory: () => `rewrite-${seq += 1}`,
})

function moveCommand(entityId: string, x: number, y: number): EditorCommand {
  return {
    id: 'cmd-move',
    type: BUILTIN_COMMAND_TYPES.setTransform,
    payload: {
      operation: 'move',
      updates: [{
        entityId,
        transform: {
          position: { x, y },
          size: { width: 100, height: 100 },
          rotation: 0,
        },
      }],
    },
    meta: { source: 'stage', mergeKey: 'drag-1' },
  } as unknown as EditorCommand
}

describe('rewriteAutoRecordCommand', () => {
  it('OpenSpec: editor-workspace-layout / 自动记录把编辑改写为关键帧 / 播放头非零时在画布上拖动对象', () => {
    const document = documentWith({ moving: entity('moving', movingClips) })
    const runtime = createRuntime(document)
    // 播放头 200 ms：采样位置 x=200；用户把对象拖到 (320, 40)——Stage 发出的是最终绝对位置。
    const rewritten = rewriteAutoRecordCommand(document, context(200), moveCommand('moving', 320, 40))
    expect(rewritten).not.toBeNull()
    expect(rewritten).toHaveLength(1)
    for (const command of rewritten!) {
      expect(runtime.dispatch(command).status).toBe('committed')
    }
    const after = runtime.document
    const track = findComposeAnimationTrack(after.entities.moving!, 'intro', ['LayoutItem', 'offset'])!
    // 200 ms 新增关键帧，值等于最终绝对位置。
    const added = track.keyframes.find((keyframe) => keyframe.timeMs === 200)
    expect(added?.value).toEqual({ x: 320, y: 40 })
    // 0 ms 关键帧与基础文档静态值都不变。
    expect(track.keyframes.find((keyframe) => keyframe.timeMs === 0)?.value).toEqual({ x: 0, y: 0 })
    expect(getComposeLayoutItem(after.entities.moving!).offset).toEqual({ x: 0, y: 0 })
    // 采样验证：播放头 200 ms 处对象落在拖动后的位置。
    const sampled = applyComposeAnimationAtTime(after, 'intro', 200)
    expect(getComposeLayoutItem(sampled.entities.moving!).offset).toEqual({ x: 320, y: 40 })
  })

  it('OpenSpec: editor-workspace-layout / 自动记录把编辑改写为关键帧 / 关闭自动记录后编辑基础值', () => {
    const document = documentWith({ moving: entity('moving', movingClips) })
    const runtime = createRuntime(document)
    // 自动记录关闭 = 改写层未安装：原命令照常派发，写基础文档静态值，不产生关键帧。
    expect(runtime.dispatch(moveCommand('moving', 320, 40)).status).toBe('committed')
    const after = runtime.document
    expect(getComposeLayoutItem(after.entities.moving!).offset).toEqual({ x: 320, y: 40 })
    const track = findComposeAnimationTrack(after.entities.moving!, 'intro', ['LayoutItem', 'offset'])!
    expect(track.keyframes).toHaveLength(2)
  })

  it('Inspector 的 LayoutItem 偏移编辑以基础文档为基线改写', () => {
    const document = documentWith({ moving: entity('moving', movingClips) })
    const item = getComposeLayoutItem(document.entities.moving!)
    const rewritten = rewriteAutoRecordCommand(document, context(200), {
      id: 'cmd-inspector',
      type: BUILTIN_COMMAND_TYPES.updateComponent,
      payload: {
        entityId: 'moving',
        key: 'LayoutItem',
        // Inspector 显示基础值 (0,0)，用户只改 x → y 不应被视为变化（采样值 y 同为 0）。
        value: { ...item, offset: { x: 50, y: 0 } },
      },
      meta: { source: 'inspector' },
    } as unknown as EditorCommand)
    expect(rewritten).toHaveLength(1)
    expect(rewritten![0]!.payload).toMatchObject({
      path: ['LayoutItem', 'offset'],
      valueKind: 'vector2',
      timeMs: 200,
      value: { x: 50, y: 0 },
    })
  })

  it('resize 双轴展开为两条关键帧命令并共享合成 mergeKey', () => {
    const document = documentWith({ box: entity('box') })
    const rewritten = rewriteAutoRecordCommand(document, context(100), {
      id: 'cmd-resize',
      type: BUILTIN_COMMAND_TYPES.setTransform,
      payload: {
        operation: 'resize',
        updates: [{
          entityId: 'box',
          transform: {
            position: { x: 0, y: 0 },
            size: { width: 240, height: 160 },
            rotation: 0,
          },
        }],
      },
      meta: { source: 'stage' },
    } as unknown as EditorCommand)
    expect(rewritten).toHaveLength(2)
    expect(rewritten![0]!.payload).toMatchObject({
      path: ['LayoutItem', 'width', 'value'],
      value: 240,
    })
    expect(rewritten![1]!.payload).toMatchObject({
      path: ['LayoutItem', 'height', 'value'],
      value: 160,
    })
    expect(rewritten![0]!.meta?.mergeKey).toBe('auto-record:cmd-resize')
    expect(rewritten![1]!.meta?.mergeKey).toBe('auto-record:cmd-resize')
  })

  it('Appearance 只改 opacity 时改写为 number 关键帧；含结构变更时整条放行', () => {
    const document = documentWith({ box: entity('box') })
    const opacityOnly = rewriteAutoRecordCommand(document, context(100), {
      id: 'cmd-opacity',
      type: BUILTIN_COMMAND_TYPES.setAppearance,
      payload: {
        entityId: 'box',
        appearance: { backgroundPaint: { kind: 'solid', color: '#3b82f6' }, opacity: 0.5 },
      },
      meta: { source: 'inspector' },
    } as unknown as EditorCommand)
    expect(opacityOnly).toHaveLength(1)
    expect(opacityOnly![0]!.payload).toMatchObject({
      path: ['Appearance', 'opacity'],
      valueKind: 'number',
      value: 0.5,
    })
    // Paint kind 从 solid 切走是结构变更，不进关键帧。
    const paintSwap = rewriteAutoRecordCommand(document, context(100), {
      id: 'cmd-paint',
      type: BUILTIN_COMMAND_TYPES.setAppearance,
      payload: {
        entityId: 'box',
        appearance: {
          backgroundPaint: {
            kind: 'linear-gradient',
            angle: 0,
            stops: [
              { offset: 0, color: '#000000' },
              { offset: 1, color: '#ffffff' },
            ],
          },
          opacity: 1,
        },
      },
      meta: { source: 'inspector' },
    } as unknown as EditorCommand)
    expect(paintSwap).toBeNull()
  })

  it('Flow 布局下的 move 不可改写，整条放行', () => {
    const flow = entity('flow')
    const flowItem = {
      ...(flow.components.LayoutItem as JsonObject),
      positioning: 'flow',
    }
    const document = documentWith({
      flow: { ...flow, components: { ...flow.components, LayoutItem: flowItem } },
    })
    expect(rewriteAutoRecordCommand(document, context(100), moveCommand('flow', 10, 10))).toBeNull()
  })

  it('margin 等结构字段变化时不做部分改写', () => {
    const document = documentWith({ box: entity('box') })
    const item = getComposeLayoutItem(document.entities.box!)
    const rewritten = rewriteAutoRecordCommand(document, context(100), {
      id: 'cmd-margin',
      type: BUILTIN_COMMAND_TYPES.updateComponent,
      payload: {
        entityId: 'box',
        key: 'LayoutItem',
        value: {
          ...item,
          offset: { x: 30, y: 0 },
          margin: { top: 8, right: 0, bottom: 0, left: 0 },
        },
      },
      meta: { source: 'inspector' },
    } as unknown as EditorCommand)
    expect(rewritten).toBeNull()
  })

  it('播放头超出时长时钳到动画末尾', () => {
    const document = documentWith({ moving: entity('moving', movingClips) })
    const rewritten = rewriteAutoRecordCommand(document, context(900), moveCommand('moving', 500, 0))
    expect(rewritten).toHaveLength(1)
    expect(rewritten![0]!.payload).toMatchObject({ timeMs: 400 })
  })
})
