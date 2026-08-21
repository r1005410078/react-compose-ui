import { getComposeSpatialTransform } from '@compose-ui/core'
import type { ComposeEntitySeed } from '@compose-ui/component-registry'
import type { ComposeAssetReference } from '@compose-ui/assets'
import type { StageInteractionTool, StagePoint } from '@compose-ui/stage-engine'

export interface ResolvedAssetSeed {
  readonly seed: ComposeEntitySeed
  readonly reference: ComposeAssetReference
}

/**
 * 有并发上限的并行映射。
 *
 * @remarks
 * 一次拖入几十个资源时，无上限的 `Promise.all` 会同时发起同样多的请求；Provider 与浏览器
 * 连接池都扛不住，反而更慢。上限保持结果顺序与输入一致。
 *
 * @public
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<readonly R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index]!, index)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  )
  return results
}

export function assetSeedCenters(
  seeds: readonly ResolvedAssetSeed[],
  gap = 24,
): readonly StagePoint[] {
  const rows: ResolvedAssetSeed[][] = []
  for (let index = 0; index < seeds.length; index += 4) {
    rows.push(seeds.slice(index, index + 4))
  }
  const points: StagePoint[] = []
  let rowCenterY = 0
  let previousRowHeight = 0
  rows.forEach((row, rowIndex) => {
    const rowHeight = Math.max(...row.map(({ seed }) =>
      getComposeSpatialTransform({ id: '__seed__', ...seed }).size.height))
    if (rowIndex > 0) {
      rowCenterY += previousRowHeight / 2 + gap + rowHeight / 2
    }
    let centerX = 0
    let previousWidth = 0
    row.forEach(({ seed }, columnIndex) => {
      if (columnIndex > 0) {
        centerX += previousWidth / 2
          + gap
          + getComposeSpatialTransform({ id: '__seed__', ...seed }).size.width / 2
      }
      points.push({ x: centerX, y: rowCenterY })
      previousWidth = getComposeSpatialTransform({ id: '__seed__', ...seed }).size.width
    })
    previousRowHeight = rowHeight
  })
  return points
}

export function presetForDrawingTool(tool: Extract<StageInteractionTool, `draw-${string}`>) {
  const presets = {
    'draw-container': 'container',
    'draw-rectangle': 'rectangle',
    'draw-line': 'line',
    'draw-arrow': 'arrow',
    'draw-circle': 'circle',
    'draw-text': 'text',
  } as const
  return presets[tool]
}
