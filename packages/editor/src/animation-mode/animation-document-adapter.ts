import {
  COMPOSE_ANIMATION_COMMAND_TYPES,
  applyComposeAnimationAtTime,
  findComposeAnimationTrack,
  getComposeEntityTracks,
  listComposeAnimationEntities,
} from '@compose-ui/animation'
import type { ComposeAnimationTrack } from '@compose-ui/animation'
import { findComposeAnimation } from '@compose-ui/core'
import type { ComposeDocument, ComposeEntity, JsonObject, JsonValue } from '@compose-ui/core'
import type {
  ComposeAnimationKeyframeValue,
  ComposeAnimationPanelAction,
  ComposeAnimationPanelModel,
  ComposeAnimationPropertyTrack,
} from '@compose-ui/animation-panel'

/** 文档中一条属性轨道的定位。 */
export interface AnimationTrackRef {
  readonly entityId: string
  readonly path: readonly (string | number)[]
}

/** 文档中一个关键帧的定位。 */
export interface AnimationKeyframeRef extends AnimationTrackRef {
  readonly keyframeId: string
}

/**
 * 把轨道定位编码为面板行 ID。
 *
 * @remarks
 * 用 JSON 数组而不是分隔符拼接：Entity ID 由宿主生成，任何手选分隔符都可能撞进去；
 * JSON 编码对任意字符串段都无歧义，代价只是 ID 不好看——它不面向用户。
 */
export function encodeAnimationPropertyId(ref: AnimationTrackRef): string {
  return JSON.stringify([ref.entityId, ref.path])
}

/** 解码面板行 ID；不是本 adapter 编出来的 ID 时返回 `null`。 */
export function decodeAnimationPropertyId(propertyId: string): AnimationTrackRef | null {
  try {
    const parsed: unknown = JSON.parse(propertyId)
    if (!Array.isArray(parsed) || parsed.length !== 2) return null
    const [entityId, path] = parsed as [unknown, unknown]
    if (typeof entityId !== 'string' || !Array.isArray(path) || path.length === 0) return null
    return { entityId, path: path as readonly (string | number)[] }
  }
  catch {
    return null
  }
}

/** 把关键帧定位编码为面板关键帧 ID。 */
export function encodeAnimationKeyframeId(ref: AnimationKeyframeRef): string {
  return JSON.stringify([ref.entityId, ref.path, ref.keyframeId])
}

/** 解码面板关键帧 ID；不是本 adapter 编出来的 ID 时返回 `null`。 */
export function decodeAnimationKeyframeId(panelKeyframeId: string): AnimationKeyframeRef | null {
  try {
    const parsed: unknown = JSON.parse(panelKeyframeId)
    if (!Array.isArray(parsed) || parsed.length !== 3) return null
    const [entityId, path, keyframeId] = parsed as [unknown, unknown, unknown]
    if (typeof entityId !== 'string' || typeof keyframeId !== 'string'
      || !Array.isArray(path) || path.length === 0) return null
    return { entityId, path: path as readonly (string | number)[], keyframeId }
  }
  catch {
    return null
  }
}

/** 由宿主提供的轨道展示名解析端口；返回 `null` 时用路径拼一个兜底名。 */
export type AnimationPropertyLabelPort = (
  path: readonly (string | number)[],
) => { readonly label: string; readonly groupLabel?: string } | null

function fallbackLabel(path: readonly (string | number)[]) {
  return path.map(String).join('.')
}

function toPanelProperty(
  entityId: string,
  track: ComposeAnimationTrack,
  propertyLabel: AnimationPropertyLabelPort | undefined,
): ComposeAnimationPropertyTrack {
  const named = propertyLabel?.(track.path) ?? null
  return {
    id: encodeAnimationPropertyId({ entityId, path: track.path }),
    label: named?.label ?? fallbackLabel(track.path),
    ...(named?.groupLabel !== undefined ? { groupLabel: named.groupLabel } : {}),
    valueKind: track.valueKind,
    keyframes: track.keyframes.map((keyframe) => ({
      id: encodeAnimationKeyframeId({ entityId, path: track.path, keyframeId: keyframe.id }),
      timeMs: keyframe.timeMs,
      // 文档与面板的值/插值形状同构（形状对齐是 add-animation-mode-binding 的前提），
      // 这里只是把 JsonValue 收窄到面板联合。
      value: keyframe.value as ComposeAnimationKeyframeValue,
      interpolation: keyframe.interpolation,
    })),
  }
}

/**
 * 把文档动画映射为面板轨道模型。
 *
 * @remarks
 * 对象轨道 = 参与动画的 Entity（label 取 `entity.name`），属性轨道 = 该 Entity 在
 * `Animation` Component 中的轨道。动画不存在时返回空模型——时间线据此显示空状态。
 * 片段不显式给出：面板缺省为每条对象轨道生成覆盖全时长的片段。
 */
export function buildAnimationPanelModel(
  document: ComposeDocument,
  frameId: string,
  animationId: string,
  options?: { readonly propertyLabel?: AnimationPropertyLabelPort },
): ComposeAnimationPanelModel {
  const animation = findComposeAnimation(document, frameId, animationId)
  if (!animation) return { durationMs: 300, tracks: [] }
  return {
    durationMs: animation.durationMs,
    tracks: listComposeAnimationEntities(document, animationId).map((entityId) => {
      const entity = document.entities[entityId]!
      return {
        id: entityId,
        label: entity.name,
        expanded: true,
        properties: getComposeEntityTracks(entity, animationId)
          .map((track) => toPanelProperty(entityId, track, options?.propertyLabel)),
      }
    }),
  }
}

/** 待派发的命令内容；`id` 由调用方的 idFactory 生成。 */
export interface AnimationCommandDraft {
  readonly type: string
  readonly payload: JsonObject
  /** 同一次用户操作展开成多条命令时的合并键，让它们合成一次可撤销事务。 */
  readonly mergeKey?: string
}

/** 读取 Entity 上某条 Component 属性路径的当前值；路径不存在时返回 `undefined`。 */
function readEntityValueAtPath(
  entity: ComposeEntity,
  path: readonly (string | number)[],
): JsonValue | undefined {
  const [componentKey, ...rest] = path
  if (typeof componentKey !== 'string') return undefined
  let cursor: unknown = (entity.components as Record<string, unknown>)[componentKey]
  for (const segment of rest) {
    if (cursor === null || typeof cursor !== 'object') return undefined
    cursor = (cursor as Record<string | number, unknown>)[segment]
  }
  return cursor as JsonValue | undefined
}

function locateDocumentTrack(
  document: ComposeDocument,
  animationId: string,
  ref: AnimationTrackRef,
): ComposeAnimationTrack | null {
  const entity = document.entities[ref.entityId]
  if (!entity) return null
  return findComposeAnimationTrack(entity, animationId, ref.path)
}

/**
 * 把面板语义动作翻译为动画命令。
 *
 * @remarks
 * 返回空数组表示该动作是会话性的（播放头、选择、自动记录），不产生文档命令——
 * 这条界线就是"播放不产生事务"的实现位置。一个动作可能展开成多条命令，它们共享
 * `mergeKey` 以便合成一次可撤销事务。翻译需要读文档（如按值修改找回原关键帧时间），
 * 传入的必须是**基础文档**，不是采样文档。
 */
export function translateAnimationPanelAction(
  document: ComposeDocument,
  animationId: string,
  action: ComposeAnimationPanelAction,
): readonly AnimationCommandDraft[] {
  switch (action.kind) {
    case 'set-current-time':
    case 'select':
    case 'toggle-auto-record':
      return []
    case 'set-duration':
      return [{
        type: COMPOSE_ANIMATION_COMMAND_TYPES.configure,
        payload: { animationId, durationMs: action.durationMs },
      }]
    case 'set-playback-mode':
      return [{
        type: COMPOSE_ANIMATION_COMMAND_TYPES.configure,
        payload: { animationId, playbackMode: action.mode },
      }]
    case 'add-keyframe': {
      const ref = decodeAnimationPropertyId(action.propertyId)
      if (!ref) return []
      const track = locateDocumentTrack(document, animationId, ref)
      if (!track) return []
      return [{
        type: COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe,
        payload: {
          animationId,
          entityId: ref.entityId,
          path: ref.path as JsonValue,
          valueKind: track.valueKind,
          // 面板为新帧生成的编码 ID 不落进文档；文档关键帧用独立后缀保持短且稳定。
          keyframeId: `kf-${action.timeMs}-${Date.now().toString(36)}`,
          timeMs: action.timeMs,
          value: action.value as JsonValue,
        },
      }]
    }
    case 'move-keyframe': {
      const ref = decodeAnimationKeyframeId(action.keyframeId)
      if (!ref) return []
      return [{
        type: COMPOSE_ANIMATION_COMMAND_TYPES.moveKeyframe,
        payload: {
          animationId,
          entityId: ref.entityId,
          path: ref.path as JsonValue,
          keyframeId: ref.keyframeId,
          timeMs: action.timeMs,
        },
      }]
    }
    case 'remove-keyframe': {
      const ref = decodeAnimationKeyframeId(action.keyframeId)
      if (!ref) return []
      return [{
        type: COMPOSE_ANIMATION_COMMAND_TYPES.removeKeyframe,
        payload: {
          animationId,
          entityId: ref.entityId,
          path: ref.path as JsonValue,
          keyframeId: ref.keyframeId,
        },
      }]
    }
    case 'set-keyframe-value': {
      const ref = decodeAnimationKeyframeId(action.keyframeId)
      if (!ref) return []
      const track = locateDocumentTrack(document, animationId, ref)
      const keyframe = track?.keyframes.find((item) => item.id === ref.keyframeId)
      if (!track || !keyframe) return []
      // upsert 命中已有时间时替换值并保留身份，正好表达"改值"。
      return [{
        type: COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe,
        payload: {
          animationId,
          entityId: ref.entityId,
          path: ref.path as JsonValue,
          valueKind: track.valueKind,
          keyframeId: ref.keyframeId,
          timeMs: keyframe.timeMs,
          value: action.value as JsonValue,
        },
      }]
    }
    case 'set-interpolation': {
      const ref = decodeAnimationKeyframeId(action.keyframeId)
      if (!ref) return []
      return [{
        type: COMPOSE_ANIMATION_COMMAND_TYPES.setInterpolation,
        payload: {
          animationId,
          entityId: ref.entityId,
          path: ref.path as JsonValue,
          keyframeId: ref.keyframeId,
          interpolation: action.interpolation as unknown as JsonValue,
        },
      }]
    }
    case 'remove-track': {
      const ref = decodeAnimationPropertyId(action.propertyId)
      if (!ref) return []
      return [{
        type: COMPOSE_ANIMATION_COMMAND_TYPES.removeTrack,
        payload: { animationId, entityId: ref.entityId, path: ref.path as JsonValue },
      }]
    }
    case 'remove-track-group': {
      // 对象行的 ID 就是 Entity ID（见 buildAnimationPanelModel）。
      const entity = document.entities[action.trackId]
      if (!entity) return []
      // 共享 mergeKey：N 条 removeTrack 合成一次事务，撤销一步整体恢复。
      const mergeKey = `animation-remove-tracks:${animationId}:${action.trackId}`
      return getComposeEntityTracks(entity, animationId).map((track) => ({
        type: COMPOSE_ANIMATION_COMMAND_TYPES.removeTrack,
        payload: { animationId, entityId: action.trackId, path: track.path as JsonValue },
        mergeKey,
      }))
    }
    case 'add-keyframe-at-time': {
      const ref = decodeAnimationPropertyId(action.propertyId)
      if (!ref) return []
      const track = locateDocumentTrack(document, animationId, ref)
      if (!track) return []
      // 值取该时刻的采样值：与画面所见一致，因而在已有关键帧的轨道上等于"钉住当前姿态"。
      const sampled = applyComposeAnimationAtTime(document, animationId, action.timeMs)
      const entity = sampled.entities[ref.entityId]
      const value = entity ? readEntityValueAtPath(entity, ref.path) : undefined
      if (value === undefined) return []
      return [{
        type: COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe,
        payload: {
          animationId,
          entityId: ref.entityId,
          path: ref.path as JsonValue,
          valueKind: track.valueKind,
          keyframeId: `kf-${action.timeMs}-${Date.now().toString(36)}`,
          timeMs: action.timeMs,
          value,
        },
      }]
    }
  }
}
