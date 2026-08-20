import {
  BUILTIN_COMMAND_TYPES,
  evaluateComposePaintAtLocalPoint,
  getComposeAppearance,
  getComposeLock,
  getComposeRenderer,
  resolveComposeAppearance,
  type ComposeDocument,
  type ComposePaint,
  type JsonValue,
} from '@compose-ui/core'
import { applyMatrix, invertMatrix, screenToWorld, type StagePoint } from '../geometry'
import { resolvedSpatialTransform } from '../transform-preview'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import type {
  StagePaintSampling,
  StagePaintSamplePreview,
} from '../interaction-controller'
import type { StageSceneIndex } from '../scene-index'
import type {
  StageInteractionPlugin,
  StagePluginContext,
  StageSession,
} from './kernel-types'

/** 图层取色的注册 id。 @public */
export const STAGE_PAINT_SAMPLE_PLUGIN_ID = 'paint-sample'

const PAINT_SAMPLE_PRIORITY = STAGE_GESTURE_PRIORITY
  .find(({ id }) => id === STAGE_PAINT_SAMPLE_PLUGIN_ID)!.priority

/**
 * 图层取色只能读取我们能用结构化 Paint 精确解释的层。Image/SVG 的可见像素来自资源内容，
 * 自定义 Renderer 的像素也没有 headless 采样协议；把它们当作背景色会制造错误的取色结果。
 */
function hasSampleableBackgroundPaint(entity: ComposeDocument['entities'][string]): boolean {
  const renderer = getComposeRenderer(entity)
  return renderer === undefined || renderer.type === 'rectangle' || renderer.type === 'text'
}

interface SampleResult {
  readonly preview: StagePaintSamplePreview
  readonly paint?: ComposePaint
  readonly color?: string
}

/** 在世界点上采样最深、可见、未被裁剪排除的图层背景 Paint。 */
function samplePaintAt(
  document: ComposeDocument,
  index: StageSceneIndex,
  target: StagePaintSampling,
  world: StagePoint,
  alt: boolean,
): SampleResult {
  const unavailable = (sampledEntityId?: string): SampleResult => ({
    preview: { target, point: world, ...(sampledEntityId ? { sampledEntityId } : {}), status: 'unavailable' },
  })
  const sampledEntityId = index.entityAtPoint(world)
  if (!sampledEntityId) return unavailable()
  const sampled = document.entities[sampledEntityId]
  if (sampled && !hasSampleableBackgroundPaint(sampled)) return unavailable(sampledEntityId)
  const explicitPaint = sampled ? getComposeAppearance(sampled)?.backgroundPaint : undefined
  if (!sampled || !explicitPaint) return unavailable(sampledEntityId)
  const matrix = index.getWorldMatrix(sampledEntityId)
  const transform = resolvedSpatialTransform(index, sampledEntityId)
  if (!matrix || !transform) return unavailable(sampledEntityId)
  const local = applyMatrix(invertMatrix(matrix), world)
  const point = { x: local.x / transform.width, y: local.y / transform.height }
  const color = evaluateComposePaintAtLocalPoint(explicitPaint, point)
  return {
    preview: { target, point: world, sampledEntityId, color, status: 'ready' },
    // Alt 取整份结构化 Paint（渐变照搬），普通取色只取该点求值出的颜色。
    ...(target.field === 'backgroundPaint' && alt ? { paint: explicitPaint } : { color }),
  }
}

function createPaintSampleSession(
  pointerId: number,
  target: StagePaintSampling,
  initialPoint: StagePoint,
): StageSession {
  let point = initialPoint
  let alt = false

  const sample = (ctx: StagePluginContext) =>
    samplePaintAt(ctx.context.document, ctx.index, target, point, alt)

  return {
    pointerId,
    update(event, ctx) {
      if (event.type !== 'pointer.move' && event.type !== 'pointer.up') return
      point = screenToWorld(event.point, ctx.context.viewport)
      alt = event.modifiers.alt
      ctx.publish({ ...ctx.snapshot, phase: 'paint-sample', paintSample: sample(ctx).preview })
    },
    commit(ctx) {
      const result = sample(ctx)
      const entity = ctx.context.document.entities[target.entityId]
      if (result.preview.status === 'ready' && entity && !getComposeLock(entity).locked) {
        const current = resolveComposeAppearance(entity)
        const appearance = target.field === 'backgroundPaint'
          ? { ...current, backgroundPaint: result.paint ?? { kind: 'solid' as const, color: result.color! } }
          : { ...current, borderColor: result.color! }
        ctx.apply([{
          type: 'command.dispatch',
          command: {
            id: ctx.context.idFactory(),
            type: BUILTIN_COMMAND_TYPES.setAppearance,
            payload: { entityId: entity.id, appearance: appearance as unknown as JsonValue },
            meta: {
              label: `Sample ${entity.name} paint`,
              source: 'stage',
              targetIds: [entity.id],
              mergeKey: `stage:paint-sample:${entity.id}:${target.field}`,
            },
          },
        }])
      }
      // 无论是否取到颜色都要通知宿主退出临时采样模式，否则光标会一直停在取色态。
      ctx.apply([{ type: 'paint.sample.complete' }])
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    cancel(ctx) {
      // 取消不发 paint.sample.complete：宿主的采样模式由它自己的取消路径结束，
      // 与既有 reset() 的行为一致。
      ctx.publish(ctx.idleSnapshot())
      ctx.apply([{ type: 'pointer.release', pointerId }])
    },
    isCompatibleWith(next) {
      // 采样目标换了（宿主切到另一个 Entity 或另一个字段）本次会话就不再成立。
      return next.paintSampling?.entityId === target.entityId
        && next.paintSampling?.field === target.field
    },
  }
}

/**
 * 图层取色插件。
 *
 * @remarks
 * 它的接管条件是 `context.paintSampling` 存在，**与命中类型无关**——宿主启动取色后，画布上
 * 任何位置按下都是一次采样。正因为条件不看命中，它挡在其后所有按命中判定的插件之前，
 * 抽取顺序上必须先于它们落地。
 *
 * @public
 */
export function createStagePaintSamplePlugin(): StageInteractionPlugin {
  return {
    id: STAGE_PAINT_SAMPLE_PLUGIN_ID,
    priority: PAINT_SAMPLE_PRIORITY,
    claim(event, ctx: StagePluginContext) {
      const target = ctx.context.paintSampling
      if (!target) return null
      const world = screenToWorld(event.point, ctx.context.viewport)
      const result = samplePaintAt(ctx.context.document, ctx.index, target, world, event.modifiers.alt)
      ctx.publish({ ...ctx.idleSnapshot(), phase: 'paint-sample', paintSample: result.preview })
      ctx.apply([{ type: 'pointer.capture', pointerId: event.pointerId }])
      return createPaintSampleSession(event.pointerId, target, world)
    },
  }
}
