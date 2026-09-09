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
  ComposeInput,
} from '@compose-ui/components'
import {
  addComponentShelfSection,
  moveComponentShelfSection,
  removeComponentShelfSection,
  setComponentShelfPresetVisible,
  updateComponentShelfSection,
} from '@compose-ui/component-library'
import type {
  ComposeComponentShelf,
  ComposeComponentShelfFolderSection,
  ComposeComponentShelfPresetSection,
} from '@compose-ui/component-library'
import { getEditorMessages } from '../editor-i18n'

/** 目录里一个基础 Preset 的可呈现半边。 */
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
   * 资源里存在的全部文件夹路径；「未放入」那一列由它减去已经在货架上的得到。
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

/** 根文件夹（空路径）在两列里都要有个名字，否则它渲染成一个空按钮。 */
function folderKey(path: readonly string[]) {
  return `folder:${path.join('/')}`
}

/**
 * 自定义物料面板：与 `ToolbarShelfDialog` 同一套两列 + 按钮，加上一块「选中这一段的选项」。
 *
 * @remarks
 * **排序同样不做 HTML5 拖放**，理由与工具栏那份逐字相同：可重排列表按仓库规则无论如何要写
 * 一遍完整的键盘重排，先写按钮那一份；拖放是它之上的增强而不是替代。两个货架一套做法。
 *
 * 多出来的那一块是因为**段本身带选项**（文件夹的分组方式、基础组件列哪几个），而工具栏的一格
 * 只有「在不在、排第几」。它跟着选中的段走而不是每段都摊开——三段各摊四个开关时，用户读不出
 * 哪个开关管的是哪一段。
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
  // 段有稳定 id，因此选中项按 id 记——与工具栏那边按下标记是有意的差别（那边分隔线认不出）。
  const [selected, setSelected] = useState<string | null>(draft.sections[0]?.id ?? null)
  const [available, setAvailable] = useState<string | null>(null)

  const section = draft.sections.find((entry) => entry.id === selected) ?? null
  const index = draft.sections.findIndex((entry) => entry.id === selected)
  const availablePresetIds = presets.map((preset) => preset.id)

  const labelOfSection = (id: string) => {
    const entry = draft.sections.find((candidate) => candidate.id === id)
    if (!entry) return id
    if (entry.title) return entry.title
    if (entry.kind === 'presets') return t.paletteBasicsSource
    return entry.folderPath.length === 0
      ? t.paletteRootFolder
      : entry.folderPath[entry.folderPath.length - 1]!
  }

  // 「未放入」= 还没上架的基础组件段（至多一个）加上资源里还没上架的每个文件夹。
  const hasPresets = draft.sections.some((entry) => entry.kind === 'presets')
  const shelfFolders = new Set(
    draft.sections
      .filter((entry): entry is ComposeComponentShelfFolderSection => entry.kind === 'folder')
      .map((entry) => folderKey(entry.folderPath)),
  )
  const notOnShelf: readonly { readonly key: string; readonly label: string }[] = [
    ...(hasPresets ? [] : [{ key: 'presets:basics', label: t.paletteBasicsSource }]),
    ...[[] as readonly string[], ...folders]
      .filter((path) => !shelfFolders.has(folderKey(path)))
      .map((path) => ({
        key: folderKey(path),
        label: path.length === 0 ? t.paletteRootFolder : path.join(' / '),
      })),
  ]

  const move = (delta: -1 | 1) => {
    if (selected === null) return
    setDraft(moveComponentShelfSection(draft, selected, delta))
  }

  const addSelected = () => {
    if (available === null) return
    if (available === 'presets:basics') {
      setDraft(addComponentShelfSection(draft, { kind: 'presets', id: 'basics' }))
    }
    else {
      const path = available.slice('folder:'.length)
      const folderPath = path === '' ? [] : path.split('/')
      setDraft(addComponentShelfSection(draft, {
        kind: 'folder',
        // id 由路径推出，因此同一个文件夹加两次会被 `addComponentShelfSection` 挡下。
        id: folderPath.length === 0 ? 'components' : folderPath.join('-'),
        folderPath,
      }))
    }
    setAvailable(null)
  }

  return (
    <ComposeDialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <ComposeDialogPortal>
        <ComposeDialogBackdrop />
        <ComposeDialogViewport>
          <ComposeDialogContent>
            <ComposeDialogHeader>
              <ComposeDialogTitle>{t.paletteTitle}</ComposeDialogTitle>
              <ComposeDialogDescription>{t.paletteDescription}</ComposeDialogDescription>
            </ComposeDialogHeader>
            <div className="compose-editor__shelf-panel">
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
            </div>
            <div className="compose-editor__shelf-dialog">
              <div className="compose-editor__shelf-column">
                <h3 id="compose-palette-on">{t.paletteSections}</h3>
                <ul aria-labelledby="compose-palette-on" className="compose-editor__shelf-list" role="listbox">
                  {draft.sections.map((entry) => (
                    <li key={entry.id}>
                      <button
                        aria-selected={entry.id === selected}
                        data-palette-section={entry.id}
                        role="option"
                        type="button"
                        onClick={() => setSelected(entry.id)}
                      >
                        {labelOfSection(entry.id)}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="compose-editor__shelf-actions">
                  <ComposeButton
                    disabled={index <= 0}
                    type="button"
                    variant="outline"
                    onClick={() => move(-1)}
                  >
                    {t.toolbarMoveUp}
                  </ComposeButton>
                  <ComposeButton
                    disabled={index < 0 || index >= draft.sections.length - 1}
                    type="button"
                    variant="outline"
                    onClick={() => move(1)}
                  >
                    {t.toolbarMoveDown}
                  </ComposeButton>
                  <ComposeButton
                    disabled={selected === null}
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (selected === null) return
                      const next = removeComponentShelfSection(draft, selected)
                      setDraft(next)
                      setSelected(next.sections[Math.max(0, index - 1)]?.id ?? null)
                    }}
                  >
                    {t.toolbarRemoveItem}
                  </ComposeButton>
                </div>
              </div>
              <div className="compose-editor__shelf-column">
                <h3 id="compose-palette-off">{t.paletteAvailable}</h3>
                <ul aria-labelledby="compose-palette-off" className="compose-editor__shelf-list" role="listbox">
                  {notOnShelf.map((entry) => (
                    <li key={entry.key}>
                      <button
                        aria-selected={entry.key === available}
                        data-palette-available={entry.key}
                        role="option"
                        type="button"
                        onClick={() => setAvailable(entry.key)}
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
                    onClick={addSelected}
                  >
                    {t.paletteAddFolder}
                  </ComposeButton>
                </div>
              </div>
            </div>
            {section ? (
              <div className="compose-editor__shelf-panel" data-palette-options={section.id}>
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
                    {presets.map((preset) => (
                      <label className="compose-editor__shelf-check" key={preset.id}>
                        <input
                          checked={(section as ComposeComponentShelfPresetSection).include === undefined
                            || (section as ComposeComponentShelfPresetSection).include!.includes(preset.id)}
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
                    ))}
                  </fieldset>
                )}
              </div>
            ) : null}
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
