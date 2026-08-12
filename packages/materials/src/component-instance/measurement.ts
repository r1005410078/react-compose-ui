import type { ComposeRendererMeasurementDefinition } from '@compose-ui/component-registry'
import type { ComposeResolvedComponentSnapshot } from '@compose-ui/core'
import { constrainIntrinsicSize } from '../renderer-measurement/intrinsic-size'

function readSnapshot(value: unknown): ComposeResolvedComponentSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Partial<ComposeResolvedComponentSnapshot>
  return candidate.document?.output
    && Number.isFinite(candidate.document.output.width)
    && Number.isFinite(candidate.document.output.height)
    ? candidate as ComposeResolvedComponentSnapshot
    : null
}

/** component-instance 使用离线快照 output 的同步固有尺寸。 @internal */
export const COMPONENT_INSTANCE_RENDERER_MEASUREMENT: ComposeRendererMeasurementDefinition = {
  measure({ props, width, height }) {
    const snapshot = readSnapshot(props.resolvedSnapshot)
    if (!snapshot) return null
    return constrainIntrinsicSize(snapshot.document.output, width, height)
  },
}
