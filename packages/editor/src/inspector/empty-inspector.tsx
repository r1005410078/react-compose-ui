import { useComposeI18nContext } from '@compose-ui/ui-context'
import { getEditorMessages } from '../editor-i18n'

/** 无法呈现属性时的 Inspector 空态。 @internal */
export function DefaultEmptyInspector({ multiple = false }: {
  /** 多选导致的空态：提示"只选中一个"，而不是"请选择"。 */
  readonly multiple?: boolean
}) {
  const i18n = useComposeI18nContext()
  const workspace = getEditorMessages(
    i18n?.locale ?? 'zh-CN',
    i18n?.formatMessage,
  ).workspace
  return (
    <div className="compose-editor__empty-inspector" role="status">
      {multiple ? workspace.selectSingleNode : workspace.selectNode}
    </div>
  )
}
