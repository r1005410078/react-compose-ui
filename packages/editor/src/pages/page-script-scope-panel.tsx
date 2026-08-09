import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
import type { ComposePageSetupReference } from '@compose-ui/core'
import {
  ComposeContextMenu,
  ComposeContextMenuContent,
  ComposeContextMenuItem,
  useComposeContextMenu,
} from '@compose-ui/components'
import type { ComposePageScriptScope } from '@compose-ui/script-runtime'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import { getEditorMessages } from '../editor-i18n'
import { DEFAULT_PAGE_SETUP_SCRIPT } from './page-context-menu'
import { isComposePageSetupScriptName } from './page-script-intelligence'

const EMPTY_SNAPSHOT = { exports: [], diagnostics: [], disposed: false } as const
const subscribeEmpty = () => () => undefined
const getEmptySnapshot = () => EMPTY_SNAPSHOT

/** Canvas Inspector 页面脚本属性的 Editor 侧输入。 @internal */
export interface PageScriptScopePanelProps {
  readonly pageName: string
  readonly pageParentId: string
  readonly provider: ComposeAssetProvider
  readonly reference: ComposePageSetupReference | null
  readonly scope?: ComposePageScriptScope
  readonly onReload: () => Promise<void>
  readonly onSetupChange: (reference: ComposePageSetupReference | null) => Promise<void>
  readonly onOpen: (entry: ComposeAssetEntry) => void
  readonly onError: (message: string) => void
}

function displayValue(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    const serialized = JSON.stringify(value)
    return serialized === undefined ? String(value) : serialized
  }
  catch {
    return String(value)
  }
}

function referenceEntry(
  reference: ComposePageSetupReference,
  parentId: string,
): ComposeAssetEntry {
  return {
    id: reference.assetKey,
    parentId,
    name: reference.assetKey.split('/').pop() ?? reference.assetKey,
    kind: 'file',
    mediaType: 'text/javascript',
    assetKey: reference.assetKey,
  }
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  )
}

function ReloadIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M20 11a8 8 0 1 0-2.35 5.65M20 4v7h-7" />
    </svg>
  )
}

function AddIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/** 当前页面 setup 的选择、快捷创建、返回成员与运行诊断。 @internal */
export function PageScriptScopePanel({
  onError,
  onOpen,
  onReload,
  onSetupChange,
  pageName,
  pageParentId,
  provider,
  reference,
  scope,
}: PageScriptScopePanelProps) {
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(
    i18n?.locale ?? 'zh-CN',
    i18n?.formatMessage,
  ).pages
  const contentId = useId()
  const actionsMenu = useComposeContextMenu<'page-script'>()
  const snapshot = useSyncExternalStore(
    scope?.subscribe ?? subscribeEmpty,
    scope?.getSnapshot ?? getEmptySnapshot,
    scope?.getSnapshot ?? getEmptySnapshot,
  )
  const [entries, setEntries] = useState<readonly ComposeAssetEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const loadEntries = useCallback(async (signal?: AbortSignal) => {
    try {
      const listed = await provider.list({ folderId: pageParentId, signal })
      if (signal?.aborted) return
      setEntries(listed
        .filter((entry) => entry.kind === 'file'
          && entry.assetKey !== undefined
          && isComposePageSetupScriptName(entry.name))
        .sort((left, right) => left.name.localeCompare(right.name)))
    }
    catch {
      if (signal?.aborted) return
      onError(messages.setupListFailed)
    }
    finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [messages.setupListFailed, onError, pageParentId, provider])

  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadEntries(controller.signal)
    })
    const unsubscribe = provider.subscribe?.(() => {
      setLoading(true)
      void loadEntries(controller.signal)
    })
    return () => {
      controller.abort()
      unsubscribe?.()
    }
  }, [loadEntries, provider])

  const currentEntry = useMemo(() => {
    if (!reference) return undefined
    return entries.find((entry) => entry.assetKey === reference.assetKey)
      ?? referenceEntry(reference, pageParentId)
  }, [entries, pageParentId, reference])
  const canChange = provider.capabilities.write !== false
    && typeof provider.writeFile === 'function'
  const canCreate = canChange
    && provider.capabilities.createFile !== false
    && typeof provider.createFile === 'function'
  const currentValue = reference?.providerId === provider.id ? reference.assetKey : ''
  const selectableEntries = currentEntry
    && !entries.some((entry) => entry.assetKey === currentEntry.assetKey)
    ? [currentEntry, ...entries]
    : entries

  const chooseScript = async (assetKey: string) => {
    const entry = selectableEntries.find((candidate) => candidate.assetKey === assetKey)
    if (!entry?.assetKey || entry.assetKey === reference?.assetKey) return
    setBusy(true)
    try {
      await onSetupChange({
        providerId: provider.id,
        assetKey: entry.assetKey,
        scope: provider.referenceScope ?? 'persistent',
      })
    }
    catch {
      onError(messages.setupOperationFailed)
    }
    finally {
      setBusy(false)
    }
  }

  const createScript = async () => {
    if (!provider.createFile) return
    setBusy(true)
    let created: ComposeAssetEntry | undefined
    try {
      created = await provider.createFile({
        parentId: pageParentId,
        name: `${pageName}.setup.js`,
        content: new Blob([DEFAULT_PAGE_SETUP_SCRIPT], { type: 'text/javascript' }),
      })
      if (!created.assetKey) throw new Error('创建的脚本缺少稳定 assetKey')
      await onSetupChange({
        providerId: provider.id,
        assetKey: created.assetKey,
        scope: provider.referenceScope ?? 'persistent',
      })
      const normalizedCreated = {
        ...created,
        mediaType: created.mediaType ?? 'text/javascript',
      }
      setEntries((current) => current.some((entry) => entry.assetKey === normalizedCreated.assetKey)
        ? current
        : [...current, normalizedCreated])
      onOpen(normalizedCreated)
    }
    catch {
      onError(created ? messages.setupOrphaned : messages.setupOperationFailed)
    }
    finally {
      setBusy(false)
    }
  }

  const unlinkScript = async () => {
    setBusy(true)
    try {
      await onSetupChange(null)
    }
    catch {
      onError(messages.setupOperationFailed)
    }
    finally {
      setBusy(false)
    }
  }

  const reloadScript = async () => {
    setBusy(true)
    setReloading(true)
    try {
      await onReload()
    }
    catch {
      onError(messages.setupOperationFailed)
    }
    finally {
      setReloading(false)
      setBusy(false)
    }
  }

  return (
    <>
      <section
        aria-label={messages.setupProperty}
        className="compose-editor__page-script-property"
        data-expanded={expanded ? 'true' : 'false'}
        data-state={reference ? 'bound' : 'unbound'}
      >
        <header className="compose-editor__page-script-header">
          <button
            aria-controls={contentId}
            aria-expanded={expanded}
            aria-label={expanded ? messages.collapseSetupScript : messages.expandSetupScript}
            className="compose-editor__page-script-toggle"
            type="button"
            onClick={() => setExpanded((current) => !current)}
          >
            <ChevronIcon />
            <span>{messages.setupProperty}</span>
          </button>
          {reference ? (
            <button
              aria-busy={reloading}
              className="compose-editor__page-script-reload"
              data-loading={reloading ? 'true' : 'false'}
              disabled={busy || !scope}
              title={messages.reloadSetupScript}
              type="button"
              onClick={() => { void reloadScript() }}
            ><ReloadIcon /><span>{messages.reloadSetupScript}</span></button>
          ) : (
            <span
              className="compose-editor__page-script-status"
              data-state="disconnected"
            >
              <span aria-hidden="true" />
              {messages.setupDisconnected}
            </span>
          )}
          {reference && currentEntry ? (
            <button
              aria-label={messages.setupMoreActions}
              className="compose-editor__page-script-more"
              disabled={busy}
              title={messages.setupMoreActions}
              type="button"
              onClick={(event) => actionsMenu.openAt(event, 'page-script')}
            ><MoreIcon /></button>
          ) : null}
        </header>

        {expanded ? (
          <div className="compose-editor__page-script-body" id={contentId}>
            <div className="compose-editor__page-script-controls">
              <select
                aria-label={messages.selectSetupScript}
                disabled={!canChange || busy || loading}
                title={currentEntry?.name}
                value={currentValue}
                onChange={(event) => { void chooseScript(event.target.value) }}
              >
                <option value="">{loading ? messages.setupLoading : messages.selectSetupScript}</option>
                {selectableEntries.map((entry) => (
                  <option key={entry.assetKey} value={entry.assetKey}>{entry.name}</option>
                ))}
              </select>
              {!reference ? (
                <button
                  aria-label={messages.quickCreateSetupScript}
                  className="compose-editor__page-script-create"
                  disabled={!canCreate || busy}
                  title={messages.quickCreateSetupScript}
                  type="button"
                  onClick={() => { void createScript() }}
                ><AddIcon /><span>{messages.quickCreate}</span></button>
              ) : null}
            </div>

            {reference ? (
              <div className="compose-editor__page-script-members">
                <div className="compose-editor__page-script-members-header">
                  <span>{messages.setupExports}</span>
                  <span>{snapshot.exports.length}</span>
                </div>
                {scope && snapshot.exports.length > 0 ? (
                  <ul aria-label={messages.setupExportsList}>
                    {snapshot.exports.map((item) => (
                      <li key={item.name}>
                        <span
                          aria-hidden="true"
                          className={`compose-editor__page-script-kind compose-editor__page-script-kind--${item.kind}`}
                        >{item.kind === 'method' ? 'ƒ' : item.reactive ? 'S' : 'V'}</span>
                        <strong>{item.name}</strong>
                        <output title={item.kind === 'value' ? displayValue(item.value) : undefined}>
                          {item.kind === 'method' ? messages.setupMethod : displayValue(item.value)}
                        </output>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="compose-editor__page-script-empty">
                    {scope ? messages.setupNoExports : messages.setupScopeUnavailable}
                  </p>
                )}
                {snapshot.diagnostics.map((diagnostic, index) => (
                  <p
                    className="compose-editor__page-script-diagnostic"
                    key={`${diagnostic.code}:${index}`}
                    role="alert"
                  >{diagnostic.message}</p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {reference && currentEntry ? (
        <ComposeContextMenu {...actionsMenu.rootProps}>
          <ComposeContextMenuContent aria-label={messages.setupActions} align="end">
            <ComposeContextMenuItem
              onClick={() => {
                actionsMenu.close()
                onOpen(currentEntry)
              }}
            >{messages.openSetupScript}</ComposeContextMenuItem>
            <ComposeContextMenuItem
              disabled={!canChange || busy}
              variant="destructive"
              onClick={() => {
                actionsMenu.close()
                void unlinkScript()
              }}
            >{messages.unlinkSetupScript}</ComposeContextMenuItem>
          </ComposeContextMenuContent>
        </ComposeContextMenu>
      ) : null}
    </>
  )
}
