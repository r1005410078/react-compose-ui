import type { ComposeNodeInspectorProps } from '@compose-ui/component-registry'
import type {
  ComposeNode,
  EditorCommand,
  JsonObject,
  JsonValue,
} from '@compose-ui/core'
import type {
  ContainerValue,
  FrameValue,
  ImageValue,
  SvgValue,
  TextValue,
} from './schemas'
import {
  createStyleValue,
  createTransformValue,
  isEqualValue,
} from './values'

/** Inspector 命令 ID factory。 @internal */
export type InspectorIdFactory = () => string

/** 创建 Inspector 使用的默认命令 ID。 @internal */
export function createDefaultInspectorId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `material-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function formatValue(value: unknown) {
  const text = JSON.stringify(value)
  if (text === undefined) return 'undefined'
  return text.length > 32 ? `${text.slice(0, 31)}…` : text
}

type InspectorValue = ContainerValue | FrameValue | TextValue | ImageValue | SvgValue

const describedFields: readonly [string, string][] = [
  ['name', 'Name'],
  ['position', 'Position'],
  ['size', 'Size'],
  ['rotation', 'Rotation'],
  ['visible', 'Visibility'],
  ['clipContent', 'Clip content'],
  ['backgroundColor', 'Background'],
  ['borderColor', 'Border color'],
  ['borderWidth', 'Border width'],
  ['borderRadius', 'Border radius'],
  ['opacity', 'Opacity'],
  ['shadow', 'Shadow'],
  ['text', 'Text'],
  ['color', 'Text color'],
  ['fontSize', 'Font size'],
  ['alt', 'Alternative text'],
  ['fit', 'Fit'],
  ['overrideFill', 'Override fill'],
  ['fillColor', 'Fill color'],
  ['overrideStroke', 'Override stroke'],
  ['strokeColor', 'Stroke color'],
]

function describeUpdate(
  node: ComposeNode,
  current: InspectorValue,
  next: InspectorValue,
) {
  const currentRecord = current as unknown as Readonly<Record<string, unknown>>
  const nextRecord = next as unknown as Readonly<Record<string, unknown>>
  const changes = describedFields.flatMap(([key, label]) => {
    if (
      !(key in currentRecord)
      || !(key in nextRecord)
      || isEqualValue(currentRecord[key], nextRecord[key])
    ) return []
    return [`${label} ${formatValue(currentRecord[key])} → ${formatValue(nextRecord[key])}`]
  })
  return `Update ${node.name}${changes.length > 0 ? ` · ${changes.slice(0, 3).join(', ')}` : ''}`
}

function commandMeta(node: ComposeNode, label: string) {
  return {
    label,
    source: 'inspector',
    targetIds: [node.id],
    mergeKey: `inspector:${node.id}`,
  }
}

/**
 * 将一次 Inspector 表单变化归一化为单个原子 batch。
 *
 * `forceStyle` 用于旧文档首次编辑：即使视觉值未改变，也写入标准 `node.style`。
 *
 * @internal
 */
export function dispatchInspectorUpdate(
  node: ComposeNode,
  current: InspectorValue,
  next: InspectorValue,
  dispatch: ComposeNodeInspectorProps['dispatch'],
  idFactory: InspectorIdFactory,
  forceStyle = false,
) {
  const commands: EditorCommand[] = []
  const label = describeUpdate(node, current, next)
  const meta = commandMeta(node, label)
  if (current.name !== next.name) {
    commands.push({
      id: idFactory(),
      type: 'node.rename',
      payload: { nodeId: node.id, name: next.name },
      meta,
    })
  }
  if (current.visible !== next.visible) {
    commands.push({
      id: idFactory(),
      type: 'node.set-visibility',
      payload: { nodeIds: [node.id], visible: next.visible },
      meta,
    })
  }
  const currentTransform = createTransformValue(current)
  const nextTransform = createTransformValue(next)
  if (!isEqualValue(currentTransform, nextTransform)) {
    commands.push({
      id: idFactory(),
      type: 'node.transform.set',
      payload: {
        updates: [{ nodeId: node.id, transform: nextTransform }] as unknown as JsonValue,
      },
      meta,
    })
  }
  const currentStyle = createStyleValue(current)
  const nextStyle = createStyleValue(next)
  // 旧 Rectangle 的首次非可见性编辑仍需写入标准 style；仅切换 visible 不得产生无关 style 变更。
  const styleChanged = !isEqualValue(currentStyle, nextStyle)
  const migrateLegacyStyle = forceStyle && current.visible === next.visible
  if (migrateLegacyStyle || styleChanged) {
    commands.push({
      id: idFactory(),
      type: 'node.style.set',
      payload: { nodeId: node.id, path: [], value: nextStyle as unknown as JsonValue },
      meta,
    })
  }
  if (
    node.kind === 'frame'
    && 'clipContent' in current
    && 'clipContent' in next
    && current.clipContent !== next.clipContent
  ) {
    commands.push({
      id: idFactory(),
      type: 'frame.clip-content.set',
      payload: { frameId: node.id, clipContent: next.clipContent },
      meta,
    })
  }
  if (node.kind === 'component' && 'text' in current && 'text' in next) {
    const nextProps: JsonObject = {
      ...node.props,
      text: next.text,
      color: next.color,
      fontSize: next.fontSize,
    }
    if (!isEqualValue(node.props, nextProps)) {
      commands.push({
        id: idFactory(),
        type: 'node.props.set',
        payload: { nodeId: node.id, path: [], value: nextProps },
        meta,
      })
    }
  }
  if (node.kind === 'component' && 'alt' in current && 'alt' in next) {
    const nextProps: JsonObject = {
      ...node.props,
      alt: next.alt,
      fit: next.fit,
      ...('overrideFill' in next ? {
        overrideFill: next.overrideFill,
        fillColor: next.fillColor,
        overrideStroke: next.overrideStroke,
        strokeColor: next.strokeColor,
      } : {}),
    }
    if (!isEqualValue(node.props, nextProps)) {
      commands.push({
        id: idFactory(),
        type: 'node.props.set',
        payload: { nodeId: node.id, path: [], value: nextProps },
        meta,
      })
    }
  }
  if (commands.length === 0) return
  dispatch({
    id: idFactory(),
    type: 'transaction.batch',
    payload: { commands: commands as unknown as JsonValue },
    meta,
  })
}
