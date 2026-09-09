import { useState } from 'react'
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
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { useWorkspaceContent } from './workspace-context'
import { getEditorMessages } from '../editor-i18n'
import { COMPOSE_TOOLBAR_CATALOG, useComposeToolbarShelf } from '../stage-toolbar/toolbar-shelf'
import { ToolbarShelfDialog } from './toolbar-shelf-dialog'
import { PaletteShelfDialog } from './palette-shelf-dialog'
import { COMPOSE_DEFAULT_COMPONENT_SHELF } from '@compose-ui/component-library'

/**
 * 工作区管理的三个对话框：另存为、重命名、删除确认。
 *
 * @remarks
 * 由会话句柄的 `dialog` 驱动：菜单与命令行（`workspace.saveAs`）打开的是同一个。另存为只问名字，
 * 并列出复制的内容——用户不看源码也知道「另存」带走了什么；重名不拦，自动加序号。删除不可
 * 撤销，因此要确认，确认框写明记着它的文档数与回退去处：那是用户知道后果的唯一一处。
 * @internal
 */
export function WorkspaceDialogs() {
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)
  const { workspace, paletteCatalog } = useWorkspaceContent()
  const { dialog, current } = workspace
  const { items: injectedToolbarItems } = useComposeToolbarShelf()
  if (dialog === null) return null

  const close = () => workspace.closeDialog()
  const t = messages.workspaces
  if (dialog === 'delete') {
    const fallback = workspace.fallbackFor(current.id)
    return (
      <ComposeDialog open onOpenChange={(open) => { if (!open) close() }}>
        <ComposeDialogPortal>
          <ComposeDialogBackdrop />
          <ComposeDialogViewport>
            <ComposeDialogContent>
              <ComposeDialogHeader>
                <ComposeDialogTitle>{messages.workspaceDeleteTitle(current.title)}</ComposeDialogTitle>
                <ComposeDialogDescription>
                  {t.deleteDescription}
                  {' '}
                  {messages.workspaceDeleteImpact(workspace.documentsRemembering(current.id), fallback.title)}
                </ComposeDialogDescription>
              </ComposeDialogHeader>
              <ComposeDialogFooter>
                <ComposeButton type="button" variant="outline" onClick={close}>{t.cancel}</ComposeButton>
                <ComposeButton type="button" onClick={() => workspace.remove()}>{t.remove}</ComposeButton>
              </ComposeDialogFooter>
            </ComposeDialogContent>
          </ComposeDialogViewport>
        </ComposeDialogPortal>
      </ComposeDialog>
    )
  }

  if (dialog === 'toolbar') {
    const stageToolbar = messages.stageToolbar as unknown as Record<string, string>
    const catalog = [
      ...COMPOSE_TOOLBAR_CATALOG.map(([id, key]) => ({ id, label: stageToolbar[key] ?? id })),
      // 宿主注入的目录项一并列出：它们同样能上下架，只是来源不同。
      ...(injectedToolbarItems ?? []).map((item) => ({ id: item.id, label: item.label })),
    ]
    return (
      <ToolbarShelfDialog
        catalog={catalog}
        shelf={workspace.toolbar ?? catalog.map((entry) => entry.id)}
        onClose={close}
        onReset={() => workspace.reset()}
        onSubmit={(shelf) => workspace.setToolbarShelf(shelf)}
      />
    )
  }

  if (dialog === 'palette') {
    return (
      <PaletteShelfDialog
        folders={paletteCatalog?.folders ?? []}
        presets={paletteCatalog?.presets ?? []}
        shelf={workspace.palette ?? COMPOSE_DEFAULT_COMPONENT_SHELF}
        onClose={close}
        onReset={() => workspace.reset()}
        onSubmit={(shelf) => workspace.setPaletteShelf(shelf)}
      />
    )
  }

  // 名字输入框按对话框种类重挂载：每次打开都从当前工作区的名字起步，不需要在 effect 里同步。
  return (
    <WorkspaceNameDialog
      key={dialog}
      initialName={current.title}
      kind={dialog}
      onClose={close}
      onSubmit={(name) => { if (dialog === 'saveAs') workspace.saveAs(name); else workspace.rename(name) }}
    />
  )
}

function WorkspaceNameDialog({
  initialName,
  kind,
  onClose,
  onSubmit,
}: {
  readonly initialName: string
  readonly kind: 'saveAs' | 'rename'
  readonly onClose: () => void
  readonly onSubmit: (name: string) => void
}) {
  const i18n = useComposeI18nContext()
  const t = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage).workspaces
  const [name, setName] = useState(initialName)
  const isSaveAs = kind === 'saveAs'
  const close = onClose
  const submit = () => {
    if (name.trim() === '') return
    onSubmit(name)
  }
  return (
    <ComposeDialog open onOpenChange={(open) => { if (!open) close() }}>
      <ComposeDialogPortal>
        <ComposeDialogBackdrop />
        <ComposeDialogViewport>
          <ComposeDialogContent>
            <ComposeDialogHeader>
              <ComposeDialogTitle>{isSaveAs ? t.saveAsTitle : t.renameTitle}</ComposeDialogTitle>
              {isSaveAs ? (
                <ComposeDialogDescription>{t.saveAsDescription}</ComposeDialogDescription>
              ) : null}
            </ComposeDialogHeader>
            {isSaveAs ? (
              <ul className="compose-editor__workspace-copies">
                <li>{t.copiesLayout}</li>
                <li>{t.copiesSession}</li>
              </ul>
            ) : null}
            <ComposeInput
              aria-label={t.nameLabel}
              autoFocus
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') submit() }}
            />
            <ComposeDialogFooter>
              <ComposeButton type="button" variant="outline" onClick={close}>{t.cancel}</ComposeButton>
              <ComposeButton type="button" disabled={name.trim() === ''} onClick={submit}>
                {isSaveAs ? t.create : t.confirm}
              </ComposeButton>
            </ComposeDialogFooter>
          </ComposeDialogContent>
        </ComposeDialogViewport>
      </ComposeDialogPortal>
    </ComposeDialog>
  )
}
