import {
  COMPOSE_ANIMATION_COMMAND_TYPES,
  isSameComposeAnimationPath,
  sampleComposeMotionPath,
} from '@compose-ui/animation'
import type {
  ComposeAnimationTrack,
  ComposeKeyframe,
  ComposeSpatialTangent,
} from '@compose-ui/animation'
import type { EditorCommand, JsonObject, JsonValue } from '@compose-ui/core'
import type { StageEditablePath } from '@compose-ui/stage-engine'

/** 把 `LayoutItem.offset`（父坐标）平移到 Stage 世界坐标的原点，即父容器角点。 */
export interface MotionPathOrigin {
  readonly x: number
  readonly y: number
}

/** 一次路径手势在轨道上落成的草稿；`value` 与切线均为**父坐标**（offset 语义）。 */
export type MotionPathDraft =
  | {
      readonly kind: 'value'
      readonly keyframeId: string
      /** keyframe.set 按 timeMs upsert：必须携带原关键帧时间才能命中同一帧。 */
      readonly timeMs: number
      readonly value: { readonly x: number; readonly y: number }
    }
  | { readonly kind: 'spatial'; readonly keyframeId: string; readonly spatial: ComposeSpatialTangent }

const OFFSET_PATH = ['LayoutItem', 'offset'] as const

function vectorValue(keyframe: ComposeKeyframe): { x: number; y: number } | null {
  const value = keyframe.value as { x?: unknown; y?: unknown } | null
  return value && typeof value.x === 'number' && typeof value.y === 'number'
    ? { x: value.x, y: value.y }
    : null
}

/** 判断一条轨道是否是位置轨道（运动路径的数据源）。 */
export function isMotionPathTrack(track: ComposeAnimationTrack): boolean {
  return track.valueKind === 'vector2' && isSameComposeAnimationPath(track.path, OFFSET_PATH)
}

/**
 * 把位置轨道求值为 Stage 可编辑路径几何（世界坐标）。
 *
 * @remarks
 * `sampleComposeMotionPath` 输出父坐标（offset 语义）几何，这里整体平移 `origin`。
 * 不处理父级旋转：基础能力阶段路径只在平移父级下正确，旋转父级留给后续提案。
 * 顶点 ID 就是关键帧 ID——Stage 视其为不透明字符串，手势回传后可直接定位关键帧。
 */
export function buildMotionPathEditablePath(
  entityId: string,
  track: ComposeAnimationTrack,
  origin: MotionPathOrigin,
): StageEditablePath | null {
  if (!isMotionPathTrack(track) || track.keyframes.length === 0) return null
  const geometry = sampleComposeMotionPath(track)
  const shift = (point: { readonly x: number; readonly y: number }) => ({
    x: point.x + origin.x,
    y: point.y + origin.y,
  })
  return {
    entityId,
    polyline: geometry.polyline.map(shift),
    dots: geometry.dots.map(shift),
    vertices: geometry.vertices.map((vertex) => ({
      id: vertex.keyframeId,
      point: shift(vertex.point),
      inTangent: vertex.inTangent ? shift(vertex.inTangent) : null,
      outTangent: vertex.outTangent ? shift(vertex.outTangent) : null,
      mode: vertex.mode,
    })),
  }
}

/**
 * 把一次手势坐标翻译为轨道草稿。
 *
 * @remarks
 * - `vertex`：世界坐标折回父坐标写成关键帧新值。
 * - `tangent-in` / `tangent-out`：折算为相对顶点的增量切线；拖动切线隐式进入 `smooth`。
 *   Shift 约束对称：另一侧取共线等长的镜像。未按 Shift 时另一侧保持原值（无则为零）。
 *
 * @returns 该手柄在当前轨道上无法解释（关键帧不存在、值非法）时返回 `null`。
 */
export function motionPathDraftForChange(
  track: ComposeAnimationTrack,
  change: {
    readonly vertexId: string
    readonly handle: 'vertex' | 'tangent-in' | 'tangent-out'
    readonly worldPoint: { readonly x: number; readonly y: number }
    readonly modifiers: { readonly shift: boolean }
  },
  origin: MotionPathOrigin,
): MotionPathDraft | null {
  const keyframe = track.keyframes.find((item) => item.id === change.vertexId)
  if (!keyframe) return null
  const local = { x: change.worldPoint.x - origin.x, y: change.worldPoint.y - origin.y }
  if (change.handle === 'vertex') {
    return { kind: 'value', keyframeId: keyframe.id, timeMs: keyframe.timeMs, value: local }
  }
  const vertex = vectorValue(keyframe)
  if (!vertex) return null
  const relative = { x: local.x - vertex.x, y: local.y - vertex.y }
  const current = keyframe.spatial ?? { mode: 'smooth' as const, inX: 0, inY: 0, outX: 0, outY: 0 }
  const mirrored = { x: -relative.x, y: -relative.y }
  const spatial: ComposeSpatialTangent = change.handle === 'tangent-in'
    ? {
        mode: 'smooth',
        inX: relative.x,
        inY: relative.y,
        outX: change.modifiers.shift ? mirrored.x : current.outX,
        outY: change.modifiers.shift ? mirrored.y : current.outY,
      }
    : {
        mode: 'smooth',
        inX: change.modifiers.shift ? mirrored.x : current.inX,
        inY: change.modifiers.shift ? mirrored.y : current.inY,
        outX: relative.x,
        outY: relative.y,
      }
  return { kind: 'spatial', keyframeId: keyframe.id, spatial }
}

/** 把草稿套到轨道上得到预览轨道；拖动过程中据此重建完整路径几何（含折线与采样点）。 */
export function applyMotionPathDraftToTrack(
  track: ComposeAnimationTrack,
  draft: MotionPathDraft,
): ComposeAnimationTrack {
  return {
    ...track,
    keyframes: track.keyframes.map((keyframe) => {
      if (keyframe.id !== draft.keyframeId) return keyframe
      return draft.kind === 'value'
        ? { ...keyframe, value: draft.value as unknown as JsonValue }
        : { ...keyframe, spatial: draft.spatial }
    }),
  }
}

/** 草稿是否与轨道现状一致；一致时松手不派发命令，避免点击顶点也产生一条空事务。 */
export function motionPathDraftIsNoop(
  track: ComposeAnimationTrack,
  draft: MotionPathDraft,
): boolean {
  const keyframe = track.keyframes.find((item) => item.id === draft.keyframeId)
  if (!keyframe) return true
  if (draft.kind === 'value') {
    const value = vectorValue(keyframe)
    return value !== null && value.x === draft.value.x && value.y === draft.value.y
  }
  const current = keyframe.spatial
  return current !== undefined
    && current.mode === draft.spatial.mode
    && current.inX === draft.spatial.inX
    && current.inY === draft.spatial.inY
    && current.outX === draft.spatial.outX
    && current.outY === draft.spatial.outY
}

/** 把草稿翻译为可派发的命令；`mergeKey` 让一次拖拽在撤销栈里只有一条记录。 */
export function motionPathCommandForDraft(
  draft: MotionPathDraft,
  options: {
    readonly animationId: string
    readonly entityId: string
    readonly idFactory: () => string
  },
): EditorCommand {
  const base = {
    animationId: options.animationId,
    entityId: options.entityId,
    path: OFFSET_PATH as unknown as JsonValue,
    keyframeId: draft.keyframeId,
  }
  const payload: JsonObject = draft.kind === 'value'
    ? {
        ...base,
        valueKind: 'vector2',
        // keyframe.set 按 timeMs upsert；携带原关键帧时间只改值，handler 保留原身份。
        timeMs: draft.timeMs,
        value: draft.value as unknown as JsonValue,
      }
    : { ...base, spatial: draft.spatial as unknown as JsonValue }
  return {
    id: options.idFactory(),
    type: draft.kind === 'value'
      ? COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe
      : COMPOSE_ANIMATION_COMMAND_TYPES.setSpatialTangent,
    payload,
    meta: {
      source: 'animation-mode',
      targetIds: [options.entityId],
      mergeKey: `motion-path:${options.entityId}:${draft.keyframeId}:${draft.kind}`,
    },
  } as EditorCommand
}

/**
 * 双击顶点的 corner / smooth 切换命令。
 *
 * @remarks
 * smooth → corner 清零两侧切线（payload `spatial: null`，关键帧回到隐式 corner）；
 * corner → smooth 按相邻关键帧连线方向给出默认切线（各取到邻帧距离的 1/3），
 * 没有邻帧的一侧退化为零向量。
 */
export function motionPathToggleCommand(
  track: ComposeAnimationTrack,
  vertexId: string,
  options: {
    readonly animationId: string
    readonly entityId: string
    readonly idFactory: () => string
  },
): EditorCommand | null {
  const index = track.keyframes.findIndex((keyframe) => keyframe.id === vertexId)
  if (index < 0) return null
  const keyframe = track.keyframes[index]!
  const smooth = keyframe.spatial?.mode === 'smooth'
  let spatial: ComposeSpatialTangent | null = null
  if (!smooth) {
    const value = vectorValue(keyframe)
    const previous = index > 0 ? vectorValue(track.keyframes[index - 1]!) : null
    const next = index < track.keyframes.length - 1
      ? vectorValue(track.keyframes[index + 1]!)
      : null
    if (!value) return null
    const chord = previous && next
      ? { x: next.x - previous.x, y: next.y - previous.y }
      : previous
        ? { x: value.x - previous.x, y: value.y - previous.y }
        : next
          ? { x: next.x - value.x, y: next.y - value.y }
          : { x: 0, y: 0 }
    const chordLength = Math.hypot(chord.x, chord.y)
    const direction = chordLength > 0
      ? { x: chord.x / chordLength, y: chord.y / chordLength }
      : { x: 0, y: 0 }
    // 无邻帧的一侧回退用另一侧的长度：零长切线的手柄会压在顶点命中区正上方，
    // 切线优先级又高于顶点，会让端点顶点在切换 smooth 后再也拖不动。
    const rawOut = next ? Math.hypot(next.x - value.x, next.y - value.y) / 3 : null
    const rawIn = previous ? Math.hypot(value.x - previous.x, value.y - previous.y) / 3 : null
    const outLength = rawOut ?? rawIn ?? 0
    const inLength = rawIn ?? rawOut ?? 0
    spatial = {
      mode: 'smooth',
      inX: -direction.x * inLength,
      inY: -direction.y * inLength,
      outX: direction.x * outLength,
      outY: direction.y * outLength,
    }
  }
  return {
    id: options.idFactory(),
    type: COMPOSE_ANIMATION_COMMAND_TYPES.setSpatialTangent,
    payload: {
      animationId: options.animationId,
      entityId: options.entityId,
      path: OFFSET_PATH as unknown as JsonValue,
      keyframeId: vertexId,
      spatial: spatial as unknown as JsonValue,
    },
    meta: { source: 'animation-mode', targetIds: [options.entityId] },
  } as EditorCommand
}
