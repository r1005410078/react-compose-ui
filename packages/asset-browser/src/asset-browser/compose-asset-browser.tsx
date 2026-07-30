import {
  ComposeConfirmDialog,
  ComposeTree,
  useComposeContextMenu,
} from '@compose-ui/components'
import type { ComposeTreeItemAdapter } from '@compose-ui/components'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import { AssetContextMenu } from './asset-context-menu'
import { AssetNamePromptDialog } from './asset-name-prompt'
import { useAssetNamePrompt } from './use-name-prompt'
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
import {
  COMPOSE_ASSET_REFERENCE_DRAG_MEDIA_TYPE,
} from '../asset-browser-types'
import type {
  ComposeAssetBrowserProps,
  ComposeAssetCanvasDragItem,
  ComposeAssetReferenceDragPayload,
  ComposeAssetContextMenuContext,
  ComposeAssetEntryRenderContext,
  ComposeAssetNamePromptRequest,
} from '../asset-browser-types'
import {
  canvasImageMediaType,
} from '../asset-file-utils'
import {
  executeAssetBatch,
  normalizeComposeAssetError,
} from '@compose-ui/assets'
import {
  AssetThumbnail,
} from '../asset-preview'
import { getAssetBrowserMessages } from '../asset-browser-i18n'
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

function ToolbarIcon({ name }: { readonly name: 'new-file' | 'new-folder' | 'import' | 'refresh' | 'rename' | 'delete' }) {
  const paths = {
    'new-file': <>
      <path d="M4 1.75h5l3 3v9.5H4z" />
      <path d="M9 1.75v3h3M8 8v4M6 10h4" />
    </>,
    'new-folder': <>
      <path d="M1.75 4h4.1l1.25 1.5h7.15v7.25H1.75z" />
      <path d="M10.5 7.75v4M8.5 9.75h4" />
    </>,
    import: <>
      <path d="M8 1.75v8.5M5 5l3 3 3-3M2.25 10.25v3h11.5v-3" />
    </>,
    refresh: <>
      <path d="M12.75 7.25A4.75 4.75 0 1 0 11.5 11.5" />
      <path d="M12.75 3.5v3.75H9" />
    </>,
    rename: <>
      <path d="m3 11.75 1.1-3.15 6.5-6.5 2.4 2.4-6.5 6.5zM9.5 3.1l2.4 2.4" />
    </>,
    delete: <>
      <path d="M3.25 4.25h9.5M6 4.25v-2h4v2M4.5 4.25l.65 9h5.7l.65-9M6.5 7v3.5M9.5 7v3.5" />
    </>,
  } as const
  return (
    <svg
      aria-hidden="true"
      className={`asset-browser__toolbar-icon asset-browser__toolbar-icon--${name}`}
      viewBox="0 0 16 16"
    >
      {paths[name]}
    </svg>
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
  onAssetOpen,
  onBeforeAssetMutation,
  onCanvasDrag,
  canDragEntryToCanvas,
  contextMenuItems,
  entryNaming,
  renderEntryIcon,
  renderEntryLabel,
  renderEntryBadge,
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
  const namePrompt = useAssetNamePrompt()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // payload 为 null 表示在空白区域右键：此时没有命中条目，新建操作落在当前目录。
  const contextMenu = useComposeContextMenu<string | null>()
  const [draggedIds, setDraggedIds] = useState<readonly string[]>([])
  const canvasDragRef = useRef<{
    lastPoint: { x: number; y: number }
    active: boolean
    internalDrop: boolean
  } | null>(null)
  /** 网格卡片右键后短时抑制兼容 click，避免误触选择。 */
  const suppressGridClickUntilRef = useRef(0)
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
    setSelectedIds(next)
  }, [setSelectedIds])

  const allowMutation = useCallback(async (
    type: 'rename' | 'move' | 'delete',
    entries: readonly ComposeAssetEntry[],
  ) => {
    if (!onBeforeAssetMutation) return true
    try {
      return await onBeforeAssetMutation({ type, entries }) !== false
    } catch {
      return false
    }
  }, [onBeforeAssetMutation])

  const requestDelete = useCallback(() => setDeleteOpen(true), [])

  const report = useCallback((event: ComposeAssetOperationEvent) => {
    onOperation?.(event)
    if (event.failed > 0) setNotice(messages.partial(event.succeeded, event.failed))
  }, [messages, onOperation])

  const refreshFolders = useCallback((ids: readonly string[]) => {
    const unique = [...new Set(ids.filter(Boolean))]
    source.invalidate(unique)
  }, [source])

  /** 渲染条目显示名；宿主未覆盖或返回空结果时使用原始名称。 */
  const renderLabelFor = (context: ComposeAssetEntryRenderContext) => {
    const label = renderEntryLabel?.(context)
    return label === undefined || label === null ? context.entry.name : label
  }

  /** 渲染条目主图标；宿主未覆盖或返回空结果时回退到内建目录/文件图标。 */
  const renderIconFor = (context: ComposeAssetEntryRenderContext) => {
    const icon = renderEntryIcon?.(context)
    if (icon !== undefined && icon !== null) return icon
    return context.entry.kind === 'folder' ? <FolderIcon /> : <FileIcon />
  }

  /**
   * 渲染宿主标记。
   *
   * @remarks
   * 容器只用 `pointer-events: none` 排除命中测试，不加 `aria-hidden` —— 标记承载「首页」这类
   * 语义，必须留在无障碍树里并成为条目可读名称的一部分。
   */
  const renderBadge = (context: ComposeAssetEntryRenderContext) => {
    const badge = renderEntryBadge?.(context)
    return badge === undefined || badge === null
      ? null
      : <span className="asset-browser__entry-badge">{badge}</span>
  }

  /**
   * 宿主菜单项求值与执行使用的上下文。
   *
   * @remarks
   * 命中条目取自菜单打开时记录的 payload；`parentId` 对目录取其自身，对文件取其父目录，
   * 使宿主的「新建」落在用户直觉上的位置。
   */
  const hostMenuContext = useMemo<ComposeAssetContextMenuContext | undefined>(() => {
    if (!contextMenuItems || contextMenuItems.length === 0) return undefined
    const entry = contextMenu.payload
      ? source.entriesById.get(contextMenu.payload)
      : undefined
    const entries = entry && !selectedIds.includes(entry.id)
      ? [entry]
      : selectedEntries.length > 0 ? selectedEntries : entry ? [entry] : []
    const parentId = entry
      ? entry.kind === 'folder' ? entry.id : entry.parentId
      : folder?.id ?? null
    return {
      entry,
      entries,
      parentId: parentId === provider?.root.id ? null : parentId,
      promptName: async (request: ComposeAssetNamePromptRequest) => namePrompt.promptName({
        title: request.title,
        initialValue: request.initialValue,
        confirmLabel: request.confirmLabel ?? messages.create,
      }),
      refresh: (target) => {
        refreshFolders([target ?? parentId ?? provider?.root.id ?? ''])
      },
    }
  }, [
    contextMenu.payload,
    contextMenuItems,
    folder?.id,
    messages,
    namePrompt,
    provider?.root.id,
    refreshFolders,
    selectedEntries,
    selectedIds,
    source.entriesById,
  ])

  /**
   * 执行一次命名提交。
   *
   * @remarks
   * 成功时关闭对话框并清除提示；失败时保留对话框，使用户能就地修正名称重试。
   * `mutate` 返回 false 表示操作被宿主否决，此时同样保留对话框。
   */
  const runNamedMutation = useCallback(async (mutate: () => Promise<boolean>) => {
    try {
      if (!await mutate()) return
      namePrompt.close()
      setNotice(null)
    } catch (error) {
      setNotice(messages.error(normalizeComposeAssetError(error).message))
    }
  }, [messages, namePrompt])

  const promptCreateFolder = useCallback(() => {
    namePrompt.open(
      { title: messages.newFolder, initialValue: 'New Folder', confirmLabel: messages.create },
      (name) => void runNamedMutation(async () => {
        if (!folder || !provider?.createFolder) return true
        const created = await provider.createFolder({ parentId: folder.id, name })
        refreshFolders([folder.id])
        report(eventOf('create', [created.id]))
        return true
      }),
    )
  }, [folder, messages, namePrompt, provider, refreshFolders, report, runNamedMutation])

  const promptCreateFile = useCallback(() => {
    namePrompt.open(
      { title: messages.newFile, initialValue: 'untitled.ts', confirmLabel: messages.create },
      (name) => void runNamedMutation(async () => {
        if (!folder || !provider?.createFile) return true
        const created = await provider.createFile({
          parentId: folder.id,
          name,
          content: new Blob([]),
        })
        refreshFolders([folder.id])
        requestSelection([created.id])
        report(eventOf('create', [created.id]))
        return true
      }),
    )
  }, [
    folder,
    messages,
    namePrompt,
    provider,
    refreshFolders,
    report,
    requestSelection,
    runNamedMutation,
  ])

  const promptRename = useCallback((entry: ComposeAssetEntry) => {
    namePrompt.open(
      {
        title: messages.rename,
        // 宿主的命名约定（如页面后缀）不进入输入框。
        initialValue: entryNaming?.toEditableName?.(entry) ?? entry.name,
        confirmLabel: messages.rename,
      },
      (editableName) => void runNamedMutation(async () => {
        if (!provider?.renameEntry) return true
        // 宿主否决重命名时保留对话框，与内建新建路径的「守卫不满足即关闭」不同。
        if (!await allowMutation('rename', [entry])) return false
        const name = entryNaming?.toStoredName?.(entry, editableName) ?? editableName
        const renamed = await provider.renameEntry({ entryId: entry.id, name })
        refreshFolders([entry.parentId ?? provider.root.id])
        requestSelection([renamed.id])
        report(eventOf('rename', [renamed.id]))
        return true
      }),
    )
  }, [
    allowMutation,
    entryNaming,
    messages,
    namePrompt,
    provider,
    refreshFolders,
    report,
    requestSelection,
    runNamedMutation,
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
    if (!await allowMutation('delete', entries)) {
      setDeleteOpen(false)
      return
    }
    const result = await executeAssetBatch(entries, (entry) => provider.deleteEntry?.({
      entryId: entry.id,
      recursive: entry.kind === 'folder',
    }) ?? Promise.reject(new Error('unsupported')))
    refreshFolders(entries.map((entry) => entry.parentId ?? provider.root.id))
    requestSelection([folder?.id ?? provider.root.id])
    report(eventOf('delete', entries.map((entry) => entry.id), result.succeeded, result.failed))
    setDeleteOpen(false)
  }, [allowMutation, folder?.id, provider, refreshFolders, report, requestSelection, selectedEntries])

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
    if (!await allowMutation('move', entries)) return
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
  }, [allowMutation, provider, refreshFolders, report, requestSelection, source.entriesById])

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
    if (
      !provider?.capabilities.reference
      || !provider.resolveAsset
      || entry.kind !== 'file'
      || !entry.assetKey
    ) return null
    // 宿主判定优先；未提供时保持仅受支持图片可拖的内建白名单。
    const mediaType = canDragEntryToCanvas === undefined
      ? canvasImageMediaType(entry)
      : canDragEntryToCanvas(entry)
        ? entry.mediaType ?? 'application/octet-stream'
        : undefined
    if (!mediaType) return null
    return {
      reference: {
        providerId: provider.id,
        assetKey: entry.assetKey,
        scope: provider.referenceScope ?? 'persistent',
      },
      name: entry.name,
      mediaType,
    } satisfies ComposeAssetCanvasDragItem
  }, [canDragEntryToCanvas, provider])

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
    // 引用载荷与移动 ID 载荷相互独立：条目不可移动时前者仍然写入，宿主据此获得稳定引用。
    if (items.length > 0) {
      event.dataTransfer.setData(
        COMPOSE_ASSET_REFERENCE_DRAG_MEDIA_TYPE,
        JSON.stringify({ version: 1, items } satisfies ComposeAssetReferenceDragPayload),
      )
    }
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
          promptRename(selectedEntry)
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
        <strong title={provider.label}>{provider.label}</strong>
        <div className="asset-browser__toolbar-actions">
          <button aria-label={messages.newFile} disabled={!canCreateFile} title={messages.newFile} type="button" onClick={promptCreateFile}><ToolbarIcon name="new-file" /></button>
          <button aria-label={messages.newFolder} disabled={!canCreateFolder} title={messages.newFolder} type="button" onClick={promptCreateFolder}><ToolbarIcon name="new-folder" /></button>
          <button aria-label={messages.import} disabled={!canCreateFile} title={messages.import} type="button" onClick={() => importRef.current?.click()}><ToolbarIcon name="import" /></button>
          <button aria-label={messages.refresh} title={messages.refresh} type="button" onClick={() => folder && source.loadFolder(folder.id, true)}><ToolbarIcon name="refresh" /></button>
          <button aria-label={messages.rename} disabled={!canRename} title={messages.rename} type="button" onClick={() => selectedEntry && promptRename(selectedEntry)}><ToolbarIcon name="rename" /></button>
          <button aria-label={messages.delete} disabled={!canDelete} title={messages.delete} type="button" onClick={requestDelete}><ToolbarIcon name="delete" /></button>
        </div>
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
        <aside
          className="asset-browser__tree-pane"
          style={{ width: sidebarWidth }}
          onContextMenu={(event) => {
            // 树行会 stopPropagation，因此这里只会收到文件树空白区域的右键。
            event.preventDefault()
            contextMenu.openAt(event, null)
          }}
        >
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
              renderIcon={(context) => renderIconFor({
                entry: context.item,
                surface: 'tree',
                selected: context.selected,
                expanded: context.expanded,
              })}
              renderLabel={(context) => (
                <>
                  {renderLabelFor({
                    entry: context.item,
                    surface: 'tree',
                    selected: context.selected,
                    expanded: context.expanded,
                  })}
                  {renderBadge({
                    entry: context.item,
                    surface: 'tree',
                    selected: context.selected,
                    expanded: context.expanded,
                  })}
                </>
              )}
              onActivate={(entry) => {
                if (entry.kind === 'folder') {
                  void source.loadFolder(entry.id)
                  if (!expandedIds.includes(entry.id)) setExpandedIds([...expandedIds, entry.id])
                } else {
                  onAssetOpen?.(entry)
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
                event.stopPropagation()
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
        <main
          className="asset-browser__content"
          onContextMenu={(event) => {
            // 条目行与卡片都会 stopPropagation，因此这里只会收到空白区域的右键。
            event.preventDefault()
            suppressGridClickUntilRef.current = performance.now() + 400
            contextMenu.openAt(event, null)
          }}
        >
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
                      // 右键菜单会在少数浏览器/嵌入宿主中伴随兼容 click（含 button=0）。
                      // 资源卡片普通选择仅接受主键，并在右键窗口内忽略补发 click。
                      if (event.button !== 0) return
                      if (performance.now() < suppressGridClickUntilRef.current) return
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
                      } else {
                        onAssetOpen?.(entry)
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
                    event.stopPropagation()
                    suppressGridClickUntilRef.current = performance.now() + 400
                    if (!selectedIds.includes(entry.id)) requestSelection([entry.id])
                    contextMenu.openAt(event, entry.id)
                  }}
                >
                  <AssetThumbnail
                    entry={entry}
                    fallback={renderEntryIcon?.({
                      entry,
                      surface: 'grid',
                      selected: selectedIds.includes(entry.id),
                      expanded: false,
                    })}
                    provider={provider}
                  />
                  <span title={entry.name}>
                    {renderLabelFor({
                      entry,
                      surface: 'grid',
                      selected: selectedIds.includes(entry.id),
                      expanded: false,
                    })}
                    {renderBadge({
                      entry,
                      surface: 'grid',
                      selected: selectedIds.includes(entry.id),
                      expanded: false,
                    })}
                  </span>
                </button>
                </div>
              ))}
          </div>
        </main>
      </div>
      {namePrompt.state ? (
        <AssetNamePromptDialog
          messages={messages}
          request={namePrompt.state.request}
          onClose={namePrompt.close}
          onSubmit={namePrompt.state.onSubmit}
        />
      ) : null}
      {deleteOpen ? (
        <ComposeConfirmDialog
          cancelLabel={messages.cancel}
          confirmLabel={messages.delete}
          description={messages.deleteQuestion(selectedEntries.length)}
          destructive
          open={deleteOpen}
          title={messages.confirmDelete}
          onConfirm={() => void deleteSelected()}
          onOpenChange={setDeleteOpen}
        />
      ) : null}
      <AssetContextMenu
        capabilities={{ canCreateFile, canCreateFolder, canRename, canDelete }}
        contextMenu={contextMenu}
        hostContext={hostMenuContext}
        hostItems={contextMenuItems}
        messages={messages}
        onCreateFile={promptCreateFile}
        onCreateFolder={promptCreateFolder}
        onDelete={requestDelete}
        onRename={() => {
          const entry = contextMenu.payload ? source.entriesById.get(contextMenu.payload) : undefined
          if (entry) promptRename(entry)
        }}
      />
    </div>
  )
}
