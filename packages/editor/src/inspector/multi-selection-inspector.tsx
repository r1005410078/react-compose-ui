import { getComposeRenderer, type ComposeDocument, type EditorCommand } from '@compose-ui/core'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { DefaultEmptyInspector } from './empty-inspector'
import { TextStyleInspector } from './text-style-inspector'

/**
 * 多选时的 Inspector。
 *
 * @remarks
 * 多选下逐字段编辑没有确定含义（那正是这里长期只有一句空态提示的理由），但**文字样式是例外**
 * ——「把这一批统一成同一个样式」本来就是一次以整组为对象的操作，规划器也一直按 `entityIds`
 * 收数组。因此这里在空态提示之上多一段样式控制，其余一个字段都不出。
 *
 * 只数带 Renderer 的那些：样式管的是排版值，容器没有 props 可管，而规划器本来就会跳过它们。
 * 一个都没有时整段不出——那时这个面板仍然只是一句空态。
 *
 * @internal
 */
export function MultiSelectionInspector({
  document,
  selectedIds,
  dispatch,
  idFactory,
  readOnly = false,
}: {
  readonly document: ComposeDocument
  readonly selectedIds: readonly string[]
  readonly dispatch: (command: EditorCommand) => unknown
  readonly idFactory: () => string
  readonly readOnly?: boolean
}) {
  const i18n = useComposeI18nContext()
  const zh = (i18n?.locale ?? 'zh-CN') === 'zh-CN'
  const entities = selectedIds
    .flatMap((id) => {
      const entity = document.entities[id]
      return entity && getComposeRenderer(entity) ? [entity] : []
    })
  return (
    <div className="compose-editor__multi-inspector">
      <DefaultEmptyInspector multiple />
      {entities.length > 0 ? (
        <section aria-label={zh ? '文字样式' : 'Text style'}>
          <h3>{zh ? '文字样式' : 'Text style'}</h3>
          <TextStyleInspector
            dispatch={dispatch}
            document={document}
            entities={entities}
            idFactory={idFactory}
            readOnly={readOnly}
            zh={zh}
          />
        </section>
      ) : null}
    </div>
  )
}
