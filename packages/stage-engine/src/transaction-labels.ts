import {
  getComposeSpatialTransform,
  type ComposeDocument,
  type ComposeEntity,
} from '@compose-ui/core'
import type { StageTransform } from './geometry'

type TransformAction = 'move' | 'resize' | 'rotate'

interface TransformUpdate {
  readonly entityId: string
  readonly transform: StageTransform
}

function formatNumber(value: number) {
  const rounded = Math.round(value * 100) / 100
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

function signedNumber(value: number) {
  const formatted = formatNumber(value)
  return value > 0 ? `+${formatted}` : formatted
}

/** 返回事务列表中紧凑、稳定的英文目标名称。 @internal */
export function describeEntityTargets(
  document: ComposeDocument,
  entityIds: readonly string[],
) {
  if (entityIds.length === 1) return document.entities[entityIds[0]!]?.name ?? 'entity'
  return `${entityIds.length} entities`
}

/** 为 Stage 变换生成带关键数值的英文事务摘要。 @internal */
export function describeTransform(
  document: ComposeDocument,
  updates: readonly TransformUpdate[],
  action: TransformAction,
) {
  const verb = action === 'move' ? 'Move' : action === 'resize' ? 'Resize' : 'Rotate'
  const target = describeEntityTargets(document, updates.map(({ entityId }) => entityId))
  const first = updates[0]
  const current = first && document.entities[first.entityId]
  const before = current && getComposeSpatialTransform(current)
  if (!first || !before) return `${verb} ${target}`

  if (updates.length > 1) {
    if (action === 'move') {
      return `${verb} ${target} · Δx ${signedNumber(first.transform.x - before.position.x)}, `
        + `Δy ${signedNumber(first.transform.y - before.position.y)}`
    }
    if (action === 'rotate') {
      return `${verb} ${target} · Δ${signedNumber(first.transform.rotation - before.rotation)}°`
    }
    return `${verb} ${target} · ${formatNumber(before.size.width)} × ${formatNumber(before.size.height)}`
      + ` → ${formatNumber(first.transform.width)} × ${formatNumber(first.transform.height)}`
  }

  if (action === 'move') {
    return `${verb} ${target} · x ${formatNumber(before.position.x)} → ${formatNumber(first.transform.x)}, `
      + `y ${formatNumber(before.position.y)} → ${formatNumber(first.transform.y)}`
  }
  if (action === 'resize') {
    return `${verb} ${target} · ${formatNumber(before.size.width)} × ${formatNumber(before.size.height)}`
      + ` → ${formatNumber(first.transform.width)} × ${formatNumber(first.transform.height)}`
  }
  return `${verb} ${target} · ${formatNumber(before.rotation)}°`
    + ` → ${formatNumber(first.transform.rotation)}°`
}

/** 为 Entity 创建记录生成尺寸和落点摘要。 @internal */
export function describeEntityCreation(entity: ComposeEntity) {
  const transform = getComposeSpatialTransform(entity)
  return `Create ${entity.name} · ${formatNumber(transform.size.width)}`
    + ` × ${formatNumber(transform.size.height)} at `
    + `(${formatNumber(transform.position.x)}, ${formatNumber(transform.position.y)})`
}
