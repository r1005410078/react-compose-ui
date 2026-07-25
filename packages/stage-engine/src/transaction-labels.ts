import type {
  ComposeDocument,
  ComposeNode,
  NodeTransform,
} from '@compose-ui/core'

type TransformAction = 'move' | 'resize' | 'rotate'

interface TransformUpdate {
  readonly nodeId: string
  readonly transform: NodeTransform
}

function formatNumber(value: number) {
  const rounded = Math.round(value * 100) / 100
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

function signedNumber(value: number) {
  const formatted = formatNumber(value)
  return value > 0 ? `+${formatted}` : formatted
}

/**
 * 返回事务列表中紧凑、稳定的英文目标名称。
 *
 * @internal
 */
export function describeNodeTargets(
  document: ComposeDocument,
  nodeIds: readonly string[],
) {
  if (nodeIds.length === 1) return document.nodes[nodeIds[0]!]?.name ?? 'node'
  return `${nodeIds.length} nodes`
}

/**
 * 为 Stage 变换生成带关键数值的英文事务摘要。
 *
 * @remarks
 * 单节点显示 before/after；多节点显示统一变换的 delta，避免 History 行被每个目标的数据撑满。
 *
 * @internal
 */
export function describeTransform(
  document: ComposeDocument,
  updates: readonly TransformUpdate[],
  action: TransformAction,
) {
  const verb = action === 'move' ? 'Move' : action === 'resize' ? 'Resize' : 'Rotate'
  const target = describeNodeTargets(document, updates.map(({ nodeId }) => nodeId))
  const first = updates[0]
  const before = first ? document.nodes[first.nodeId]?.transform : undefined
  if (!first || !before) return `${verb} ${target}`

  if (updates.length > 1) {
    if (action === 'move') {
      return `${verb} ${target} · Δx ${signedNumber(first.transform.x - before.x)}, `
        + `Δy ${signedNumber(first.transform.y - before.y)}`
    }
    if (action === 'rotate') {
      return `${verb} ${target} · Δ${signedNumber(first.transform.rotation - before.rotation)}°`
    }
    return `${verb} ${target} · ${formatNumber(before.width)} × ${formatNumber(before.height)}`
      + ` → ${formatNumber(first.transform.width)} × ${formatNumber(first.transform.height)}`
  }

  if (action === 'move') {
    return `${verb} ${target} · x ${formatNumber(before.x)} → ${formatNumber(first.transform.x)}, `
      + `y ${formatNumber(before.y)} → ${formatNumber(first.transform.y)}`
  }
  if (action === 'resize') {
    return `${verb} ${target} · ${formatNumber(before.width)} × ${formatNumber(before.height)}`
      + ` → ${formatNumber(first.transform.width)} × ${formatNumber(first.transform.height)}`
  }
  return `${verb} ${target} · ${formatNumber(before.rotation)}°`
    + ` → ${formatNumber(first.transform.rotation)}°`
}

/**
 * 为节点创建记录生成尺寸和落点摘要。
 *
 * @internal
 */
export function describeNodeCreation(node: ComposeNode) {
  const { x, y, width, height } = node.transform
  return `Create ${node.name} · ${formatNumber(width)} × ${formatNumber(height)}`
    + ` at (${formatNumber(x)}, ${formatNumber(y)})`
}
