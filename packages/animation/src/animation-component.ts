import type { ComposeDocument, ComposeEntity } from '@compose-ui/core'
import {
  COMPOSE_ANIMATION_COMPONENT_KEY,
  type ComposeAnimationComponent,
  type ComposeAnimationTrack,
  type ComposeKeyframe,
} from './animation-types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * 读取 Entity 的 `Animation` Component；不存在或形状不合法时返回 `null`。
 *
 * @remarks
 * core 只保证 Component 是合法 JSON，不保证它符合本包的形状，所以这里做防御性判定而不是断言。
 *
 * @public
 */
export function getComposeAnimationComponent(
  entity: ComposeEntity,
): ComposeAnimationComponent | null {
  const component = entity.components[COMPOSE_ANIMATION_COMPONENT_KEY]
  if (!isRecord(component) || !isRecord(component.clips)) return null
  return component as unknown as ComposeAnimationComponent
}

/**
 * 读取 Entity 在指定动画中的轨道；没有参与该动画时返回空数组。
 *
 * @public
 */
export function getComposeEntityTracks(
  entity: ComposeEntity,
  animationId: string,
): readonly ComposeAnimationTrack[] {
  const tracks = getComposeAnimationComponent(entity)?.clips[animationId]
  return Array.isArray(tracks) ? tracks : []
}

/**
 * 判断两条属性路径是否相同。
 *
 * @public
 */
export function isSameComposeAnimationPath(
  left: readonly (string | number)[],
  right: readonly (string | number)[],
): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index])
}

/**
 * 查找 Entity 在指定动画中绑定到某个属性路径的轨道；不存在时返回 `null`。
 *
 * @public
 */
export function findComposeAnimationTrack(
  entity: ComposeEntity,
  animationId: string,
  path: readonly (string | number)[],
): ComposeAnimationTrack | null {
  return getComposeEntityTracks(entity, animationId)
    .find((track) => isSameComposeAnimationPath(track.path, path)) ?? null
}

/**
 * 查找轨道中恰好位于指定时间的关键帧；不存在时返回 `null`。
 *
 * @remarks
 * 时间以严格相等比较。调用方负责在写入前把时间量化到自己的步长上，避免出现 `199.99999`
 * 这类永远命中不了的浮点时间。
 *
 * @public
 */
export function findComposeKeyframeAt(
  track: ComposeAnimationTrack,
  timeMs: number,
): ComposeKeyframe | null {
  return track.keyframes.find((keyframe) => keyframe.timeMs === timeMs) ?? null
}

/**
 * 列出参与指定动画的 Entity ID，按文档 `entities` 的键顺序返回。
 *
 * @remarks
 * 轨道挂在各自的 Entity 上，所以"这条动画有哪些轨道"需要遍历。实体量级是几十到几百，
 * 且时间线本来就按 Entity 分组渲染，遍历比维护一份反向索引更直接也更不容易失同步。
 *
 * @public
 */
export function listComposeAnimationEntities(
  document: ComposeDocument,
  animationId: string,
): readonly string[] {
  return Object.keys(document.entities).filter((id) => {
    const entity = document.entities[id]
    return entity !== undefined && getComposeEntityTracks(entity, animationId).length > 0
  })
}
