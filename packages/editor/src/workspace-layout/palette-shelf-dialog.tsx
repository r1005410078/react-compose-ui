import { Fragment, useState } from 'react'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { ComposeInput } from '@compose-ui/components'
import {
  insertComponentShelfSectionAt,
  removeComponentShelfSection,
  reorderComponentShelfSection,
  setComponentShelfPresetVisible,
  updateComponentShelfSection,
} from '@compose-ui/component-library'
import type {
  ComposeComponentShelf,
  ComposeComponentShelfFolderSection,
  ComposeComponentShelfPresetSection,
} from '@compose-ui/component-library'
import { getEditorMessages } from '../editor-i18n'
import { ShelfDialogShell, ShelfDragImage, ShelfDropCaret, useShelfReorder } from './shelf-dialog'

/** 目录里一个基础 Preset 的可呈现半边。 @internal */
export interface PaletteShelfPreset {
  readonly id: string
  readonly label: string
}

interface PaletteShelfDialogProps {
  /** 此刻生效的货架。 */
  readonly shelf: ComposeComponentShelf
  /** 当前工作区下可见的基础 Preset，顺序即呈现顺序。 */
  readonly presets: readonly PaletteShelfPreset[]
  /**
   * 资源里存在的全部文件夹路径；来源列由它减去已经在货架上的得到。
   *
   * @remarks
   * 这就是资源浏览器列出的同一份文件夹集合（`ComposeComponentCatalog.folders`），因此
   * **不在对话框里再挂一棵资源树**：那会让 `editor` 为一个选择器背上整个 asset-browser 的
   * 挂载与加载态，而用户在这里要选的只是一个路径。目录还没读回来时这一列为空，用户仍可以
   * 排序与删段——那些不需要认识资源。
   */
  readonly folders: readonly (readonly string[])[]
  readonly onClose: () => void
  readonly onSubmit: (shelf: ComposeComponentShelf) => void
  /** 「重置为默认」：删掉偏好里的那条，回到定义自带的。 */
  readonly onReset: () => void
}

/** 根文件夹（空路径）在两边都要有个名字，否则它渲染成一条空行。 */
function folderKey(path: readonly string[]) {
  return `folder:${path.join('/')}`
}

function pathOfKey(key: string): readonly string[] {
  const raw = key.slice('folder:'.length)
  return raw === '' ? [] : raw.split('/')
}

/**
 * 自定义物料面板：与「自定义工具栏」共用同一套骨架、同一列来源、同一套拖拽与键盘语义。
 *
 * @remarks
 * 编排区排的是**段**而不是格，因此它是纵的——「编排区画的是它将来的样子」，而物料面板本身
 * 就是一列。段的选项（文件夹的分组方式、基础组件列哪几个）**直接长在段卡上**：三段各摊几个
 * 开关时用户读得出哪个管哪一段，而「先选中一段、开关在别处」多要一次点击才看得到它们。
 *
 * 面板标题与「显示搜索框」是**面板级**的，因此排在编排区之外——层级由位置表达，挤进去会与
 * 段卡的开关排成一片。
 *
 * 草稿住在本组件里，「完成」才写偏好：中途每一步都写的话，用户按「取消」无从退回。
 *
 * @internal
 */
export function PaletteShelfDialog({
  shelf,
  presets,
  folders,
  onClose,
  onSubmit,
  onReset,
}: PaletteShelfDialogProps) {
  const i18n = useComposeI18nContext()
  const t = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage).workspaces
  const [draft, setDraft] = useState<ComposeComponentShelf>(shelf)
  const [search, setSearch] = useState('')
  const availablePresetIds = presets.map((preset) => preset.id)

  const titleOfSection = (section: ComposeComponentShelf['sections'][number]) => {
    if (section.title) return section.title
    if (section.kind === 'presets') return t.paletteBasicsSource
    return section.folderPath.length === 0
      ? t.paletteRootFolder
      : section.folderPath[section.folderPath.length - 1]!
  }

  // 来源列 = 还没上架的基础组件（至多一条）加上资源里还没上架的每个文件夹。
  const hasPresets = draft.sections.some((entry) => entry.kind === 'presets')
  const shelfFolders = new Set(
    draft.sections
      .filter((entry): entry is ComposeComponentShelfFolderSection => entry.kind === 'folder')
      .map((entry) => folderKey(entry.folderPath)),
  )
  const needle = search.trim().toLowerCase()
  const notOnShelf: readonly { readonly key: string; readonly label: string }[] = [
    ...(hasPresets ? [] : [{ key: 'presets:basics', label: t.paletteBasicsSource }]),
    ...[[] as readonly string[], ...folders]
      .filter((path) => !shelfFolders.has(folderKey(path)))
      .map((path) => ({
        key: folderKey(path),
        label: path.length === 0 ? t.paletteRootFolder : path.join(' / '),
      })),
  ].filter((entry) => needle === '' || entry.label.toLowerCase().includes(needle))

  const addSource = (key: string, at: number) => {
    if (key === 'presets:basics') {
      setDraft((current) => insertComponentShelfSectionAt(
        current,
        { kind: 'presets', id: 'basics' },
        at,
      ))
      return
    }
    const folderPath = pathOfKey(key)
    setDraft((current) => insertComponentShelfSectionAt(
      current,
      {
        kind: 'folder',
        // id 由路径推出，因此同一个文件夹加两次会被 `insertComponentShelfSectionAt` 挡下。
        id: folderPath.length === 0 ? 'components' : folderPath.join('-'),
        folderPath,
        // 拖进来的文件夹默认按子文件夹分组：一支符号库通常再分几类，平铺会得到一大片。
        groupBy: 'subfolder',
      },
      at,
    ))
  }

  const reorder = useShelfReorder({
    orientation: 'vertical',
    count: draft.sections.length,
    describeItem: (index) => {
      const section = draft.sections[index]
      return section ? titleOfSection(section) : ''
    },
    messages: t.shelfAnnounce,
    onReorder: (from, to) => {
      const id = draft.sections[from]?.id
      if (id === undefined) return
      setDraft((current) => reorderComponentShelfSection(current, id, to))
    },
    onAdd: addSource,
    onRemove: (index) => {
      const id = draft.sections[index]?.id
      if (id === undefined) return
      setDraft((current) => removeComponentShelfSection(current, id))
    },
  })

  const { session } = reorder
  const caretAt = session?.zone === 'shelf' ? session.insertBefore : null
  const draggingIndex = session?.origin.zone === 'shelf' ? session.origin.index : null
  const origin = session?.origin
  const dragLabel = origin?.zone === 'source'
    ? notOnShelf.find((entry) => entry.key === origin.key)?.label
    : draggingIndex === null
      ? undefined
      : titleOfSection(draft.sections[draggingIndex]!)

  return (
    <ShelfDialogShell
      hint={(
        <>
          {t.paletteDragHint}
          <br />
          {t.shelfKeyboardHint}
        </>
      )}
      labels={{
        title: t.paletteTitle,
        description: t.paletteDescription,
        arrangeTitle: t.paletteSections,
        sourceTitle: t.paletteSourceTitle,
        searchPlaceholder: t.paletteSourceSearch,
        reset: t.toolbarResetShelf,
        cancel: t.cancel,
        done: t.toolbarDone,
      }}
      meta={(
        <>
          <label className="compose-editor__shelf-field">
            <span>{t.paletteHeading}</span>
            <ComposeInput
              value={draft.title ?? ''}
              onChange={(event) => {
                const next = event.target.value
                // 空标题不写成空串：缺席表示「按来源取默认名」，空串会把标签抹成一片空白。
                setDraft({ ...draft, title: next.trim() === '' ? undefined : next })
              }}
            />
          </label>
          <label className="compose-editor__shelf-check">
            <input
              checked={draft.search === true}
              type="checkbox"
              onChange={(event) => setDraft({ ...draft, search: event.target.checked })}
            />
            <span>{t.paletteSearch}</span>
          </label>
        </>
      )}
      note={t.paletteSectionCount(draft.sections.length)}
      orientation="vertical"
      reorder={reorder}
      search={search}
      source={(
        <>
          {notOnShelf.length === 0 ? (
            <p className="compose-editor__shelf-empty">{t.paletteAllOnShelf}</p>
          ) : null}
          {notOnShelf.map((entry) => (
            <button
              className="compose-editor__shelf-source"
              data-palette-available={entry.key}
              data-shelf-ghost={session?.origin.zone === 'source' && session.origin.key === entry.key
                ? 'true'
                : undefined}
              key={entry.key}
              role="option"
              type="button"
              {...reorder.sourceItemProps(entry.key)}
              aria-selected={false}
            >
              <span className="compose-editor__shelf-grip" />
              <span className="compose-editor__shelf-source-name">{entry.label}</span>
            </button>
          ))}
        </>
      )}
      onClose={onClose}
      onReset={onReset}
      onSearchChange={setSearch}
      onSubmit={() => onSubmit(draft)}
    >
      {draft.sections.map((section, index) => (
        <Fragment key={section.id}>
          {caretAt === index ? <ShelfDropCaret /> : null}
          <div
            aria-selected={index === reorder.focusIndex}
            className="compose-editor__shelf-card"
            data-palette-section={section.id}
            role="option"
            tabIndex={-1}
            {...reorder.itemProps(index)}
            data-shelf-ghost={draggingIndex === index ? 'true' : undefined}
            onFocus={() => reorder.setFocusIndex(index)}
          >
            <div className="compose-editor__shelf-card-head">
              <span className="compose-editor__shelf-grip" />
              <span className="compose-editor__shelf-card-name">{titleOfSection(section)}</span>
              {section.kind === 'folder' && section.folderPath.length > 0 ? (
                <span className="compose-editor__shelf-crumb">{section.folderPath.join(' / ')}</span>
              ) : null}
            </div>
            {/*
              * 段的选项直接长在卡上。指针事件在这里要停下来——否则在一个开关上按下会被读成
              * 「抓起这一段」，用户拖不动那个滑块，而屏幕上没有任何东西解释为什么。
              */}
            <div
              className="compose-editor__shelf-card-body"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <label className="compose-editor__shelf-check">
                <input
                  checked={section.collapsed === true}
                  type="checkbox"
                  onChange={(event) => setDraft(updateComponentShelfSection(
                    draft,
                    section.id,
                    { collapsed: event.target.checked },
                  ))}
                />
                <span>{t.paletteCollapsed}</span>
              </label>
              {section.kind === 'folder' ? (
                <label className="compose-editor__shelf-check">
                  <input
                    checked={section.groupBy === 'subfolder'}
                    type="checkbox"
                    onChange={(event) => setDraft(
                      updateComponentShelfSection<ComposeComponentShelfFolderSection>(
                        draft,
                        section.id,
                        { groupBy: event.target.checked ? 'subfolder' : 'flat' },
                      ),
                    )}
                  />
                  <span>{t.paletteGroupBySubfolder}</span>
                </label>
              ) : (
                <fieldset className="compose-editor__shelf-presets">
                  <legend>{t.palettePresets}</legend>
                  {presets.map((preset) => {
                    const include = (section as ComposeComponentShelfPresetSection).include
                    return (
                      <label className="compose-editor__shelf-check" key={preset.id}>
                        <input
                          checked={include === undefined || include.includes(preset.id)}
                          type="checkbox"
                          onChange={(event) => setDraft(setComponentShelfPresetVisible({
                            shelf: draft,
                            sectionId: section.id,
                            presetId: preset.id,
                            visible: event.target.checked,
                            available: availablePresetIds,
                          }))}
                        />
                        <span>{preset.label}</span>
                      </label>
                    )
                  })}
                </fieldset>
              )}
            </div>
          </div>
        </Fragment>
      ))}
      {caretAt === draft.sections.length ? <ShelfDropCaret /> : null}
      {session?.point && dragLabel !== undefined ? (
        <ShelfDragImage
          badge={session.zone === 'source' && session.origin.zone === 'shelf' ? 'remove' : 'add'}
          point={session.point}
        >
          <span className="compose-editor__shelf-chip">{dragLabel}</span>
        </ShelfDragImage>
      ) : null}
    </ShelfDialogShell>
  )
}
