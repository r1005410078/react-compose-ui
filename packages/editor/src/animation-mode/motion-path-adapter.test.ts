import { describe, expect, it } from 'vitest'
import {
  createComposeAnimationCommandHandlers,
  findComposeAnimationTrack,
} from '@compose-ui/animation'
import type { ComposeAnimationTrack } from '@compose-ui/animation'
import { createTransactionRuntime } from '@compose-ui/core'
import type { ComposeDocument, ComposeEntity, JsonObject } from '@compose-ui/core'
import {
  applyMotionPathDraftToTrack,
  buildMotionPathEditablePath,
  motionPathCommandForDraft,
  motionPathDraftForChange,
  motionPathDraftIsNoop,
  motionPathToggleCommand,
} from './motion-path-adapter'

const track: ComposeAnimationTrack = {
  path: ['LayoutItem', 'offset'],
  valueKind: 'vector2',
  keyframes: [
    { id: 'a', timeMs: 0, value: { x: 0, y: 0 }, interpolation: { kind: 'linear' } },
    {
      id: 'b',
      timeMs: 200,
      value: { x: 100, y: 0 },
      interpolation: { kind: 'linear' },
      spatial: { mode: 'smooth', inX: -20, inY: -10, outX: 20, outY: 10 },
    },
    { id: 'c', timeMs: 400, value: { x: 200, y: 80 }, interpolation: { kind: 'linear' } },
  ],
}
const origin = { x: 40, y: 60 }
const commandOptions = { animationId: 'intro', entityId: 'moving', idFactory: () => 'draft-id' }

describe('motion-path-adapter', () => {
  it('OpenSpec: editor-workspace-layout / 选中实体的运动路径 / 位置轨道生成世界坐标几何', () => {
    const path = buildMotionPathEditablePath('moving', track, origin)!
    expect(path.entityId).toBe('moving')
    // 顶点 ID 就是关键帧 ID，几何整体平移 origin。
    expect(path.vertices.map((vertex) => vertex.id)).toEqual(['a', 'b', 'c'])
    expect(path.vertices[0]!.point).toEqual({ x: 40, y: 60 })
    expect(path.vertices[1]!.point).toEqual({ x: 140, y: 60 })
    // smooth 顶点的切线是绝对端点：顶点 + 相对增量 + origin。
    expect(path.vertices[1]!.inTangent).toEqual({ x: 120, y: 50 })
    expect(path.vertices[1]!.outTangent).toEqual({ x: 160, y: 70 })
    expect(path.vertices[1]!.mode).toBe('smooth')
    expect(path.polyline.length).toBeGreaterThan(2)
    expect(path.dots.length).toBeGreaterThan(0)
  })

  it('非位置轨道或空轨道不生成路径', () => {
    expect(buildMotionPathEditablePath('moving', { ...track, keyframes: [] }, origin)).toBeNull()
    expect(buildMotionPathEditablePath('moving', {
      ...track,
      path: ['Appearance', 'opacity'],
      valueKind: 'number',
    }, origin)).toBeNull()
  })

  it('OpenSpec: editor-workspace-layout / 运动路径编辑写回关键帧 / 拖顶点折回父坐标写值', () => {
    const draft = motionPathDraftForChange(track, {
      vertexId: 'c',
      handle: 'vertex',
      worldPoint: { x: 300, y: 200 },
      modifiers: { shift: false },
    }, origin)!
    expect(draft).toEqual({ kind: 'value', keyframeId: 'c', timeMs: 400, value: { x: 260, y: 140 } })
    const command = motionPathCommandForDraft(draft, commandOptions)
    expect(command).toMatchObject({
      type: 'animation.keyframe.set',
      payload: {
        entityId: 'moving',
        keyframeId: 'c',
        valueKind: 'vector2',
        timeMs: 400,
        value: { x: 260, y: 140 },
      },
      meta: { mergeKey: 'motion-path:moving:c:value' },
    })
  })

  it('OpenSpec: editor-workspace-layout / 运动路径编辑写回关键帧 / 拖切线写相对增量并保留另一侧', () => {
    const draft = motionPathDraftForChange(track, {
      vertexId: 'b',
      handle: 'tangent-out',
      // 世界坐标 (170, 90) → 父坐标 (130, 30) → 相对顶点 (100, 0) 的增量 (30, 30)。
      worldPoint: { x: 170, y: 90 },
      modifiers: { shift: false },
    }, origin)!
    expect(draft).toEqual({
      kind: 'spatial',
      keyframeId: 'b',
      spatial: { mode: 'smooth', inX: -20, inY: -10, outX: 30, outY: 30 },
    })
    const command = motionPathCommandForDraft(draft, commandOptions)
    expect(command).toMatchObject({ type: 'animation.keyframe.spatial.set' })
  })

  it('Shift 约束切线对称：另一侧取共线等长镜像', () => {
    const draft = motionPathDraftForChange(track, {
      vertexId: 'b',
      handle: 'tangent-out',
      worldPoint: { x: 170, y: 90 },
      modifiers: { shift: true },
    }, origin)!
    expect(draft).toMatchObject({
      kind: 'spatial',
      spatial: { inX: -30, inY: -30, outX: 30, outY: 30 },
    })
  })

  it('拖动 corner 顶点的切线隐式进入 smooth', () => {
    const draft = motionPathDraftForChange(track, {
      vertexId: 'a',
      handle: 'tangent-out',
      worldPoint: { x: 64, y: 60 },
      modifiers: { shift: false },
    }, origin)!
    expect(draft).toMatchObject({
      kind: 'spatial',
      spatial: { mode: 'smooth', outX: 24, outY: 0, inX: 0, inY: 0 },
    })
  })

  it('预览轨道套用草稿后可重建几何；与现状一致的草稿判定为 noop', () => {
    const draft = motionPathDraftForChange(track, {
      vertexId: 'c',
      handle: 'vertex',
      worldPoint: { x: 300, y: 200 },
      modifiers: { shift: false },
    }, origin)!
    const previewed = applyMotionPathDraftToTrack(track, draft)
    const path = buildMotionPathEditablePath('moving', previewed, origin)!
    expect(path.vertices[2]!.point).toEqual({ x: 300, y: 200 })
    expect(motionPathDraftIsNoop(track, draft)).toBe(false)
    // 原地松手（点击顶点没有移动）不应产生命令。
    const still = motionPathDraftForChange(track, {
      vertexId: 'c',
      handle: 'vertex',
      worldPoint: { x: 240, y: 140 },
      modifiers: { shift: false },
    }, origin)!
    expect(motionPathDraftIsNoop(track, still)).toBe(true)
  })

  it('顶点与切线命令能被真实 runtime 提交（payload 契约回归）', () => {
    const entity: ComposeEntity = {
      id: 'moving',
      name: 'moving',
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
        Animation: { clips: { intro: [track] } } as unknown as JsonObject,
      },
    }
    const value: ComposeDocument = {
      schemaVersion: 6,
      canvas: {
        grid: { stepX: 8, stepY: 8, offsetX: 0, offsetY: 0, primaryLineEvery: 5, snapEnabled: true },
        smartSnap: { nodes: true, guides: true },
        guides: [],
      },
      output: { width: 1920, height: 1080, backgroundPaint: { kind: 'solid', color: '#ffffff' } },
      rootIds: ['moving'],
      entities: { moving: entity },
      animations: [{ id: 'intro', name: '入场', durationMs: 400, playbackMode: 'play-once' }],
    }
    const runtime = createTransactionRuntime({
      document: value,
      handlers: createComposeAnimationCommandHandlers(),
    })
    const vertexDraft = motionPathDraftForChange(track, {
      vertexId: 'c',
      handle: 'vertex',
      worldPoint: { x: 300, y: 200 },
      modifiers: { shift: false },
    }, origin)!
    expect(runtime.dispatch(motionPathCommandForDraft(vertexDraft, commandOptions)).status)
      .toBe('committed')
    const tangentDraft = motionPathDraftForChange(track, {
      vertexId: 'b',
      handle: 'tangent-out',
      worldPoint: { x: 170, y: 90 },
      modifiers: { shift: false },
    }, origin)!
    expect(runtime.dispatch(motionPathCommandForDraft(tangentDraft, {
      ...commandOptions,
      idFactory: () => 'draft-id-2',
    })).status).toBe('committed')
    expect(runtime.dispatch(motionPathToggleCommand(track, 'a', {
      ...commandOptions,
      idFactory: () => 'draft-id-3',
    })!).status).toBe('committed')
    const after = findComposeAnimationTrack(
      runtime.document.entities.moving!,
      'intro',
      ['LayoutItem', 'offset'],
    )!
    expect(after.keyframes.find((keyframe) => keyframe.id === 'c')?.value)
      .toEqual({ x: 260, y: 140 })
    // upsert 保身份：改值没有替换关键帧 ID，也没有新增帧。
    expect(after.keyframes).toHaveLength(3)
  })

  it('OpenSpec: editor-workspace-layout / 顶点模式切换 / smooth 清零切线，corner 给默认切线', () => {
    // smooth → corner：spatial 置 null，关键帧回到隐式 corner。
    const clear = motionPathToggleCommand(track, 'b', commandOptions)!
    expect(clear).toMatchObject({
      type: 'animation.keyframe.spatial.set',
      payload: { keyframeId: 'b', spatial: null },
    })
    // corner → smooth：默认切线沿邻帧连线方向，各取到邻帧距离的 1/3。
    const toSmooth = motionPathToggleCommand(track, 'a', commandOptions)!
    const spatial = (toSmooth.payload as { spatial: { outX: number; outY: number; inX: number; inY: number; mode: string } }).spatial
    expect(spatial.mode).toBe('smooth')
    // a 只有后邻 b（距离 100）：out 沿 a→b 方向长度 100/3；in 侧无邻帧，回退用同一
    // 长度的反向切线——零长切线的手柄会压住顶点命中区，端点顶点会再也拖不动。
    expect(spatial.outX).toBeCloseTo(100 / 3)
    expect(spatial.outY).toBeCloseTo(0)
    expect(spatial.inX).toBeCloseTo(-100 / 3)
    expect(spatial.inY).toBeCloseTo(0)
  })
})
