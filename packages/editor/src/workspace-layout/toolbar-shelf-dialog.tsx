import { Fragment, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { getEditorMessages } from '../editor-i18n'
import {
  COMPOSE_TOOLBAR_SELECT_ID,
  COMPOSE_TOOLBAR_SEPARATOR,
  insertToolbarSeparator,
  insertToolbarShelfItemAt,
  removeToolbarShelfItem,
  reorderToolbarShelfItem,
} from '../stage-toolbar/toolbar-shelf'
import type { ComposeToolbarShelf } from '../stage-toolbar/toolbar-shelf'
import { ShelfDialogShell, ShelfDragImage, ShelfDropCaret, useShelfReorder } from './shelf-dialog'

/**
 * 目录里一格的可呈现半边。
 *
 * @remarks
 * `icon` 与工具栏上画的是同一枚：对话框里排出来的就是工具栏上画出来的，只给名字时用户得在
 * 两套呈现之间自己对号。`via` 是这一格的**第二条入口**——说明文案承诺「拿掉一格不会拿掉那项
 * 能力」，印出来这句承诺才是可核对的。
 *
 * @internal
 */
export interface ToolbarShelfCatalogEntry {
  readonly id: string
  readonly label: string
  readonly icon?: ReactNode
  readonly via: string
  /** 宿主经 `toolbarItems` 注入的项；来源列上标明。 */
  readonly injected?: boolean
}

interface ToolbarShelfDialogProps {
  /** 此刻生效的货架。 */
  readonly shelf: ComposeToolbarShelf
  /** 目录全集，按内建顺序；来源列由它减去货架得到。 */
  readonly catalog: readonly ToolbarShelfCatalogEntry[]
  /**
   * 当前窗口下第一个被收进「更多」的格 id；量不到时为 `null`。
   *
   * @remarks
   * **量不到就不画切口**，不猜一个位置——与画布上「无从得知指针位置时先不画十字线」是同一条。
   * 一条画错位置的切口会让用户照它排序，而排出来的结果与他看到的不一致。
   */
  readonly overflowFrom?: string | null
  readonly onClose: () => void
  readonly onSubmit: (shelf: ComposeToolbarShelf) => void
  /** 「重置为默认」：删掉偏好里的那条，回到定义自带的。 */
  readonly onReset: () => void
}

/**
 * 自定义工具栏：左边把货架排成一条横栏，右边是还没上架的目录，两边互拖。
 *
 * @remarks
 * 横排不是审美选择——工具栏本身就是一条横栏，而它会**溢出到「更多」**：顺序的全部意义就在
 * 那个切口上（绘图货架把八条绘图命令排在容器 / 文字之前，理由正是「溢出是从尾部收的」）。
 * 竖列表画不出那条切口，用户排完不知道自己排掉了什么。
 *
 * 拖动与键盘写**同一份草稿**，见 `useShelfReorder`；因此这里没有一排常驻的移动按钮——那种
 * 布局必然有「没有选中」的一档，而那一档里每颗按钮都是灰的。
 *
 * 草稿住在本组件里，「完成」才写偏好：中途每一步都写的话，用户按「取消」无从退回。
 *
 * @internal
 */
export function ToolbarShelfDialog({
  shelf,
  catalog,
  overflowFrom = null,
  onClose,
  onSubmit,
  onReset,
}: ToolbarShelfDialogProps) {
  const i18n = useComposeI18nContext()
  const t = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage).workspaces
  const [draft, setDraft] = useState<ComposeToolbarShelf>(shelf)
  const [search, setSearch] = useState('')

  const entryOf = (id: string) => catalog.find((entry) => entry.id === id)
  const labelOf = (id: string) => (
    id === COMPOSE_TOOLBAR_SEPARATOR ? t.toolbarSeparator : entryOf(id)?.label ?? id
  )

  const needle = search.trim().toLowerCase()
  const notOnShelf = catalog
    .filter((entry) => !draft.includes(entry.id))
    .filter((entry) => needle === ''
      || entry.label.toLowerCase().includes(needle)
      || entry.id.toLowerCase().includes(needle)
      || entry.via.toLowerCase().includes(needle))

  const reorder = useShelfReorder({
    orientation: 'wrap',
    count: draft.length,
    // 「选择」抓不起来：取点命令结束之后用户回到的就是它。
    canGrab: (index) => draft[index] !== COMPOSE_TOOLBAR_SELECT_ID,
    describeItem: (index) => labelOf(draft[index] ?? ''),
    messages: t.shelfAnnounce,
    onReorder: (from, to) => setDraft((current) => reorderToolbarShelfItem(current, from, to)),
    onAdd: (key, at) => setDraft((current) => insertToolbarShelfItemAt(current, key, at)),
    onRemove: (index) => setDraft((current) => removeToolbarShelfItem(current, index)),
    onInsertSeparator: (index) => setDraft((current) => insertToolbarSeparator(current, index + 1)),
  })

  const { session } = reorder
  const caretAt = session?.zone === 'shelf' ? session.insertBefore : null
  const draggingIndex = session?.origin.zone === 'shelf' ? session.origin.index : null
  // 切口按 id 定位而不是按下标：下标在草稿被改过之后指向的是另一格。
  const cutIndex = useMemo(() => {
    if (overflowFrom === null) return null
    const index = draft.indexOf(overflowFrom)
    return index < 0 ? null : index
  }, [draft, overflowFrom])

  const origin = session?.origin
  const dragEntry = origin?.zone === 'source'
    ? entryOf(origin.key)
    : draggingIndex === null ? null : entryOf(draft[draggingIndex] ?? '')

  return (
    <ShelfDialogShell
      hint={(
        <>
          {t.toolbarDragHint}
          <br />
          {t.shelfKeyboardHint}
          {' '}
          {t.shelfKeyboardSeparator}
        </>
      )}
      labels={{
        title: t.toolbarTitle,
        description: t.toolbarDescription,
        arrangeTitle: t.toolbarShelf,
        sourceTitle: t.toolbarAvailable,
        searchPlaceholder: t.shelfSearch,
        reset: t.toolbarResetShelf,
        cancel: t.cancel,
        done: t.toolbarDone,
      }}
      note={t.toolbarShelfCount(
        draft.filter((id) => id !== COMPOSE_TOOLBAR_SEPARATOR).length,
        draft.filter((id) => id === COMPOSE_TOOLBAR_SEPARATOR).length,
      )}
      orientation="wrap"
      reorder={reorder}
      search={search}
      source={(
        <>
          {notOnShelf.length === 0 ? (
            <p className="compose-editor__shelf-empty">{t.toolbarAllOnShelf}</p>
          ) : null}
          {notOnShelf.map((entry) => (
            <button
              className="compose-editor__shelf-source"
              data-shelf-available={entry.id}
              data-shelf-ghost={session?.origin.zone === 'source' && session.origin.key === entry.id
                ? 'true'
                : undefined}
              key={entry.id}
              role="option"
              type="button"
              {...reorder.sourceItemProps(entry.id)}
              aria-selected={false}
            >
              <span className="compose-editor__shelf-grip" />
              {entry.icon}
              <span className="compose-editor__shelf-source-name">{entry.label}</span>
              {entry.injected ? <span className="compose-editor__shelf-tag">{t.toolbarInjected}</span> : null}
              <span className="compose-editor__shelf-via">{entry.via}</span>
            </button>
          ))}
        </>
      )}
      onClose={onClose}
      onReset={onReset}
      onSearchChange={setSearch}
      onSubmit={() => onSubmit(draft)}
    >
      {draft.map((id, index) => {
        const fixed = id === COMPOSE_TOOLBAR_SELECT_ID
        const entry = entryOf(id)
        return (
          <Fragment key={`${id}:${index}`}>
            {caretAt === index ? <ShelfDropCaret /> : null}
            {cutIndex === index ? (
              <span className="compose-editor__shelf-cut" data-testid="compose-shelf-cut">
                {t.toolbarOverflowCut}
              </span>
            ) : null}
            {id === COMPOSE_TOOLBAR_SEPARATOR ? (
              <button
                aria-label={t.toolbarSeparator}
                aria-selected={index === reorder.focusIndex}
                className="compose-editor__shelf-sep"
                data-shelf-overflowed={cutIndex !== null && index >= cutIndex ? 'true' : undefined}
                role="option"
                tabIndex={-1}
                type="button"
                {...reorder.itemProps(index)}
                data-shelf-ghost={draggingIndex === index ? 'true' : undefined}
                onFocus={() => reorder.setFocusIndex(index)}
              />
            ) : (
              <button
                aria-selected={index === reorder.focusIndex}
                className="compose-editor__shelf-chip"
                data-shelf-fixed={fixed ? 'true' : undefined}
                data-shelf-id={id}
                data-shelf-overflowed={cutIndex !== null && index >= cutIndex ? 'true' : undefined}
                role="option"
                tabIndex={-1}
                type="button"
                {...reorder.itemProps(index)}
                data-shelf-ghost={draggingIndex === index ? 'true' : undefined}
                onFocus={() => reorder.setFocusIndex(index)}
              >
                {entry?.icon}
                <span>{labelOf(id)}</span>
                {fixed ? <span className="compose-editor__shelf-tag">{t.toolbarFixed}</span> : null}
              </button>
            )}
          </Fragment>
        )
      })}
      {caretAt === draft.length ? <ShelfDropCaret /> : null}
      {session?.point && dragEntry ? (
        <ShelfDragImage
          badge={session.zone === 'source' && session.origin.zone === 'shelf' ? 'remove' : 'add'}
          point={session.point}
        >
          <span className="compose-editor__shelf-chip">
            {dragEntry.icon}
            <span>{dragEntry.label}</span>
          </span>
        </ShelfDragImage>
      ) : null}
    </ShelfDialogShell>
  )
}
