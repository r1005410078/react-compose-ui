import {
  type CommandHandler,
  type CommandHandlerResult,
  type ComposeAnimation,
  type ComposeDocument,
  type ComposeEntity,
  type DocumentPatch,
  type JsonObject,
  type JsonValue,
  getComposeAnimations,
  jsonEqual,
} from '@compose-ui/core'
import {
  getComposeAnimationComponent,
  getComposeEntityTracks,
  isSameComposeAnimationPath,
} from './animation-component'
import {
  COMPOSE_ANIMATION_COMPONENT_KEY,
  type ComposeAnimationTrack,
  type ComposeAnimationValueKind,
  type ComposeKeyframe,
  type ComposeKeyframeInterpolation,
  type ComposeSpatialTangent,
} from './animation-types'
import { isComposeAnimationValue } from './animation-value'

/**
 * 动画命令的稳定 type。
 *
 * @remarks
 * 这些 handler 通过 `TransactionRuntimeOptions.handlers` 或 `registerHandler` 注入运行时，
 * 不进入 core 的 `BUILTIN_COMMAND_TYPES`——动画是独立包的领域，core 不该认识它。
 *
 * @public
 */
export const COMPOSE_ANIMATION_COMMAND_TYPES = {
  create: 'animation.create',
  delete: 'animation.delete',
  configure: 'animation.configure',
  setKeyframe: 'animation.keyframe.set',
  removeKeyframe: 'animation.keyframe.remove',
  moveKeyframe: 'animation.keyframe.move',
  setInterpolation: 'animation.keyframe.interpolation.set',
  setSpatialTangent: 'animation.keyframe.spatial.set',
  removeTrack: 'animation.track.remove',
} as const

const PLAYBACK_MODES = ['play-once', 'loop', 'ping-pong']
const VALUE_KINDS = ['number', 'vector2', 'color']
const TANGENT_NUMBER_FIELDS = ['inX', 'inY', 'outX', 'outY'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function reject(code: string, message: string): CommandHandlerResult {
  return { status: 'rejected', issues: [{ code, message }] }
}

function applied(value: readonly DocumentPatch[]): CommandHandlerResult {
  return value.length === 0
    ? { status: 'noop', reason: '命令没有产生文档修改' }
    : { status: 'patches', patches: value }
}

function readPath(payload: JsonObject): readonly (string | number)[] | null {
  const path = payload.path
  if (!Array.isArray(path) || path.length === 0) return null
  return path.every((segment) => typeof segment === 'string' || isFiniteNumber(segment))
    ? path as readonly (string | number)[]
    : null
}

function readInterpolation(value: unknown): ComposeKeyframeInterpolation | null {
  if (!isRecord(value)) return null
  if (value.kind === 'hold' || value.kind === 'linear') {
    return { kind: value.kind } as ComposeKeyframeInterpolation
  }
  if (value.kind !== 'cubic') return null
  const { control } = value
  if (!Array.isArray(control) || control.length !== 4 || !control.every(isFiniteNumber)) return null
  return { kind: 'cubic', control: [control[0], control[1], control[2], control[3]] }
}

function readSpatialTangent(value: unknown): ComposeSpatialTangent | null {
  if (!isRecord(value)) return null
  if (value.mode !== 'corner' && value.mode !== 'smooth') return null
  if (!TANGENT_NUMBER_FIELDS.every((field) => isFiniteNumber(value[field]))) return null
  return {
    mode: value.mode,
    inX: value.inX as number,
    inY: value.inY as number,
    outX: value.outX as number,
    outY: value.outY as number,
  }
}

/** 定位一条命令共同需要的动画、Entity 与轨道上下文。 */
interface CommandTarget {
  readonly animation: ComposeAnimation
  readonly entityId: string
  readonly entity: ComposeEntity
  readonly path: readonly (string | number)[]
}

function resolveTarget(
  document: ComposeDocument,
  payload: JsonObject,
): CommandTarget | CommandHandlerResult {
  const animationId = payload.animationId
  const entityId = payload.entityId
  if (typeof animationId !== 'string' || typeof entityId !== 'string') {
    return reject('animation.invalid-command', '命令必须提供 animationId 与 entityId')
  }
  const animation = getComposeAnimations(document).find((item) => item.id === animationId)
  if (!animation) return reject('animation.missing', `动画 ${animationId} 不存在`)
  const entity = document.entities[entityId]
  if (!entity) return reject('entity.missing', `Entity ${entityId} 不存在`)
  const path = readPath(payload)
  if (!path) return reject('track.invalid-path', '轨道路径必须是非空的字符串或下标数组')
  return { animation, entityId, entity, path }
}

function isTarget(value: CommandTarget | CommandHandlerResult): value is CommandTarget {
  return 'animation' in value
}

/**
 * 用新的分组内容生成 Entity `Animation` Component 的 Patch。
 *
 * @remarks
 * 粒度取到整个 Component 而不是关键帧下标：关键帧数组随时会按时间重排，基于下标的
 * `insert` / `remove` 在重排后就失效了。整体 `set` 让一次编辑始终是一条自洽的 Patch，
 * 并且 core 的 `set` 在原本没有该字段时会自动反演成 `remove`，撤销时 Component 会干净消失。
 *
 * 分组清空后移除整个 Component，不留空壳。
 */
function writeClipPatches(
  entityId: string,
  entity: ComposeEntity,
  animationId: string,
  tracks: readonly ComposeAnimationTrack[],
): readonly DocumentPatch[] {
  const componentPath = ['entities', entityId, 'components', COMPOSE_ANIMATION_COMPONENT_KEY]
  const current = getComposeAnimationComponent(entity)
  const nextClips: Record<string, readonly ComposeAnimationTrack[]> = { ...current?.clips }
  if (tracks.length === 0) delete nextClips[animationId]
  else nextClips[animationId] = tracks

  if (Object.keys(nextClips).length === 0) {
    return entity.components[COMPOSE_ANIMATION_COMPONENT_KEY] === undefined
      ? []
      : [{ op: 'remove', path: componentPath }]
  }
  const nextComponent = { clips: nextClips } as unknown as JsonValue
  if (jsonEqual(entity.components[COMPOSE_ANIMATION_COMPONENT_KEY], nextComponent)) return []
  return [{ op: 'set', path: componentPath, value: nextComponent }]
}

function replaceTrack(
  tracks: readonly ComposeAnimationTrack[],
  path: readonly (string | number)[],
  next: ComposeAnimationTrack | null,
): readonly ComposeAnimationTrack[] {
  const index = tracks.findIndex((track) => isSameComposeAnimationPath(track.path, path))
  if (index < 0) return next ? [...tracks, next] : tracks
  if (!next) return [...tracks.slice(0, index), ...tracks.slice(index + 1)]
  return [...tracks.slice(0, index), next, ...tracks.slice(index + 1)]
}

function sortKeyframes(keyframes: readonly ComposeKeyframe[]) {
  return [...keyframes].sort((left, right) => left.timeMs - right.timeMs)
}

/** 找到目标关键帧并交给 `update` 生成新数组；`update` 返回 `null` 表示删除。 */
function updateKeyframe(
  track: ComposeAnimationTrack,
  keyframeId: string,
  update: (keyframe: ComposeKeyframe) => ComposeKeyframe | null,
): readonly ComposeKeyframe[] | null {
  const index = track.keyframes.findIndex((keyframe) => keyframe.id === keyframeId)
  if (index < 0) return null
  const next = update(track.keyframes[index]!)
  const rest = [...track.keyframes.slice(0, index), ...track.keyframes.slice(index + 1)]
  return next ? sortKeyframes([...rest, next]) : rest
}

function createHandler(): CommandHandler {
  return {
    type: COMPOSE_ANIMATION_COMMAND_TYPES.create,
    execute(document, command) {
      const { animationId, name, durationMs, playbackMode } = command.payload
      if (typeof animationId !== 'string' || animationId.trim().length === 0) {
        return reject('animation.invalid-command', '动画 ID 必须是非空字符串')
      }
      if (typeof name !== 'string') {
        return reject('animation.invalid-command', '动画名称必须是字符串')
      }
      if (!isFiniteNumber(durationMs) || durationMs <= 0) {
        return reject('animation.invalid-duration', '动画时长必须是有限正数毫秒')
      }
      const mode = playbackMode ?? 'play-once'
      if (typeof mode !== 'string' || !PLAYBACK_MODES.includes(mode)) {
        return reject('animation.invalid-command', `playbackMode 必须是 ${PLAYBACK_MODES.join(' / ')}`)
      }
      const animations = getComposeAnimations(document)
      if (animations.some((item) => item.id === animationId)) {
        return reject('animation.duplicate-id', `动画 ${animationId} 已存在`)
      }
      const next = [...animations, {
        id: animationId,
        name,
        durationMs,
        playbackMode: mode,
      }] as unknown as JsonValue
      return applied([{ op: 'set', path: ['animations'], value: next }])
    },
  }
}

function deleteHandler(): CommandHandler {
  return {
    type: COMPOSE_ANIMATION_COMMAND_TYPES.delete,
    execute(document, command) {
      const { animationId } = command.payload
      if (typeof animationId !== 'string') {
        return reject('animation.invalid-command', '命令必须提供 animationId')
      }
      const animations = getComposeAnimations(document)
      if (!animations.some((item) => item.id === animationId)) {
        return reject('animation.missing', `动画 ${animationId} 不存在`)
      }
      const patches: DocumentPatch[] = [{
        op: 'set',
        path: ['animations'],
        value: animations.filter((item) => item.id !== animationId) as unknown as JsonValue,
      }]
      // 清单条目与各 Entity 的分组是同一条动画的两半，必须在同一个事务里一起清掉，
      // 否则撤销一半会留下悬空分组。
      Object.entries(document.entities).forEach(([entityId, entity]) => {
        if (getComposeEntityTracks(entity, animationId).length === 0) return
        patches.push(...writeClipPatches(entityId, entity, animationId, []))
      })
      return applied(patches)
    },
  }
}

function configureHandler(): CommandHandler {
  return {
    type: COMPOSE_ANIMATION_COMMAND_TYPES.configure,
    execute(document, command) {
      const { animationId, name, durationMs, playbackMode, autoplay, bindings } = command.payload
      if (typeof animationId !== 'string') {
        return reject('animation.invalid-command', '命令必须提供 animationId')
      }
      const animations = getComposeAnimations(document)
      const current = animations.find((item) => item.id === animationId)
      if (!current) return reject('animation.missing', `动画 ${animationId} 不存在`)

      if (name !== undefined && typeof name !== 'string') {
        return reject('animation.invalid-command', '动画名称必须是字符串')
      }
      if (durationMs !== undefined && (!isFiniteNumber(durationMs) || durationMs <= 0)) {
        return reject('animation.invalid-duration', '动画时长必须是有限正数毫秒')
      }
      if (playbackMode !== undefined
        && (typeof playbackMode !== 'string' || !PLAYBACK_MODES.includes(playbackMode))) {
        return reject('animation.invalid-command', `playbackMode 必须是 ${PLAYBACK_MODES.join(' / ')}`)
      }
      if (autoplay !== undefined && autoplay !== null && typeof autoplay !== 'boolean') {
        return reject('animation.invalid-command', 'autoplay 必须是布尔值或 null')
      }
      if (bindings !== undefined && bindings !== null && !isRecord(bindings)) {
        return reject('animation.invalid-binding', 'bindings 必须是对象或 null')
      }
      const next: Record<string, JsonValue> = {
        ...current,
        ...(name !== undefined ? { name } : {}),
        ...(durationMs !== undefined ? { durationMs } : {}),
        ...(playbackMode !== undefined ? { playbackMode } : {}),
      }
      // `null` 表示清除该字段；`undefined` 表示这次命令不碰它。false 也序列化为删除，
      // 避免清单里长期留着无信息量的 `autoplay: false`。
      if (autoplay === null || autoplay === false) delete next.autoplay
      else if (autoplay === true) next.autoplay = true
      if (bindings === null) delete next.bindings
      else if (bindings !== undefined) next.bindings = bindings as JsonValue
      if (jsonEqual(current, next)) return { status: 'noop', reason: '动画参数没有变化' }
      return applied([{
        op: 'set',
        path: ['animations'],
        value: animations.map((item) => item.id === animationId ? next : item) as unknown as JsonValue,
      }])
    },
  }
}

function setKeyframeHandler(): CommandHandler {
  return {
    type: COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe,
    execute(document, command) {
      const target = resolveTarget(document, command.payload)
      if (!isTarget(target)) return target
      const { animation, entityId, entity, path } = target
      const { valueKind, timeMs, value, keyframeId, interpolation } = command.payload

      if (typeof valueKind !== 'string' || !VALUE_KINDS.includes(valueKind)) {
        return reject('track.invalid-value-kind', `valueKind 必须是 ${VALUE_KINDS.join(' / ')}`)
      }
      if (!isFiniteNumber(timeMs) || timeMs < 0 || timeMs > animation.durationMs) {
        return reject('keyframe.out-of-range', `关键帧时间必须落在 [0, ${animation.durationMs}] 内`)
      }
      if (!isComposeAnimationValue(value, valueKind as ComposeAnimationValueKind)) {
        return reject('keyframe.value-kind-mismatch', `关键帧值的形状与 valueKind ${valueKind} 不符`)
      }
      const easing = interpolation === undefined
        ? ({ kind: 'linear' } as ComposeKeyframeInterpolation)
        : readInterpolation(interpolation)
      if (!easing) {
        return reject('keyframe.invalid-interpolation', '插值必须是 hold、linear 或带四元控制点的 cubic')
      }

      const tracks = getComposeEntityTracks(entity, animation.id)
      const existing = tracks.find((track) => isSameComposeAnimationPath(track.path, path))
      if (existing && existing.valueKind !== valueKind) {
        return reject(
          'track.invalid-value-kind',
          `轨道已声明 valueKind ${existing.valueKind}，不能改为 ${valueKind}`,
        )
      }
      // 同一时间已有关键帧时替换它的值，但**保留原有身份**——换掉 id 会让时间线上的选中态
      // 与拖拽会话莫名其妙失效。
      const occupying = existing?.keyframes.find((keyframe) => keyframe.timeMs === timeMs)
      if (occupying === undefined && typeof keyframeId !== 'string') {
        return reject('animation.invalid-command', '新建关键帧必须提供 keyframeId')
      }
      const nextKeyframe: ComposeKeyframe = {
        ...(occupying ?? {}),
        id: occupying?.id ?? (keyframeId as string),
        timeMs,
        value: value as JsonValue,
        interpolation: occupying && interpolation === undefined ? occupying.interpolation : easing,
      }
      const keyframes = sortKeyframes([
        ...(existing?.keyframes ?? []).filter((keyframe) => keyframe.timeMs !== timeMs),
        nextKeyframe,
      ])
      const nextTrack: ComposeAnimationTrack = {
        path,
        valueKind: valueKind as ComposeAnimationValueKind,
        keyframes,
      }
      return applied(writeClipPatches(
        entityId,
        entity,
        animation.id,
        replaceTrack(tracks, path, nextTrack),
      ))
    },
  }
}

/** 关键帧删除、移动、插值与切线共用的定位与写回流程。 */
function keyframeMutationHandler(
  type: string,
  mutate: (
    track: ComposeAnimationTrack,
    keyframeId: string,
    payload: JsonObject,
    animation: ComposeAnimation,
  ) => readonly ComposeKeyframe[] | CommandHandlerResult | null,
): CommandHandler {
  return {
    type,
    execute(document, command) {
      const target = resolveTarget(document, command.payload)
      if (!isTarget(target)) return target
      const { animation, entityId, entity, path } = target
      const { keyframeId } = command.payload
      if (typeof keyframeId !== 'string') {
        return reject('animation.invalid-command', '命令必须提供 keyframeId')
      }
      const tracks = getComposeEntityTracks(entity, animation.id)
      const track = tracks.find((item) => isSameComposeAnimationPath(item.path, path))
      if (!track) return reject('track.missing', '轨道不存在')

      const result = mutate(track, keyframeId, command.payload, animation)
      if (result === null) return reject('keyframe.missing', `关键帧 ${keyframeId} 不存在`)
      if (!Array.isArray(result)) return result as CommandHandlerResult

      const keyframes = result as readonly ComposeKeyframe[]
      const nextTrack = keyframes.length === 0 ? null : { ...track, keyframes }
      return applied(writeClipPatches(
        entityId,
        entity,
        animation.id,
        replaceTrack(tracks, path, nextTrack),
      ))
    },
  }
}

function removeTrackHandler(): CommandHandler {
  return {
    type: COMPOSE_ANIMATION_COMMAND_TYPES.removeTrack,
    execute(document, command) {
      const target = resolveTarget(document, command.payload)
      if (!isTarget(target)) return target
      const { animation, entityId, entity, path } = target
      const tracks = getComposeEntityTracks(entity, animation.id)
      if (!tracks.some((track) => isSameComposeAnimationPath(track.path, path))) {
        return { status: 'noop', reason: '轨道不存在' }
      }
      return applied(writeClipPatches(
        entityId,
        entity,
        animation.id,
        replaceTrack(tracks, path, null),
      ))
    },
  }
}

/**
 * 创建可注入事务运行时的动画命令 handler 集合。
 *
 * @example
 * ```ts
 * const runtime = createTransactionRuntime({
 *   document,
 *   handlers: [...createBuiltinCommandHandlers(), ...createComposeAnimationCommandHandlers()],
 * })
 * ```
 *
 * @public
 */
export function createComposeAnimationCommandHandlers(): readonly CommandHandler[] {
  return [
    createHandler(),
    deleteHandler(),
    configureHandler(),
    setKeyframeHandler(),
    removeTrackHandler(),
    keyframeMutationHandler(
      COMPOSE_ANIMATION_COMMAND_TYPES.removeKeyframe,
      (track, keyframeId) => updateKeyframe(track, keyframeId, () => null),
    ),
    keyframeMutationHandler(
      COMPOSE_ANIMATION_COMMAND_TYPES.moveKeyframe,
      (track, keyframeId, payload, animation) => {
        const { timeMs } = payload
        if (!isFiniteNumber(timeMs) || timeMs < 0 || timeMs > animation.durationMs) {
          return reject('keyframe.out-of-range', `关键帧时间必须落在 [0, ${animation.durationMs}] 内`)
        }
        const occupied = track.keyframes.some(
          (keyframe) => keyframe.id !== keyframeId && keyframe.timeMs === timeMs,
        )
        if (occupied) {
          return reject('keyframe.duplicate-time', `同一轨道在 ${timeMs} ms 已有关键帧`)
        }
        return updateKeyframe(track, keyframeId, (keyframe) => ({ ...keyframe, timeMs }))
      },
    ),
    keyframeMutationHandler(
      COMPOSE_ANIMATION_COMMAND_TYPES.setInterpolation,
      (track, keyframeId, payload) => {
        const interpolation = readInterpolation(payload.interpolation)
        if (!interpolation) {
          return reject('keyframe.invalid-interpolation', '插值必须是 hold、linear 或带四元控制点的 cubic')
        }
        return updateKeyframe(track, keyframeId, (keyframe) => ({ ...keyframe, interpolation }))
      },
    ),
    keyframeMutationHandler(
      COMPOSE_ANIMATION_COMMAND_TYPES.setSpatialTangent,
      (track, keyframeId, payload) => {
        const raw = payload.spatial
        // `null` 表示清除切线；此时关键帧退回隐式 corner，不保留一个全零的 spatial 对象。
        if (raw === null) {
          return updateKeyframe(track, keyframeId, (keyframe) => {
            const rest: Record<string, JsonValue> = { ...keyframe }
            delete rest.spatial
            return rest as unknown as ComposeKeyframe
          })
        }
        const spatial = readSpatialTangent(raw)
        if (!spatial) {
          return reject(
            'keyframe.invalid-spatial',
            '空间切线必须是 { mode: corner | smooth, inX, inY, outX, outY } 或 null',
          )
        }
        return updateKeyframe(track, keyframeId, (keyframe) => ({ ...keyframe, spatial }))
      },
    ),
  ]
}
