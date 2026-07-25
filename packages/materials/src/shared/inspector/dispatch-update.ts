import type { NodeInspectorProps } from '@compose-ui/component-registry'
import type {
  ComposeNode,
  EditorCommand,
  JsonObject,
  JsonValue,
} from '@compose-ui/core'
import type { ContainerValue, TextValue } from './schemas'
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

const describedFields: readonly [keyof TextValue, string][] = [
  ['name', 'Name'],
  ['x', 'X'],
  ['y', 'Y'],
  ['width', 'Width'],
  ['height', 'Height'],
  ['rotation', 'Rotation'],
  ['backgroundColor', 'Background'],
  ['borderColor', 'Border color'],
  ['borderWidth', 'Border width'],
  ['borderRadius', 'Border radius'],
  ['opacity', 'Opacity'],
  ['shadow', 'Shadow'],
  ['text', 'Text'],
  ['color', 'Text color'],
  ['fontSize', 'Font size'],
]

function describeUpdate(
  node: ComposeNode,
  current: ContainerValue | TextValue,
  next: ContainerValue | TextValue,
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
  current: ContainerValue | TextValue,
  next: ContainerValue | TextValue,
  dispatch: NodeInspectorProps['dispatch'],
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
  if (forceStyle || !isEqualValue(currentStyle, nextStyle)) {
    commands.push({
      id: idFactory(),
      type: 'node.style.set',
      payload: { nodeId: node.id, path: [], value: nextStyle as unknown as JsonValue },
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
  if (commands.length === 0) return
  dispatch({
    id: idFactory(),
    type: 'transaction.batch',
    payload: { commands: commands as unknown as JsonValue },
    meta,
  })
}
