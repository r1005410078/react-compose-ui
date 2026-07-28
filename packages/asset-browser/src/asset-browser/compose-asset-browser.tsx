import {
  ComposeContextMenu,
  ComposeContextMenuContent,
  ComposeContextMenuItem,
  ComposeTree,
  useComposeContextMenu,
} from '@compose-ui/components'
import type { ComposeTreeItemAdapter } from '@compose-ui/components'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  ChangeEvent,
  CSSProperties,
  DragEvent as ReactDragEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import type {
  ComposeAssetBrowserProps,
  ComposeAssetCanvasDragItem,
} from '../asset-browser-types'
import {
  canvasImageMediaType,
} from '../asset-file-utils'
import {
  executeAssetBatch,
  normalizeComposeAssetError,
} from '@compose-ui/assets'
import {
  AssetPreview,
  AssetThumbnail,
} from '../asset-preview'
import { getAssetBrowserMessages } from '../asset-browser-i18n'
import type { AssetBrowserMessages } from '../asset-browser-i18n'
import type {
  ComposeAssetEntry,
  ComposeAssetOperationEvent,
  ComposeAssetProvider,
} from '@compose-ui/assets'
import {
  isFileSystemAssetProviderSupported,
  openFileSystemAssetProvider,
} from '../file-system-provider'
import { sortAssetEntries, useAssetSource } from '../use-asset-source'
import type { AssetTreeEntry } from '../use-asset-source'
import { useControlledList } from '../use-controlled-list'

const assetTreeAdapter: ComposeTreeItemAdapter<AssetTreeEntry> = {
  getChildren: (entry) => entry.children,
  getId: (entry) => entry.id,
  getLabel: (entry) => entry.name,
  hasChildren: (entry) => entry.kind === 'folder',
  canHaveChildren: (entry) => entry.kind === 'folder',
  // 文件使用原生 DragEvent 同时支持目录 move 与 Canvas copy；目录仍走 Tree Pointer move。
  canMove: (entry) => entry.kind === 'folder'
    && entry.parentId !== null
    && entry.capabilities?.move !== false,
}

type NameDialog = {
  readonly mode: 'file' | 'folder' | 'rename'
  readonly initialValue: string
} | null

function eventOf(
  type: ComposeAssetOperationEvent['type'],
  ids: readonly string[],
  succeeded = ids.length,
  failed = 0,
): ComposeAssetOperationEvent {
  return { type, entryIds: ids, succeeded, failed }
}

function capability(
  provider: ComposeAssetProvider,
  entry: ComposeAssetEntry | undefined,
  key: keyof ComposeAssetProvider['capabilities'],
) {
  return provider.capabilities[key] && entry?.capabilities?.[key] !== false
}

function FolderIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="M1.5 3.25h5l1.3 1.5h6.7v8H1.5z" fill="currentColor" opacity=".85" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="M3 1.5h6l4 4v9H3z" fill="none" stroke="currentColor" />
      <path d="M9 1.5v4h4" fill="none" stroke="currentColor" />
    </svg>
  )
}

interface NameDialogProps {
  readonly dialog: NonNullable<NameDialog>
  readonly messages: AssetBrowserMessages
  readonly onClose: () => void
  readonly onSubmit: (value: string) => void
}

function AssetNameDialog({ dialog, messages, onClose, onSubmit }: NameDialogProps) {
  const [value, setValue] = useState(dialog.initialValue)
  const title = dialog.mode === 'folder'
    ? messages.newFolder
    : dialog.mode === 'file'
      ? messages.newFile
      : messages.rename
  return (
    <div aria-labelledby="asset-name-dialog-title" aria-modal="true" className="asset-browser__dialog-layer" role="dialog">
      <form className="asset-browser__dialog" onSubmit={(event) => {
        event.preventDefault()
        onSubmit(value)
      }}>
        <h3 id="asset-name-dialog-title">{title}</h3>
        <label>
          <span>{messages.name}</span>
          <input autoFocus value={value} onChange={(event) => setValue(event.target.value)} />
        </label>
        <div className="asset-browser__dialog-actions">
          <button type="submit">{dialog.mode === 'rename' ? messages.rename : messages.create}</button>
          <button type="button" onClick={onClose}>{messages.cancel}</button>
        </div>
      </form>
    </div>
  )
}

/**
 * 渲染双栏资源管理、目录网格、安全文件预览和按需 Monaco 脚本编辑器。
 *
 * @remarks
 * 所有文件事实来自 Provider；组件只保存选择、展开、分隔条和编辑会话状态。
 *
 * @public
 */
export function ComposeAssetBrowser({
  provider: controlledProvider,
  selectedIds: controlledSelectedIds,
  defaultSelectedIds,
  onSelectionChange,
  expandedIds: controlledExpandedIds,
  defaultExpandedIds,
  onExpandedChange,
  onProviderChange,
  onOperation,
  onCanvasDrag,
  allowLocalDirectory = true,
  emptyState,
  className,
  style,
  ...htmlProps
}: ComposeAssetBrowserProps) {
  const theme = useComposeThemeContext()
  const i18n = useComposeI18nContext()
  const resolvedLocale = i18n?.locale ?? 'zh-CN'
  const messages = getAssetBrowserMessages(resolvedLocale, i18n?.formatMessage)
  const [localProvider, setLocalProvider] = useState<ComposeAssetProvider>()
  const provider = controlledProvider ?? localProvider
  const [selectedIds, setSelectedIds] = useControlledList(
    controlledSelectedIds,
    defaultSelectedIds,
    onSelectionChange,
  )
  const [expandedIds, setExpandedIds] = useControlledList(
    controlledExpandedIds,
    defaultExpandedIds,
    onExpandedChange,
  )
  const source = useAssetSource(provider, resolvedLocale)
  const loadFolder = source.loadFolder
  const [query, setQuery] = useState('')
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [nameDialog, setNameDialog] = useState<NameDialog>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<readonly string[] | null>(null)
  const [pendingDelete, setPendingDelete] = useState(false)
  const [saveRequest, setSaveRequest] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const contextMenu = useComposeContextMenu<string>()
  const [draggedIds, setDraggedIds] = useState<readonly string[]>([])
  const canvasDragRef = useRef<{
    lastPoint: { x: number; y: number }
    active: boolean
    internalDrop: boolean
  } | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const splitterRef = useRef<{ startX: number; width: number; pointerId: number } | null>(null)

  useEffect(() => {
    if (!provider) return
    if (selectedIds.length === 0) setSelectedIds([provider.root.id])
    if (!expandedIds.includes(provider.root.id)) setExpandedIds([...expandedIds, provider.root.id])
  }, [expandedIds, provider, selectedIds.length, setExpandedIds, setSelectedIds])

  useEffect(() => {
    for (const folderId of expandedIds) void loadFolder(folderId)
  }, [expandedIds, loadFolder])

  const selectedEntries = selectedIds
    .map((id) => source.entriesById.get(id))
    .filter((entry): entry is ComposeAssetEntry => Boolean(entry))
  const selectedEntry = selectedEntries.length === 1 ? selectedEntries[0] : undefined
  const folder = selectedEntry?.kind === 'folder'
    ? selectedEntry
    : selectedEntry?.parentId
      ? source.entriesById.get(selectedEntry.parentId)
      : provider?.root

  useEffect(() => {
    if (folder?.kind === 'folder') void loadFolder(folder.id)
  }, [folder?.id, folder?.kind, loadFolder])

  const folderChildren = useMemo(
    () => folder ? source.folders.get(folder.id) ?? [] : [],
    [folder, source.folders],
  )
  const visibleFolderChildren = useMemo(
    () => sortAssetEntries(folderChildren, resolvedLocale)
      .filter((entry) => entry.name.toLocaleLowerCase(resolvedLocale)
        .includes(query.toLocaleLowerCase(resolvedLocale))),
    [folderChildren, query, resolvedLocale],
  )

  const requestSelection = useCallback((next: readonly string[]) => {
    if (dirty && next.some((id) => !selectedIds.includes(id))) {
      setPendingSelection(next)
      return
    }
    setSelectedIds(next)
  }, [dirty, selectedIds, setSelectedIds])

  const handleDirtyChange = useCallback((nextDirty: boolean) => {
    setDirty(nextDirty)
    if (!nextDirty) {
      setPendingSelection((current) => {
        if (current) setSelectedIds(current)
        return null
      })
      setPendingDelete((current) => {
        if (current) setDeleteOpen(true)
        return false
      })
    }
  }, [setSelectedIds])

  const requestDelete = useCallback(() => {
    if (dirty) setPendingDelete(true)
    else setDeleteOpen(true)
  }, [dirty])

  const report = useCallback((event: ComposeAssetOperationEvent) => {
    onOperation?.(event)
    if (event.failed > 0) setNotice(messages.partial(event.succeeded, event.failed))
  }, [messages, onOperation])

  const refreshFolders = useCallback((ids: readonly string[]) => {
    const unique = [...new Set(ids.filter(Boolean))]
    source.invalidate(unique)
  }, [source])

  const submitName = useCallback(async (name: string) => {
    if (!provider || !nameDialog) return
    try {
      if (nameDialog.mode === 'folder' && folder && provider.createFolder) {
        const created = await provider.createFolder({ parentId: folder.id, name })
        refreshFolders([folder.id])
        report(eventOf('create', [created.id]))
      } else if (nameDialog.mode === 'file' && folder && provider.createFile) {
        const created = await provider.createFile({
          parentId: folder.id,
          name,
          content: new Blob([]),
        })
        refreshFolders([folder.id])
        requestSelection([created.id])
        report(eventOf('create', [created.id]))
      } else if (nameDialog.mode === 'rename' && selectedEntry && provider.renameEntry) {
        const renamed = await provider.renameEntry({ entryId: selectedEntry.id, name })
        refreshFolders([selectedEntry.parentId ?? provider.root.id])
        requestSelection([renamed.id])
        report(eventOf('rename', [renamed.id]))
      }
      setNameDialog(null)
      setNotice(null)
    } catch (error) {
      setNotice(messages.error(normalizeComposeAssetError(error).message))
    }
  }, [
    folder,
    messages,
    nameDialog,
    provider,
    refreshFolders,
    report,
    requestSelection,
    selectedEntry,
  ])

  const importAssetFiles = useCallback(async (files: readonly File[]) => {
    if (!provider?.createFile || !folder || files.length === 0) return
    const result = await executeAssetBatch(files, (file) => provider.createFile?.({
      parentId: folder.id,
      name: file.name,
      content: file,
    }) ?? Promise.reject(new Error('unsupported')))
    refreshFolders([folder.id])
    report(eventOf('import', files.map((file) => file.name), result.succeeded, result.failed))
  }, [folder, provider, refreshFolders, report])

  const importFiles = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    await importAssetFiles(files)
  }, [importAssetFiles])

  const deleteSelected = useCallback(async () => {
    if (!provider?.deleteEntry) return
    const entries = selectedEntries.filter((entry) => entry.parentId !== null)
    const result = await executeAssetBatch(entries, (entry) => provider.deleteEntry?.({
      entryId: entry.id,
      recursive: entry.kind === 'folder',
    }) ?? Promise.reject(new Error('unsupported')))
    refreshFolders(entries.map((entry) => entry.parentId ?? provider.root.id))
    requestSelection([folder?.id ?? provider.root.id])
    report(eventOf('delete', entries.map((entry) => entry.id), result.succeeded, result.failed))
    setDeleteOpen(false)
    setDirty(false)
  }, [folder?.id, provider, refreshFolders, report, requestSelection, selectedEntries])

  const connectLocal = useCallback(async () => {
    try {
      const nextProvider = await openFileSystemAssetProvider()
      setLocalProvider(nextProvider)
      onProviderChange?.(nextProvider)
      setSelectedIds([nextProvider.root.id])
      setExpandedIds([nextProvider.root.id])
    } catch (error) {
      setNotice(messages.error(normalizeComposeAssetError(error).message))
    }
  }, [messages, onProviderChange, setExpandedIds, setSelectedIds])

  const moveEntries = useCallback(async (
    itemIds: readonly string[],
    parentId: string | null,
  ) => {
    if (!provider?.moveEntry) return
    const targetId = parentId ?? provider.root.id
    const entries = itemIds
      .map((id) => source.entriesById.get(id))
      .filter((entry): entry is ComposeAssetEntry => Boolean(entry))
    const result = await executeAssetBatch(entries, (entry) => provider.moveEntry?.({
      entryId: entry.id,
      parentId: targetId,
    }) ?? Promise.reject(new Error('unsupported')))
    refreshFolders([...entries.map((entry) => entry.parentId ?? provider.root.id), targetId])
    const movedIds = result.results.flatMap((item) => (
      item.status === 'fulfilled' && item.value
        ? [(item.value as ComposeAssetEntry).id]
        : []
    ))
    if (movedIds.length > 0) requestSelection(movedIds)
    report(eventOf('move', itemIds, result.succeeded, result.failed))
  }, [provider, refreshFolders, report, requestSelection, source.entriesById])

  const canMoveTo = useCallback((itemIds: readonly string[], parentId: string | null) => {
    if (!provider?.moveEntry || !provider.capabilities.move) return false
    const targetId = parentId ?? provider.root.id
    const target = source.entriesById.get(targetId)
    if (!target || target.kind !== 'folder' || !capability(provider, target, 'move')) return false
    const moving = new Set(itemIds)
    let current: ComposeAssetEntry | undefined = target
    while (current) {
      if (moving.has(current.id)) return false
      current = current.parentId ? source.entriesById.get(current.parentId) : undefined
    }
    return itemIds.every((id) => {
      const entry = source.entriesById.get(id)
      return entry?.parentId !== null && capability(provider, entry, 'move')
    })
  }, [provider, source.entriesById])

  const canvasItemFor = useCallback((entry: ComposeAssetEntry) => {
    const mediaType = canvasImageMediaType(entry)
    if (
      !provider?.capabilities.reference
      || !provider.resolveAsset
      || entry.kind !== 'file'
      || !entry.assetKey
      || !mediaType
    ) return null
    return {
      reference: {
        providerId: provider.id,
        assetKey: entry.assetKey,
        scope: provider.referenceScope ?? 'persistent',
      },
      name: entry.name,
      mediaType,
    } satisfies ComposeAssetCanvasDragItem
  }, [provider])

  const startNativeDrag = useCallback((
    event: ReactDragEvent<HTMLElement>,
    entry: ComposeAssetEntry,
  ) => {
    if (!provider) return
    const candidates = selectedIds.includes(entry.id)
      ? selectedIds
        .map((id) => source.entriesById.get(id))
        .filter((candidate): candidate is ComposeAssetEntry => Boolean(candidate))
      : [entry]
    const moveIds = candidates
      .filter((candidate) => (
        candidate.parentId !== null && capability(provider, candidate, 'move')
      ))
      .map((candidate) => candidate.id)
    const items = candidates.flatMap((candidate) => {
      const item = canvasItemFor(candidate)
      return item ? [item] : []
    })
    setDraggedIds(moveIds)
    event.dataTransfer.effectAllowed = items.length > 0
      ? moveIds.length > 0 ? 'copyMove' : 'copy'
      : 'move'
    event.dataTransfer.setData('application/x-compose-asset-ids', moveIds.join('\n'))
    const point = { x: event.clientX, y: event.clientY }
    canvasDragRef.current = {
      lastPoint: point,
      active: items.length > 0,
      internalDrop: false,
    }
    if (items.length > 0) onCanvasDrag?.({ type: 'start', items, clientPoint: point })
  }, [canvasItemFor, onCanvasDrag, provider, selectedIds, source.entriesById])

  const moveNativeDrag = useCallback((event: ReactDragEvent<HTMLElement>) => {
    const session = canvasDragRef.current
    if (!session?.active || (event.clientX === 0 && event.clientY === 0)) return
    session.lastPoint = { x: event.clientX, y: event.clientY }
    onCanvasDrag?.({ type: 'move', clientPoint: session.lastPoint })
  }, [onCanvasDrag])

  const endNativeDrag = useCallback((event: ReactDragEvent<HTMLElement>) => {
    const session = canvasDragRef.current
    setDraggedIds([])
    canvasDragRef.current = null
    if (!session?.active || session.internalDrop) return
    const point = event.clientX === 0 && event.clientY === 0
      ? session.lastPoint
      : { x: event.clientX, y: event.clientY }
    onCanvasDrag?.({ type: 'end', clientPoint: point })
  }, [onCanvasDrag])

  const dropDraggedEntries = useCallback((
    event: ReactDragEvent<HTMLElement>,
    parentId: string | null,
  ) => {
    if (!canMoveTo(draggedIds, parentId)) return
    event.preventDefault()
    event.stopPropagation()
    const canvasSession = canvasDragRef.current
    if (canvasSession?.active) {
      canvasSession.internalDrop = true
      onCanvasDrag?.({ type: 'cancel' })
    }
    void moveEntries(draggedIds, parentId)
    setDraggedIds([])
  }, [canMoveTo, draggedIds, moveEntries, onCanvasDrag])

  if (!provider) {
    return (
      <div
        {...htmlProps}
        className={['asset-browser asset-browser--empty', className].filter(Boolean).join(' ')}
        data-compose-theme={theme?.resolvedTheme}
        data-compose-ui="asset-browser"
        lang={resolvedLocale}
        style={{
          ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
          ...style,
        } as CSSProperties}
      >
        {emptyState ?? (
          <div className="asset-browser__connect">
            <FolderIcon />
            <p>{messages.noProvider}</p>
            {allowLocalDirectory ? (
              isFileSystemAssetProviderSupported()
                ? <button type="button" onClick={() => void connectLocal()}>{messages.connect}</button>
                : <span>{messages.unsupportedLocal}</span>
            ) : null}
            {notice ? <div role="alert">{notice}</div> : null}
          </div>
        )}
      </div>
    )
  }

  const canCreateFile = Boolean(folder && provider.createFile && capability(provider, folder, 'createFile'))
  const canCreateFolder = Boolean(folder && provider.createFolder && capability(provider, folder, 'createFolder'))
  const canRename = Boolean(
    selectedEntry?.parentId !== null
    && provider.renameEntry
    && capability(provider, selectedEntry, 'rename'),
  )
  const canDelete = selectedEntries.some((entry) => (
    entry.parentId !== null && provider.deleteEntry && capability(provider, entry, 'delete')
  ))

  return (
    <div
      {...htmlProps}
      className={['asset-browser', className].filter(Boolean).join(' ')}
      data-compose-theme={theme?.resolvedTheme}
      data-compose-ui="asset-browser"
      lang={resolvedLocale}
      style={{
        ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
        ...style,
      } as CSSProperties}
      onKeyDown={(event) => {
        htmlProps.onKeyDown?.(event)
        if (event.defaultPrevented) return
        const target = event.target as HTMLElement
        if (
          target.matches('input, textarea, select')
          || target.isContentEditable
          || target.closest('.monaco-editor')
        ) return
        if (event.key === 'Delete' && canDelete) {
          event.preventDefault()
          requestDelete()
        } else if (event.key === 'F2' && canRename && selectedEntry) {
          event.preventDefault()
          setNameDialog({ mode: 'rename', initialValue: selectedEntry.name })
        }
      }}
      onDragOver={(event) => {
        if (canCreateFile && event.dataTransfer.types.includes('Files')) event.preventDefault()
      }}
      onDrop={(event) => {
        if (!canCreateFile) return
        event.preventDefault()
        void importAssetFiles([...event.dataTransfer.files])
      }}
    >
      <header className="asset-browser__toolbar">
        <strong>{provider.label}</strong>
        <button disabled={!canCreateFile} title={messages.newFile} type="button" onClick={() => setNameDialog({ mode: 'file', initialValue: 'untitled.ts' })}>＋F</button>
        <button disabled={!canCreateFolder} title={messages.newFolder} type="button" onClick={() => setNameDialog({ mode: 'folder', initialValue: 'New Folder' })}>＋▰</button>
        <button disabled={!canCreateFile} title={messages.import} type="button" onClick={() => importRef.current?.click()}>⇧</button>
        <button title={messages.refresh} type="button" onClick={() => folder && source.loadFolder(folder.id, true)}>↻</button>
        <button disabled={!canRename} title={messages.rename} type="button" onClick={() => selectedEntry && setNameDialog({ mode: 'rename', initialValue: selectedEntry.name })}>✎</button>
        <button disabled={!canDelete} title={messages.delete} type="button" onClick={requestDelete}>⌫</button>
        <input ref={importRef} hidden multiple type="file" onChange={(event) => void importFiles(event)} />
        <input
          aria-label={messages.search}
          className="asset-browser__search"
          placeholder={messages.search}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </header>
      {notice || source.error ? (
        <div className="asset-browser__notice" role="status">
          {notice ?? messages.error(source.error ?? '')}
          <button aria-label={messages.close} type="button" onClick={() => {
            setNotice(null)
            source.setError(null)
          }}>×</button>
        </div>
      ) : null}
      <div className="asset-browser__body">
        <aside className="asset-browser__tree-pane" style={{ width: sidebarWidth }}>
          {source.root ? (
            <ComposeTree
              adapter={assetTreeAdapter}
              aria-label={messages.tree}
              expandedIds={expandedIds}
              filter={query ? (entry) => entry.name.toLocaleLowerCase(resolvedLocale)
                .includes(query.toLocaleLowerCase(resolvedLocale)) : undefined}
              items={[source.root]}
              selectionMode="multiple"
              selectedIds={selectedIds}
              renderIcon={(context) => context.item.kind === 'folder' ? <FolderIcon /> : <FileIcon />}
              renderLabel={(context) => context.item.name}
              onActivate={(entry) => {
                if (entry.kind === 'folder') {
                  void source.loadFolder(entry.id)
                  if (!expandedIds.includes(entry.id)) setExpandedIds([...expandedIds, entry.id])
                }
              }}
              onExpandedChange={(ids) => {
                setExpandedIds(ids)
                for (const id of ids) void source.loadFolder(id)
              }}
              onMove={provider.capabilities.move && provider.moveEntry
                ? (operation) => void moveEntries(operation.itemIds, operation.parentId)
                : undefined}
              canDrop={(operation) => canMoveTo(operation.itemIds, operation.parentId)}
              getItemAttributes={(context) => context.item.kind === 'folder' ? {
                onDragOver: (event) => {
                  if (canMoveTo(draggedIds, context.item.id)) event.preventDefault()
                },
                onDrop: (event) => dropDraggedEntries(event, context.item.id),
              } : {
                draggable: Boolean(
                  capability(provider, context.item, 'move')
                  || canvasItemFor(context.item),
                ),
                onDragStart: (event) => startNativeDrag(event, context.item),
                onDrag: moveNativeDrag,
                onDragEnd: endNativeDrag,
              }}
              onItemContextMenu={(event, entry) => {
                event.preventDefault()
                if (!selectedIds.includes(entry.id)) requestSelection([entry.id])
                contextMenu.openAt(event, entry.id)
              }}
              onSelectionChange={requestSelection}
            />
          ) : null}
        </aside>
        <div
          ref={undefined}
          aria-label={messages.splitter}
          aria-orientation="vertical"
          aria-valuemax={560}
          aria-valuemin={180}
          aria-valuenow={sidebarWidth}
          className="asset-browser__splitter"
          role="separator"
          tabIndex={0}
          onKeyDown={(event) => {
            const delta = event.key === 'ArrowLeft' ? -16 : event.key === 'ArrowRight' ? 16 : 0
            if (delta) {
              event.preventDefault()
              setSidebarWidth((width) => Math.max(180, Math.min(560, width + delta)))
            }
          }}
          onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
            splitterRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              width: sidebarWidth,
            }
            event.currentTarget.setPointerCapture?.(event.pointerId)
          }}
          onPointerMove={(event) => {
            const drag = splitterRef.current
            if (!drag || drag.pointerId !== event.pointerId) return
            setSidebarWidth(Math.max(180, Math.min(560, drag.width + event.clientX - drag.startX)))
          }}
          onPointerUp={(event) => {
            if (splitterRef.current?.pointerId === event.pointerId) splitterRef.current = null
          }}
        />
        <main className="asset-browser__content">
          {selectedEntries.length > 1 ? (
            <div className="asset-browser__selection-summary">
              <strong>{messages.selected(selectedEntries.length)}</strong>
              <ul>{selectedEntries.map((entry) => <li key={entry.id}>{entry.name}</li>)}</ul>
            </div>
          ) : selectedEntry?.kind === 'file' ? (
            <AssetPreview
              entry={selectedEntry}
              locale={resolvedLocale}
              messages={messages}
              provider={provider}
              saveRequest={saveRequest}
              theme={theme?.resolvedTheme ?? 'dark'}
              onDirtyChange={handleDirtyChange}
              onSaved={(entry) => {
                report(eventOf('write', [entry.id]))
                refreshFolders([entry.parentId ?? provider.root.id])
              }}
            />
          ) : (
            <div aria-label={folder?.name} className="asset-browser__grid" role="grid">
              {source.loading.has(folder?.id ?? '') ? (
                <div role="row">
                  <div className="asset-browser__status" role="gridcell">{messages.loading}</div>
                </div>
              ) : visibleFolderChildren.length === 0 ? (
                <div role="row">
                  <div className="asset-browser__status" role="gridcell">{messages.emptyFolder}</div>
                </div>
              ) : visibleFolderChildren.map((entry) => (
                <div key={entry.id} role="row">
                  <button
                    aria-selected={selectedIds.includes(entry.id)}
                    className="asset-browser__asset-card"
                    draggable={Boolean(
                      capability(provider, entry, 'move') || canvasItemFor(entry),
                    )}
                    role="gridcell"
                    type="button"
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey) {
                        requestSelection(selectedIds.includes(entry.id)
                          ? selectedIds.filter((id) => id !== entry.id)
                          : [...selectedIds, entry.id])
                      } else {
                        requestSelection([entry.id])
                      }
                    }}
                    onDoubleClick={() => {
                      if (entry.kind === 'folder') {
                        void source.loadFolder(entry.id)
                        requestSelection([entry.id])
                        if (!expandedIds.includes(entry.id)) setExpandedIds([...expandedIds, entry.id])
                      }
                    }}
                    onDragStart={(event) => startNativeDrag(event, entry)}
                    onDrag={moveNativeDrag}
                    onDragEnd={endNativeDrag}
                    onDragOver={(event) => {
                      if (entry.kind === 'folder' && canMoveTo(draggedIds, entry.id)) {
                        event.preventDefault()
                      }
                    }}
                  onDrop={(event) => {
                    if (entry.kind === 'folder') dropDraggedEntries(event, entry.id)
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    if (!selectedIds.includes(entry.id)) requestSelection([entry.id])
                    contextMenu.openAt(event, entry.id)
                  }}
                >
                  <AssetThumbnail entry={entry} provider={provider} />
                  <span title={entry.name}>{entry.name}</span>
                </button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
      {nameDialog ? (
        <AssetNameDialog
          dialog={nameDialog}
          messages={messages}
          onClose={() => setNameDialog(null)}
          onSubmit={(value) => void submitName(value)}
        />
      ) : null}
      {deleteOpen ? (
        <div aria-labelledby="asset-delete-title" aria-modal="true" className="asset-browser__dialog-layer" role="alertdialog">
          <div className="asset-browser__dialog">
            <h3 id="asset-delete-title">{messages.confirmDelete}</h3>
            <p>{messages.deleteQuestion(selectedEntries.length)}</p>
            <div className="asset-browser__dialog-actions">
              <button type="button" onClick={() => void deleteSelected()}>{messages.delete}</button>
              <button type="button" onClick={() => setDeleteOpen(false)}>{messages.cancel}</button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingSelection || pendingDelete ? (
        <div aria-labelledby="asset-dirty-title" aria-modal="true" className="asset-browser__dialog-layer" role="alertdialog">
          <div className="asset-browser__dialog">
            <h3 id="asset-dirty-title">{messages.dirtyTitle}</h3>
            <p>{messages.dirtyQuestion(selectedEntry?.name ?? '')}</p>
            <div className="asset-browser__dialog-actions">
              <button type="button" onClick={() => setSaveRequest((value) => value + 1)}>{messages.save}</button>
              <button type="button" onClick={() => handleDirtyChange(false)}>{messages.discard}</button>
              <button type="button" onClick={() => {
                setPendingSelection(null)
                setPendingDelete(false)
              }}>{messages.cancel}</button>
            </div>
          </div>
        </div>
      ) : null}
      <ComposeContextMenu {...contextMenu.rootProps}>
        <ComposeContextMenuContent aria-label={messages.assets}>
          <ComposeContextMenuItem
            disabled={!canCreateFile}
            onClick={() => setNameDialog({ mode: 'file', initialValue: 'untitled.ts' })}
          >{messages.newFile}</ComposeContextMenuItem>
          <ComposeContextMenuItem
            disabled={!canCreateFolder}
            onClick={() => setNameDialog({ mode: 'folder', initialValue: 'New Folder' })}
          >{messages.newFolder}</ComposeContextMenuItem>
          <ComposeContextMenuItem
            disabled={!canRename}
            onClick={() => {
              const entry = contextMenu.payload ? source.entriesById.get(contextMenu.payload) : undefined
              if (entry) setNameDialog({ mode: 'rename', initialValue: entry.name })
            }}
          >{messages.rename}</ComposeContextMenuItem>
          <ComposeContextMenuItem
            disabled={!canDelete}
            variant="destructive"
            onClick={requestDelete}
          >{messages.delete}</ComposeContextMenuItem>
        </ComposeContextMenuContent>
      </ComposeContextMenu>
    </div>
  )
}
