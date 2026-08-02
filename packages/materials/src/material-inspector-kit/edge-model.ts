import type { ComposeEdges } from '@compose-ui/core'

/** 判断值是否为有限的四边数值。 @internal */
export function isInspectorEdgesValue(value: unknown): value is ComposeEdges {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Partial<Record<keyof ComposeEdges, unknown>>
  return (['top', 'right', 'bottom', 'left'] as const).every((edge) => (
    typeof candidate[edge] === 'number' && Number.isFinite(candidate[edge])
  ))
}
