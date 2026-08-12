import type { ComposeComponentOverrideOperation } from '@compose-ui/core'

/** 字段路径末段的可读标签。 */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  backgroundPaint: '背景填充',
  borderColor: '边框颜色',
  borderWidth: '边框宽度',
  borderRadius: '圆角',
  opacity: '透明度',
  shadow: '阴影',
  width: '宽度',
  height: '高度',
  offset: '位置',
  rotation: '旋转',
  visible: '可见',
  locked: '锁定',
  childIds: '子项',
  text: '文本',
}

function fieldLabel(path: readonly string[] | undefined): string {
  if (!path || path.length === 0) return '属性'
  const last = path[path.length - 1]!
  return FIELD_LABELS[last] ?? last
}

/**
 * 把结构操作拆成人话主标题 + 次要说明，供列表行展示。
 *
 * @public
 */
export function describeInstanceOperation(operation: ComposeComponentOverrideOperation): {
  readonly title: string
  readonly detail: string
} {
  switch (operation.kind) {
    case 'set-field':
      return {
        title: fieldLabel(operation.fieldPath),
        detail: `${operation.entityId} · ${operation.fieldPath.join('.') || '字段'}`,
      }
    case 'remove-field':
      return {
        title: `移除 ${fieldLabel(operation.fieldPath)}`,
        detail: `${operation.entityId} · ${operation.fieldPath.join('.') || '字段'}`,
      }
    case 'add-component':
      return {
        title: '新增能力',
        detail: `${operation.entityId} · ${operation.componentKey}`,
      }
    case 'remove-component':
      return {
        title: '移除能力',
        detail: `${operation.entityId} · ${operation.componentKey}`,
      }
    case 'add-entity':
      return {
        title: '新增子树',
        detail: operation.rootEntityId,
      }
    case 'remove-entity':
      return { title: '删除实体', detail: operation.entityId }
    case 'move-entity':
      return { title: '移动实体', detail: operation.entityId }
    default: {
      const exhaustive: never = operation
      return { title: '未知操作', detail: String(exhaustive) }
    }
  }
}
