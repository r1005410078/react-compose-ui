import type { ComposeRendererMeasurementDefinition } from '@compose-ui/component-registry'
import {
  getComposeLayoutItem,
  parseComposeInstanceOverrides,
  resolveComposeInstanceOverrides,
  type ComposeDocument,
  type ComposeResolvedComponentSnapshot,
  COMPOSE_DEFAULT_FRAME_SIZE,
  getComposeFrame,
} from '@compose-ui/core'
import { constrainIntrinsicSize } from '../renderer-measurement/intrinsic-size'

function readSnapshot(value: unknown): ComposeResolvedComponentSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Partial<ComposeResolvedComponentSnapshot>
  // v7 的组件根是 Frame，尺寸事实来源是它的 Frame.size。
  const rootId = candidate.document?.rootIds[0]
  const frame = rootId ? getComposeFrame(candidate.document?.entities[rootId]) : null
  return frame
    && Number.isFinite(frame.size.width)
    && Number.isFinite(frame.size.height)
    ? candidate as ComposeResolvedComponentSnapshot
    : null
}

/**
 * 解析实例当前可见文档：快照 + 本层覆盖。
 *
 * @remarks
 * Hug 测量必须读「覆盖后的组件根尺寸」，不能只用 `output`——否则 Stage Resize
 * 已写入根覆盖后外框仍被测回原始 output，表现为手柄拖不动。
 */
function resolveInstanceDocument(props: Readonly<Record<string, unknown>>): ComposeDocument | null {
  const snapshot = readSnapshot(props.resolvedSnapshot)
  if (!snapshot) return null
  const parsed = parseComposeInstanceOverrides(props.instanceOverrides)
  if (!parsed.ok || parsed.overrides.operations.length === 0) {
    return snapshot.document
  }
  const resolved = resolveComposeInstanceOverrides({
    document: snapshot.document,
    overrides: parsed.overrides,
  })
  return resolved.ok ? resolved.document : snapshot.document
}

/**
 * 取组件根尺寸。
 *
 * @remarks
 * 覆盖可能改写根的 Frame.size 或 LayoutItem，因此按 Frame.size 优先、LayoutItem 兜底读取。
 *
 * @internal
 */
function measureRootSize(document: ComposeDocument): { width: number; height: number } {
  const rootId = document.rootIds[0]
  const root = rootId ? document.entities[rootId] : undefined
  if (!root) return { width: COMPOSE_DEFAULT_FRAME_SIZE.width, height: COMPOSE_DEFAULT_FRAME_SIZE.height }
  // 实例覆盖改写的是根的 LayoutItem；fixed 值在场时它就是"覆盖后的根尺寸"，
  // 只有非 fixed（Hug/Fill）才回落到 Frame.size 这个事实来源。
  const item = getComposeLayoutItem(root)
  const frame = getComposeFrame(root)
  if (frame) {
    return {
      width: item.width.mode === 'fixed' ? item.width.value : frame.size.width,
      height: item.height.mode === 'fixed' ? item.height.value : frame.size.height,
    }
  }
  return {
    width: item.width.value,
    height: item.height.value,
  }
}

/**
 * component-instance 的同步固有尺寸：覆盖后的组件根尺寸（Hug 外框事实来源）。
 *
 * @internal
 */
export const COMPONENT_INSTANCE_RENDERER_MEASUREMENT: ComposeRendererMeasurementDefinition = {
  measure({ props, width, height }) {
    const document = resolveInstanceDocument(props as Readonly<Record<string, unknown>>)
    if (!document) return null
    return constrainIntrinsicSize(measureRootSize(document), width, height)
  },
}
