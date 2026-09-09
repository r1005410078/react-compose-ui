import { useState } from 'react'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import {
  ComposeButton,
  ComposeDialog,
  ComposeDialogBackdrop,
  ComposeDialogContent,
  ComposeDialogDescription,
  ComposeDialogFooter,
  ComposeDialogHeader,
  ComposeDialogPortal,
  ComposeDialogTitle,
  ComposeDialogViewport,
} from '@compose-ui/components'
import { getEditorMessages } from '../editor-i18n'
import {
  COMPOSE_TOOLBAR_SELECT_ID,
  COMPOSE_TOOLBAR_SEPARATOR,
  addToolbarShelfItem,
  insertToolbarSeparator,
  moveToolbarShelfItem,
  removeToolbarShelfItem,
} from '../stage-toolbar/toolbar-shelf'
import type { ComposeToolbarShelf } from '../stage-toolbar/toolbar-shelf'

/** 目录里一格的可呈现半边；对话框只需要 id 与标题。 */
export interface ToolbarShelfCatalogEntry {
  readonly id: string
  readonly label: string
}

interface ToolbarShelfDialogProps {
  /** 此刻生效的货架。 */
  readonly shelf: ComposeToolbarShelf
  /** 目录全集，按内建顺序；未放入那一列由它减去货架得到。 */
  readonly catalog: readonly ToolbarShelfCatalogEntry[]
  readonly onClose: () => void
  readonly onSubmit: (shelf: ComposeToolbarShelf) => void
  /** 「重置为默认」：删掉偏好里的那条，回到定义自带的。 */
  readonly onReset: () => void
}

/**
 * 自定义工具栏：两列 + 显式的移动按钮。
 *
 * @remarks
 * **不做 HTML5 拖放**。理由不是省事：可重排列表按仓库规则必须完整实现对应的 WAI-ARIA Pattern
 * （键盘、焦点、状态），因此键盘重排无论如何都要写一遍；先写按钮驱动的那一份，拖放是它之上
 * 的增强而不是替代。按钮那一份还能被组件测试稳定地断言，而拖放只能靠端到端且天生易碎。
 *
 * 草稿住在本组件里，「完成」才写偏好：中途每一步都写的话，用户按「取消」无从退回，而这个
 * 对话框的每一步都是可见的重排。
 *
 * @internal
 */
export function ToolbarShelfDialog({
  shelf,
  catalog,
  onClose,
  onSubmit,
  onReset,
}: ToolbarShelfDialogProps) {
  const i18n = useComposeI18nContext()
  const t = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage).workspaces
  const [draft, setDraft] = useState<ComposeToolbarShelf>(shelf)
  // 选中项按**下标**记，不按 id：分隔线可以有多条，id 认不出是哪一条。
  const [selected, setSelected] = useState(0)
  const [available, setAvailable] = useState<string | null>(null)

  const labelOf = (id: string) => (
    id === COMPOSE_TOOLBAR_SEPARATOR
      ? t.toolbarSeparator
      : catalog.find((entry) => entry.id === id)?.label ?? id
  )
  const notOnShelf = catalog.filter((entry) => !draft.includes(entry.id))
  const fixed = draft[selected] === COMPOSE_TOOLBAR_SELECT_ID

  const move = (delta: -1 | 1) => {
    const next = moveToolbarShelfItem(draft, selected, delta)
    if (next === draft) return
    setDraft(next)
    setSelected(selected + delta)
  }

  return (
    <ComposeDialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <ComposeDialogPortal>
        <ComposeDialogBackdrop />
        <ComposeDialogViewport>
          <ComposeDialogContent>
            <ComposeDialogHeader>
              <ComposeDialogTitle>{t.toolbarTitle}</ComposeDialogTitle>
              <ComposeDialogDescription>{t.toolbarDescription}</ComposeDialogDescription>
            </ComposeDialogHeader>
            <div className="compose-editor__shelf-dialog">
              <div className="compose-editor__shelf-column">
                <h3 id="compose-shelf-on">{t.toolbarShelf}</h3>
                <ul aria-labelledby="compose-shelf-on" className="compose-editor__shelf-list" role="listbox">
                  {draft.map((id, index) => (
                    <li key={`${id}:${index}`}>
                      <button
                        aria-selected={index === selected}
                        data-shelf-item={id}
                        role="option"
                        type="button"
                        onClick={() => setSelected(index)}
                      >
                        {labelOf(id)}
                        {id === COMPOSE_TOOLBAR_SELECT_ID ? (
                          <span className="compose-editor__shelf-fixed">{t.toolbarFixed}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="compose-editor__shelf-actions">
                  <ComposeButton
                    disabled={selected <= 1}
                    type="button"
                    variant="outline"
                    onClick={() => move(-1)}
                  >
                    {t.toolbarMoveUp}
                  </ComposeButton>
                  <ComposeButton
                    disabled={fixed || selected >= draft.length - 1}
                    type="button"
                    variant="outline"
                    onClick={() => move(1)}
                  >
                    {t.toolbarMoveDown}
                  </ComposeButton>
                  <ComposeButton
                    disabled={fixed}
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDraft(removeToolbarShelfItem(draft, selected))
                      setSelected(Math.max(0, selected - 1))
                    }}
                  >
                    {t.toolbarRemoveItem}
                  </ComposeButton>
                  <ComposeButton
                    type="button"
                    variant="outline"
                    onClick={() => setDraft(insertToolbarSeparator(draft, selected))}
                  >
                    {t.toolbarInsertSeparator}
                  </ComposeButton>
                </div>
              </div>
              <div className="compose-editor__shelf-column">
                <h3 id="compose-shelf-off">{t.toolbarAvailable}</h3>
                <ul aria-labelledby="compose-shelf-off" className="compose-editor__shelf-list" role="listbox">
                  {notOnShelf.map((entry) => (
                    <li key={entry.id}>
                      <button
                        aria-selected={entry.id === available}
                        data-shelf-available={entry.id}
                        role="option"
                        type="button"
                        onClick={() => setAvailable(entry.id)}
                      >
                        {entry.label}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="compose-editor__shelf-actions">
                  <ComposeButton
                    disabled={available === null}
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (available === null) return
                      setDraft(addToolbarShelfItem(draft, available))
                      setAvailable(null)
                    }}
                  >
                    {t.toolbarAdd}
                  </ComposeButton>
                </div>
              </div>
            </div>
            <ComposeDialogFooter>
              <ComposeButton
                type="button"
                variant="outline"
                onClick={() => { onReset(); onClose() }}
              >
                {t.toolbarResetShelf}
              </ComposeButton>
              <ComposeButton type="button" variant="outline" onClick={onClose}>{t.cancel}</ComposeButton>
              <ComposeButton type="button" onClick={() => { onSubmit(draft); onClose() }}>
                {t.toolbarDone}
              </ComposeButton>
            </ComposeDialogFooter>
          </ComposeDialogContent>
        </ComposeDialogViewport>
      </ComposeDialogPortal>
    </ComposeDialog>
  )
}
