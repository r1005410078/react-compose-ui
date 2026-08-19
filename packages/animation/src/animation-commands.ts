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
  resolveOwningFrameId,
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
  relocateTracks: 'animation.tracks.relocate',
  setSource: 'animation.source.set',
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

/**
 * 读取命令载荷中的宿主 Frame，并返回它当前的动画清单。
 *
 * @remarks
 * v7 的动画清单归属 Frame。命令必须显式指定 `frameId`——沉默地回退到"第一个根 Frame"
 * 会在多画板文档里写错清单。
 */
function resolveManifest(
  document: ComposeDocument,
  frameId: unknown,
): { readonly frameId: string; readonly items: readonly ComposeAnimation[] } | CommandHandlerResult {
  if (typeof frameId !== 'string' || frameId.trim().length === 0) {
    return reject('animation.invalid-command', '命令必须提供 frameId')
  }
  const entity = document.entities[frameId]
  if (!entity || entity.components.Frame === undefined) {
    return reject('frame.missing', `Entity ${frameId} 不是 Frame`)
  }
  return { frameId, items: getComposeAnimations(document, frameId) }
}

function isManifest(
  value: { readonly frameId: string; readonly items: readonly ComposeAnimation[] } | CommandHandlerResult,
): value is { readonly frameId: string; readonly items: readonly ComposeAnimation[] } {
  return 'items' in value
}

/**
 * 整个 `Animations` Component 以一次 set 写入。
 *
 * @remarks
 * 逐字段 set 会落空——`Animations` 可能尚不存在。整体写入就必须自己带上另一半：`items` 是
 * 清单镜像，`source` 是该 Frame 绑定的动画文件引用，只写其一就会把另一个抹掉。清单命令与
 * 绑定命令因此共用这一个写入口，两边都不需要各自记得这件事。
 */
function animationsPatch(
  frameId: string,
  items: readonly ComposeAnimation[],
  source: JsonValue | undefined,
): DocumentPatch {
  return {
    op: 'set',
    path: ['entities', frameId, 'components', 'Animations'],
    value: (source === undefined ? { items } : { items, source }) as unknown as JsonValue,
  }
}

/** 读取该 Frame 当前绑定的动画文件引用；未绑定时为 undefined。 */
function currentSource(document: ComposeDocument, frameId: string): JsonValue | undefined {
  const existing = document.entities[frameId]?.components.Animations as
    { readonly source?: JsonValue } | undefined
  return existing?.source
}

/** 写入清单，保留该 Frame 已有的动画文件引用。 */
function manifestPatch(
  document: ComposeDocument,
  frameId: string,
  items: readonly ComposeAnimation[],
): DocumentPatch {
  return animationsPatch(frameId, items, currentSource(document, frameId))
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
  readonly frameId: string
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
  const entity = document.entities[entityId]
  if (!entity) return reject('entity.missing', `Entity ${entityId} 不存在`)
  // 宿主 Frame 由 Entity 反查而不是由调用方给出：这样"轨道不得跨越嵌套 Frame 边界"
  // 在命令层就是构造性成立的，不需要额外校验分支。
  const frameId = resolveOwningFrameId(document, entityId)
  if (!frameId) return reject('frame.missing', `Entity ${entityId} 不在任何 Frame 内`)
  const animation = getComposeAnimations(document, frameId).find((item) => item.id === animationId)
  if (!animation) {
    return reject('animation.missing', `动画 ${animationId} 不在 Frame ${frameId} 的清单中`)
  }
  const path = readPath(payload)
  if (!path) return reject('track.invalid-path', '轨道路径必须是非空的字符串或下标数组')
  return { animation, frameId, entityId, entity, path }
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
      const manifest = resolveManifest(document, command.payload.frameId)
      if (!isManifest(manifest)) return manifest
      if (manifest.items.some((item) => item.id === animationId)) {
        return reject('animation.duplicate-id', `动画 ${animationId} 已存在`)
      }
      return applied([manifestPatch(document, manifest.frameId, [...manifest.items, {
        id: animationId,
        name,
        durationMs,
        playbackMode: mode,
      } as ComposeAnimation])])
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
      const manifest = resolveManifest(document, command.payload.frameId)
      if (!isManifest(manifest)) return manifest
      if (!manifest.items.some((item) => item.id === animationId)) {
        return reject('animation.missing', `动画 ${animationId} 不存在`)
      }
      const patches: DocumentPatch[] = [
        manifestPatch(document, manifest.frameId, manifest.items.filter((item) => item.id !== animationId)),
      ]
      // 清单条目与各 Entity 的分组是同一条动画的两半，必须在同一个事务里一起清掉，
      // 否则撤销一半会留下悬空分组。只清该 Frame 作用域内的 Entity——同名分组在别的
      // Frame 下是另一条动画。
      Object.entries(document.entities).forEach(([entityId, entity]) => {
        if (getComposeEntityTracks(entity, animationId).length === 0) return
        if (resolveOwningFrameId(document, entityId) !== manifest.frameId) return
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
      const manifest = resolveManifest(document, command.payload.frameId)
      if (!isManifest(manifest)) return manifest
      const current = manifest.items.find((item) => item.id === animationId)
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
      return applied([manifestPatch(
        document,
        manifest.frameId,
        manifest.items.map((item) => item.id === animationId ? next as ComposeAnimation : item),
      )])
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

/**
 * 关联/更换/解除该 Frame 的动画文件引用。
 *
 * @remarks
 * `Animations.source` 是**文档状态**，因此绑定是一次普通文档事务而不是页面文件写入：
 * 走页面文件的话，Store 校验的是上次保存的那份文档，刚画出来、尚未保存的场景会被判成
 * 「不是 Frame」而绑不上；而且绑定只进页面文件、运行时文档不知情，下次保存又会把它覆盖掉。
 *
 * `source` 为 null 表示解除。解除只清引用，不动清单也不删动画文件资源。
 */
function setSourceHandler(): CommandHandler {
  return {
    type: COMPOSE_ANIMATION_COMMAND_TYPES.setSource,
    execute(document, command) {
      const manifest = resolveManifest(document, command.payload.frameId)
      if (!isManifest(manifest)) return manifest
      const { source } = command.payload
      if (source !== null && !isAnimationSource(source)) {
        return reject(
          'animation.invalid-source',
          'source 必须是含 providerId、assetKey 与 scope 的引用，或 null',
        )
      }
      const next = source === null ? undefined : source as JsonValue
      if (jsonEqual(next ?? null, currentSource(document, manifest.frameId) ?? null)) {
        return { status: 'noop', reason: '动画文件引用未变化' }
      }
      return applied([animationsPatch(manifest.frameId, manifest.items, next)])
    },
  }
}

/** 稳定资源引用的形状判定；与 core 的页面引用一致。 */
function isAnimationSource(value: unknown): boolean {
  if (!isRecord(value)) return false
  return typeof value.providerId === 'string'
    && typeof value.assetKey === 'string'
    && (value.scope === 'persistent' || value.scope === 'session')
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
 * 把一棵子树的动画轨道从源 Frame 搬迁到目标 Frame。
 *
 * @remarks
 * 跨 Frame 拖拽必须与本命令组成单个事务，且**本命令排在结构变更之前**——源 Frame 由
 * Entity 当前的层级反查，结构一旦先动，源与目标就会是同一个 Frame 而退化成 noop。
 * 撤销时两侧 Frame 的清单与轨道一起还原。关键帧的时间、值、插值与空间切线逐字段保持，
 * 重定位只改变归属。
 *
 * 目标 Frame 已存在同名动画时**不静默合并**——调用方必须通过 `mapping` 显式给出目标分组
 * ID，否则命令拒绝。静默合并会把两条语义无关的时间线叠在一起，且无法从结果反推原状。
 */
function relocateTracksHandler(): CommandHandler {
  return {
    type: COMPOSE_ANIMATION_COMMAND_TYPES.relocateTracks,
    execute(document, command) {
      const { entityId, targetFrameId, mapping } = command.payload
      if (typeof entityId !== 'string' || typeof targetFrameId !== 'string') {
        return reject('animation.invalid-command', '命令必须提供 entityId 与 targetFrameId')
      }
      const target = resolveManifest(document, targetFrameId)
      if (!isManifest(target)) return target
      const sourceFrameId = resolveOwningFrameId(document, entityId)
      if (!sourceFrameId) return reject('frame.missing', `Entity ${entityId} 不在任何 Frame 内`)
      if (sourceFrameId === targetFrameId) {
        return { status: 'noop', reason: '源与目标是同一个 Frame' }
      }
      if (mapping !== undefined && !isRecord(mapping)) {
        return reject('animation.invalid-command', 'mapping 必须是 { [源动画ID]: 目标动画ID }')
      }
      const source = resolveManifest(document, sourceFrameId)
      if (!isManifest(source)) return source

      const subtree = collectSubtreeIds(document, entityId)
      // 先按源动画 ID 汇总要搬的轨道，再一次性决定每条动画在目标侧的落点。
      const moving = new Map<string, {
        readonly entityId: string
        readonly entity: ComposeEntity
        readonly tracks: readonly ComposeAnimationTrack[]
      }[]>()
      subtree.forEach((memberId) => {
        const member = document.entities[memberId]
        if (!member) return
        const component = getComposeAnimationComponent(member)
        if (!component) return
        Object.keys(component.clips).forEach((animationId) => {
          const tracks = getComposeEntityTracks(member, animationId)
          if (tracks.length === 0) return
          const bucket = moving.get(animationId) ?? []
          bucket.push({ entityId: memberId, entity: member, tracks })
          moving.set(animationId, bucket)
        })
      })
      if (moving.size === 0) return { status: 'noop', reason: '子树没有需要搬迁的轨道' }

      const targetIdBySourceId = new Map<string, string>()
      const created: ComposeAnimation[] = []
      for (const sourceAnimationId of moving.keys()) {
        const sourceAnimation = source.items.find((item) => item.id === sourceAnimationId)
        if (!sourceAnimation) {
          return reject('animation.missing', `源 Frame 清单中没有动画 ${sourceAnimationId}`)
        }
        const explicit = isRecord(mapping) ? mapping[sourceAnimationId] : undefined
        if (explicit !== undefined) {
          if (typeof explicit !== 'string'
            || !target.items.some((item) => item.id === explicit)) {
            return reject('animation.missing', `目标 Frame 清单中没有动画 ${String(explicit)}`)
          }
          targetIdBySourceId.set(sourceAnimationId, explicit)
          continue
        }
        const conflict = target.items.some((item) =>
          item.id === sourceAnimationId || item.name === sourceAnimation.name)
        if (conflict) {
          return reject(
            'animation.relocate-ambiguous',
            `目标 Frame 已有同名动画，请显式指定 ${sourceAnimationId} 的目标分组`,
          )
        }
        targetIdBySourceId.set(sourceAnimationId, sourceAnimationId)
        created.push(sourceAnimation)
      }

      const patches: DocumentPatch[] = []
      moving.forEach((members, sourceAnimationId) => {
        const targetAnimationId = targetIdBySourceId.get(sourceAnimationId)!
        members.forEach(({ entityId: memberId, entity, tracks }) => {
          const component = getComposeAnimationComponent(entity)!
          const nextClips: Record<string, readonly ComposeAnimationTrack[]> = { ...component.clips }
          delete nextClips[sourceAnimationId]
          nextClips[targetAnimationId] = tracks
          patches.push({
            op: 'set',
            path: ['entities', memberId, 'components', COMPOSE_ANIMATION_COMPONENT_KEY],
            value: { clips: nextClips } as unknown as JsonValue,
          })
        })
      })

      if (created.length > 0) {
        patches.push(manifestPatch(document, target.frameId, [...target.items, ...created]))
      }
      // 源清单只丢弃已经没有任何轨道留下的动画；同一条动画可能还驱动着子树之外的 Entity。
      const orphaned = new Set<string>()
      moving.forEach((_members, sourceAnimationId) => {
        const stillUsed = Object.keys(document.entities).some((candidateId) => {
          if (subtree.has(candidateId)) return false
          if (resolveOwningFrameId(document, candidateId) !== source.frameId) return false
          return getComposeEntityTracks(document.entities[candidateId]!, sourceAnimationId).length > 0
        })
        if (!stillUsed) orphaned.add(sourceAnimationId)
      })
      if (orphaned.size > 0) {
        patches.push(manifestPatch(
          document,
          source.frameId,
          source.items.filter((item) => !orphaned.has(item.id)),
        ))
      }
      return applied(patches)
    },
  }
}

/** 收集包含自身在内的整棵子树 Entity ID。 */
function collectSubtreeIds(document: ComposeDocument, rootId: string): ReadonlySet<string> {
  const ids = new Set<string>()
  const walk = (id: string) => {
    if (ids.has(id)) return
    ids.add(id)
    const hierarchy = document.entities[id]?.components.Hierarchy
    if (!hierarchy || !Array.isArray(hierarchy.childIds)) return
    hierarchy.childIds.forEach((childId) => {
      if (typeof childId === 'string') walk(childId)
    })
  }
  walk(rootId)
  return ids
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
    setSourceHandler(),
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
    relocateTracksHandler(),
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
