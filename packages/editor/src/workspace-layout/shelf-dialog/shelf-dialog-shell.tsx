import type { ReactNode } from 'react'
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
import type { useShelfReorder } from './use-shelf-reorder'

/** 骨架要用到的一组已本地化文案。 @internal */
export interface ShelfDialogLabels {
  readonly title: string
  readonly description: string
  /** 左侧编排区的小标题。 */
  readonly arrangeTitle: string
  /** 右侧来源列的小标题。 */
  readonly sourceTitle: string
  readonly searchPlaceholder: string
  readonly reset: string
  readonly cancel: string
  readonly done: string
}

/** @internal */
export interface ShelfDialogShellProps {
  readonly labels: ShelfDialogLabels
  readonly reorder: ReturnType<typeof useShelfReorder>
  /** 编排区右上角的计数一类的说明。 */
  readonly note?: ReactNode
  /**
   * 面板级字段，排在编排区**之外**。
   *
   * @remarks
   * 物料面板的标题与搜索框开关管的是整个面板，段卡里那些开关管的是一段。层级由**位置**表达
   * ——挤进编排区里会与段卡的开关排成一片，用户读不出哪个管哪个。工具栏那份没有这一层。
   */
  readonly meta?: ReactNode
  /** 编排区的内容：工具栏是横排的格，物料是纵排的段卡。 */
  readonly children: ReactNode
  /** 编排区下面那行提示；键盘等价写在这里。 */
  readonly hint: ReactNode
  /** 来源列的内容。 */
  readonly source: ReactNode
  readonly search: string
  readonly onSearchChange: (value: string) => void
  readonly onClose: () => void
  readonly onSubmit: () => void
  readonly onReset: () => void
  /** 编排区朝向；只用来给样式表分档，落点换算由 `reorder` 自己拿。 */
  readonly orientation: 'wrap' | 'vertical'
}

/**
 * 两个货架对话框共用的壳：标题 + 左编排右来源 + 页脚。
 *
 * @remarks
 * **编排区的内容由调用方给**，因为两边排的东西方向不同——工具栏是一条横栏、物料面板是一列
 * 段卡，「编排区画的是它将来的样子」。共用的是壳、页脚、**来源列**、拖拽语义与 live region；
 * 「两个对话框长得一样」的可执行形式是这几样，不是两个编排区逐像素相同。
 *
 * 「重置为默认」退到页脚左端：它是**还原**不是提交，与「完成」并排会招误点，而这一步不可撤销。
 *
 * @internal
 */
export function ShelfDialogShell({
  children,
  hint,
  labels,
  meta,
  note,
  onClose,
  onReset,
  onSearchChange,
  onSubmit,
  orientation,
  reorder,
  search,
  source,
}: ShelfDialogShellProps) {
  const { announcement, onShelfKeyDown, session, shelfRef, sourceRef } = reorder
  const shelfDrop = session?.zone === 'shelf'
  const sourceDrop = session?.zone === 'source' && session.origin.zone === 'shelf'

  return (
    <ComposeDialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <ComposeDialogPortal>
        <ComposeDialogBackdrop />
        <ComposeDialogViewport>
          <ComposeDialogContent size="wide">
            <ComposeDialogHeader>
              <ComposeDialogTitle>{labels.title}</ComposeDialogTitle>
              <ComposeDialogDescription>{labels.description}</ComposeDialogDescription>
            </ComposeDialogHeader>
            <div className="compose-editor__shelf-cols">
              <div className="compose-editor__shelf-pane">
                <div className="compose-editor__shelf-pane-head">
                  <span className="compose-editor__shelf-pane-title" id="compose-shelf-arrange">
                    {labels.arrangeTitle}
                  </span>
                  {note ? <span className="compose-editor__shelf-pane-note">{note}</span> : null}
                </div>
                {meta ? <div className="compose-editor__shelf-meta">{meta}</div> : null}
                <div
                  aria-labelledby="compose-shelf-arrange"
                  className="compose-editor__shelf-box"
                  data-shelf-drop={shelfDrop ? 'true' : undefined}
                  data-shelf-orientation={orientation}
                  data-testid="compose-shelf-arrange"
                  ref={shelfRef}
                  role="listbox"
                  tabIndex={0}
                  onKeyDown={onShelfKeyDown}
                >
                  {children}
                </div>
                <p className="compose-editor__shelf-hint">{hint}</p>
              </div>
              <div className="compose-editor__shelf-pane">
                <div className="compose-editor__shelf-pane-head">
                  <span className="compose-editor__shelf-pane-title" id="compose-shelf-source">
                    {labels.sourceTitle}
                  </span>
                  <input
                    aria-label={labels.searchPlaceholder}
                    className="compose-editor__shelf-search"
                    data-testid="compose-shelf-search"
                    placeholder={labels.searchPlaceholder}
                    type="search"
                    value={search}
                    onChange={(event) => onSearchChange(event.currentTarget.value)}
                  />
                </div>
                <div
                  aria-labelledby="compose-shelf-source"
                  className="compose-editor__shelf-box compose-editor__shelf-box--list"
                  data-shelf-drop={sourceDrop ? 'remove' : undefined}
                  data-testid="compose-shelf-source"
                  ref={sourceRef}
                  role="listbox"
                >
                  {source}
                </div>
              </div>
            </div>
            {/* 抓起、移动、放下与放弃都要播报：抓起之后屏幕阅读器用户否则听不到任何东西在动。 */}
            <span aria-live="polite" className="compose-editor__shelf-live" role="status">
              {announcement}
            </span>
            <ComposeDialogFooter className="compose-editor__shelf-footer">
              <ComposeButton
                type="button"
                variant="ghost"
                onClick={() => { onReset(); onClose() }}
              >
                {labels.reset}
              </ComposeButton>
              <span className="compose-editor__shelf-footer-end">
                <ComposeButton type="button" variant="outline" onClick={onClose}>
                  {labels.cancel}
                </ComposeButton>
                <ComposeButton type="button" onClick={() => { onSubmit(); onClose() }}>
                  {labels.done}
                </ComposeButton>
              </span>
            </ComposeDialogFooter>
          </ComposeDialogContent>
        </ComposeDialogViewport>
      </ComposeDialogPortal>
    </ComposeDialog>
  )
}

/** 拖动中跟着光标的那一件；键盘抓起时不画（那时没有光标位置）。 @internal */
export function ShelfDragImage({
  badge,
  children,
  point,
}: {
  readonly badge: 'add' | 'remove'
  readonly children: ReactNode
  readonly point: { readonly x: number; readonly y: number }
}) {
  return (
    <div
      aria-hidden="true"
      className="compose-editor__shelf-drag"
      data-shelf-badge={badge}
      data-testid="compose-shelf-drag"
      style={{ left: point.x, top: point.y }}
    >
      {children}
    </div>
  )
}

/** 两格之间的插入线；落点画在**位置**上而不是压住的那一格上。 @internal */
export function ShelfDropCaret() {
  return <span aria-hidden="true" className="compose-editor__shelf-caret" data-testid="compose-shelf-caret" />
}
