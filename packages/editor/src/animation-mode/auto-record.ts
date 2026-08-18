import {
  COMPOSE_ANIMATION_COMMAND_TYPES,
  applyComposeAnimationAtTime,
} from '@compose-ui/animation'
import type { ComposeAnimationValueKind } from '@compose-ui/animation'
import {
  BUILTIN_COMMAND_TYPES,
  findComposeAnimation,
  getComposeAppearance,
  getComposeLayoutItem,
  getComposeSpatialTransform,
  jsonEqual,
} from '@compose-ui/core'
import type {
  ComposeDocument,
  ComposeEntity,
  ComposeLayoutItem,
  EditorCommand,
  JsonValue,
} from '@compose-ui/core'
import { isAnimationPathAvailable } from './animation-key-state'

/** 自动记录改写层的会话输入。 */
export interface AutoRecordRewriteContext {
  /** 提供动画清单的 Frame。 */
  readonly frameId: string
  readonly animationId: string
  readonly playheadMs: number
  /** 新关键帧与改写命令的 ID factory。 */
  readonly idFactory: () => string
}

/** 一条待写入的关键帧草稿；一次用户操作可能展开为多条（如 resize 的宽与高）。 */
interface KeyframeDraft {
  readonly entityId: string
  readonly path: readonly string[]
  readonly valueKind: ComposeAnimationValueKind
  readonly value: JsonValue
}

const OFFSET_PATH = ['LayoutItem', 'offset'] as const
const WIDTH_PATH = ['LayoutItem', 'width', 'value'] as const
const HEIGHT_PATH = ['LayoutItem', 'height', 'value'] as const
const ROTATION_PATH = ['Transform', 'rotation'] as const
const OPACITY_PATH = ['Appearance', 'opacity'] as const
const COLOR_PATH = ['Appearance', 'backgroundPaint', 'color'] as const

/** 收集结果：`null` 表示命令含不可改写的变更，必须整条放行。 */
type DraftCollection = readonly KeyframeDraft[] | null

function collectTransformDrafts(
  base: ComposeDocument,
  baseline: ComposeDocument,
  command: EditorCommand,
): DraftCollection {
  const payload = command.payload as {
    readonly updates?: readonly {
      readonly entityId?: unknown
      readonly transform?: {
        readonly position?: { readonly x?: unknown; readonly y?: unknown }
        readonly size?: { readonly width?: unknown; readonly height?: unknown }
        readonly rotation?: unknown
      }
    }[]
  }
  if (!Array.isArray(payload.updates)) return null
  const drafts: KeyframeDraft[] = []
  for (const update of payload.updates) {
    if (typeof update.entityId !== 'string' || !update.transform) return null
    const entity = baseline.entities[update.entityId]
    if (!entity) return null
    const current = getComposeSpatialTransform(entity)
    const next = update.transform
    const position = next.position
    if (
      typeof position?.x !== 'number' || typeof position.y !== 'number'
      || typeof next.size?.width !== 'number' || typeof next.size.height !== 'number'
      || typeof next.rotation !== 'number'
    ) return null
    if (position.x !== current.position.x || position.y !== current.position.y) {
      if (!isAnimationPathAvailable(base, update.entityId, OFFSET_PATH)) return null
      drafts.push({
        entityId: update.entityId,
        path: OFFSET_PATH,
        valueKind: 'vector2',
        value: { x: position.x, y: position.y },
      })
    }
    if (next.size.width !== current.size.width) {
      if (!isAnimationPathAvailable(base, update.entityId, WIDTH_PATH)) return null
      drafts.push({
        entityId: update.entityId,
        path: WIDTH_PATH,
        valueKind: 'number',
        value: next.size.width,
      })
    }
    if (next.size.height !== current.size.height) {
      if (!isAnimationPathAvailable(base, update.entityId, HEIGHT_PATH)) return null
      drafts.push({
        entityId: update.entityId,
        path: HEIGHT_PATH,
        valueKind: 'number',
        value: next.size.height,
      })
    }
    if (next.rotation !== current.rotation) {
      drafts.push({
        entityId: update.entityId,
        path: ROTATION_PATH,
        valueKind: 'number',
        value: next.rotation,
      })
    }
  }
  return drafts
}

function collectLayoutItemDrafts(
  base: ComposeDocument,
  entityId: string,
  entity: ComposeEntity,
  next: ComposeLayoutItem,
): DraftCollection {
  const current = getComposeLayoutItem(entity)
  const drafts: KeyframeDraft[] = []
  // 白名单外的字段（positioning、mode、min/max、margin、alignSelf）变化即整条放行：
  // 它们是结构配置，不是可插值的通道。
  if (
    current.positioning !== next.positioning
    || current.alignSelf !== next.alignSelf
    || !jsonEqual(current.margin as unknown as JsonValue, next.margin as unknown as JsonValue)
    || current.width.mode !== next.width.mode
    || current.height.mode !== next.height.mode
    || current.width.min !== next.width.min || current.width.max !== next.width.max
    || current.height.min !== next.height.min || current.height.max !== next.height.max
  ) return null
  if (current.offset.x !== next.offset.x || current.offset.y !== next.offset.y) {
    if (!isAnimationPathAvailable(base, entityId, OFFSET_PATH)) return null
    drafts.push({
      entityId,
      path: OFFSET_PATH,
      valueKind: 'vector2',
      value: { x: next.offset.x, y: next.offset.y },
    })
  }
  if (current.width.value !== next.width.value) {
    if (!isAnimationPathAvailable(base, entityId, WIDTH_PATH)) return null
    drafts.push({ entityId, path: WIDTH_PATH, valueKind: 'number', value: next.width.value })
  }
  if (current.height.value !== next.height.value) {
    if (!isAnimationPathAvailable(base, entityId, HEIGHT_PATH)) return null
    drafts.push({ entityId, path: HEIGHT_PATH, valueKind: 'number', value: next.height.value })
  }
  return drafts
}

function collectAppearanceDrafts(
  entityId: string,
  entity: ComposeEntity,
  next: Record<string, unknown>,
): DraftCollection {
  const current = getComposeAppearance(entity)
  if (!current) return null
  const drafts: KeyframeDraft[] = []
  const currentRecord = current as unknown as Record<string, unknown>
  for (const key of new Set([...Object.keys(currentRecord), ...Object.keys(next)])) {
    if (key === 'opacity' || key === 'backgroundPaint') continue
    if (!jsonEqual(currentRecord[key] as JsonValue ?? null, next[key] as JsonValue ?? null)) {
      return null
    }
  }
  const currentOpacity = current.opacity ?? 1
  const nextOpacity = typeof next.opacity === 'number' ? next.opacity : currentOpacity
  if (nextOpacity !== currentOpacity) {
    drafts.push({ entityId, path: OPACITY_PATH, valueKind: 'number', value: nextOpacity })
  }
  const currentPaint = current.backgroundPaint as unknown as Record<string, unknown> | undefined
  const nextPaint = next.backgroundPaint as Record<string, unknown> | undefined
  if (!jsonEqual(currentPaint as JsonValue ?? null, nextPaint as JsonValue ?? null)) {
    // 只有"纯色 → 纯色且仅颜色不同"可以进关键帧；kind 切换或渐变字段变化是结构变更。
    if (
      currentPaint?.kind !== 'solid' || nextPaint?.kind !== 'solid'
      || typeof nextPaint.color !== 'string'
      || !jsonEqual(
        { ...currentPaint, color: null } as JsonValue,
        { ...nextPaint, color: null } as JsonValue,
      )
    ) return null
    drafts.push({ entityId, path: COLOR_PATH, valueKind: 'color', value: nextPaint.color })
  }
  return drafts
}

/**
 * 自动记录：把画布与属性面板的属性编辑命令改写为播放头处的关键帧命令。
 *
 * @remarks
 * `entity.transform.set` 的 `updates[].transform` 是绝对值（见 design.md 任务 5.1 结论），
 * 改写只需判断哪些通道变了，不需要折算增量。变化基线按命令来源取：画布手势
 * （operation `move`/`resize`/`rotate`）与**采样文档**比——用户拖动的是播放头时刻的姿态；
 * Inspector 命令（operation `set`、`entity.component.update`、`entity.appearance.set`）与
 * **基础文档**比——Inspector 显示的是基础值。
 *
 * 任一变化通道不可动画时返回 `null` 整条放行，不做部分改写：半改写会把一次用户操作拆成
 * "一半进关键帧、一半进静态值"的不可理解状态。
 *
 * @returns 替代原命令派发的关键帧命令；`null` 表示不拦截，原命令照常派发。
 */
export function rewriteAutoRecordCommand(
  document: ComposeDocument,
  context: AutoRecordRewriteContext,
  command: EditorCommand,
): readonly EditorCommand[] | null {
  const animation = findComposeAnimation(document, context.frameId, context.animationId)
  if (!animation) return null
  const timeMs = Math.min(Math.max(context.playheadMs, 0), animation.durationMs)

  let drafts: DraftCollection = null
  if (command.type === BUILTIN_COMMAND_TYPES.setTransform) {
    const operation = (command.payload as { readonly operation?: unknown }).operation
    if (!['move', 'resize', 'rotate', 'set'].includes(operation as string)) return null
    const baseline = operation === 'set'
      ? document
      : applyComposeAnimationAtTime(document, context.animationId, timeMs)
    drafts = collectTransformDrafts(document, baseline, command)
  }
  else if (command.type === BUILTIN_COMMAND_TYPES.updateComponent) {
    const payload = command.payload as {
      readonly entityId?: unknown
      readonly key?: unknown
      readonly value?: unknown
    }
    if (payload.key !== 'LayoutItem' || typeof payload.entityId !== 'string') return null
    const entity = document.entities[payload.entityId]
    if (!entity || !payload.value || typeof payload.value !== 'object') return null
    drafts = collectLayoutItemDrafts(
      document,
      payload.entityId,
      entity,
      payload.value as ComposeLayoutItem,
    )
  }
  else if (command.type === BUILTIN_COMMAND_TYPES.setAppearance) {
    const payload = command.payload as {
      readonly entityId?: unknown
      readonly appearance?: unknown
    }
    if (
      typeof payload.entityId !== 'string'
      || !payload.appearance || typeof payload.appearance !== 'object'
    ) return null
    const entity = document.entities[payload.entityId]
    if (!entity) return null
    drafts = collectAppearanceDrafts(
      payload.entityId,
      entity,
      payload.appearance as Record<string, unknown>,
    )
  }

  if (!drafts || drafts.length === 0) return null
  // 一条用户命令展开为多条关键帧命令时必须合并成一次可撤销事务；合成 mergeKey 只对
  // 这一批唯一（带原命令 id），不会把相邻的独立用户编辑误合并。拖拽流保留原 mergeKey，
  // 让连续拖动继续折叠成一次撤销。
  const mergeKey = command.meta?.mergeKey
    ?? (drafts.length > 1 ? `auto-record:${command.id}` : undefined)
  return drafts.map((draft) => ({
    id: context.idFactory(),
    type: COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe,
    payload: {
      animationId: context.animationId,
      entityId: draft.entityId,
      path: draft.path as unknown as JsonValue,
      valueKind: draft.valueKind,
      keyframeId: context.idFactory(),
      timeMs,
      value: draft.value,
    },
    meta: {
      ...(command.meta?.label !== undefined ? { label: command.meta.label } : {}),
      ...(mergeKey !== undefined ? { mergeKey } : {}),
      source: 'animation-mode',
      targetIds: [draft.entityId],
    },
  }))
}
