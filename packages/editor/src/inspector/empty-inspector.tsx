import { useComposeI18nContext } from '@compose-ui/ui-context'
import { getEditorMessages } from '../editor-i18n'

/** 未选中任何 Entity 时的默认 Inspector 空态。 @internal */
export function DefaultEmptyInspector() {
  const i18n = useComposeI18nContext()
  return (
    <div className="compose-editor__empty-inspector" role="status">
      {getEditorMessages(
        i18n?.locale ?? 'zh-CN',
        i18n?.formatMessage,
      ).workspace.selectNode}
    </div>
  )
}
