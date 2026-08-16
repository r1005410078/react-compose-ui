import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
import type { ComposePageSetupReference } from '@compose-ui/core'
import {
  ComposeContextMenu,
  ComposeContextMenuContent,
  ComposeContextMenuItem,
  useComposeContextMenu,
} from '@compose-ui/components'
import {
  ComposePropertyPanel,
  ComposePropertyPanelSection,
  type ComposePropertyPanelRendererProps,
} from '@compose-ui/property-panel'
import type { ComposePageScriptScope } from '@compose-ui/script-runtime'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import * as v from 'valibot'
import {
  useCallback,
  useEffect,
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

/** Canvas Inspector 页面脚本 Section 的 Editor 侧输入。 @internal */
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

/** 「返回成员」full-width 字段的渲染值。 */
interface ScriptMembersValue {
  readonly snapshot: ReturnType<ComposePageScriptScope['getSnapshot']>
  readonly scopeAvailable: boolean
}

/**
 * 返回成员列表：作为属性面板的 full-width 自定义字段渲染。
 *
 * @remarks
 * 成员是脚本运行值不是可编辑属性，因此走 renderer 扩展而不是普通字段；行内类型徽标、
 * 名称与最终值沿用既有紧凑样式，diagnostics 以 `role="alert"` 附在列表后。
 */
function ScriptMembersRenderer({ value }: ComposePropertyPanelRendererProps) {
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage).pages
  const { snapshot, scopeAvailable } = value as ScriptMembersValue
  return (
    <div className="compose-editor__page-script-members">
      {scopeAvailable && snapshot.exports.length > 0 ? (
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
          {scopeAvailable ? messages.setupNoExports : messages.setupScopeUnavailable}
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
  )
}

/** 标签列内的「返回成员」+ 数量徽标：让标签行承载成员计数信息。 */
function ScriptMembersLabel({ label, value }: ComposePropertyPanelRendererProps) {
  const { snapshot } = value as ScriptMembersValue
  return (
    <span className="compose-editor__page-script-members-label">
      {label}
      <span aria-hidden="true">{snapshot.exports.length}</span>
    </span>
  )
}

const PAGE_SCRIPT_RENDERERS = [{
  id: 'page-script-members',
  component: ScriptMembersRenderer,
  labelComponent: ScriptMembersLabel,
  layout: 'full-width' as const,
}]

/**
 * 「页面脚本」作为 Canvas Inspector 的一个共享 Property Panel Section。
 *
 * @remarks
 * 脚本文件是标准 picklist 字段行，返回成员是 full-width 自定义字段；重新加载、
 * 快捷创建与更多操作放在 Section 标题行的 actions 槽——不再自带分组 chrome，
 * 折叠/展开与搜索过滤由宿主 Root 统一提供。
 * @internal
 */
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
      ?? {
        id: reference.assetKey,
        parentId: pageParentId,
        name: reference.assetKey.split('/').pop() ?? reference.assetKey,
        kind: 'file' as const,
        mediaType: 'text/javascript',
        assetKey: reference.assetKey,
      }
  }, [entries, pageParentId, reference])
  const canChange = provider.capabilities.write !== false
    && typeof provider.writeFile === 'function'
  const canCreate = canChange
    && provider.capabilities.createFile !== false
    && typeof provider.createFile === 'function'
  const currentValue = reference?.providerId === provider.id ? reference.assetKey : ''
  const selectableEntries = useMemo(() => currentEntry
    && !entries.some((entry) => entry.assetKey === currentEntry.assetKey)
    ? [currentEntry, ...entries]
    : entries, [currentEntry, entries])

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

  const schema = useMemo(() => {
    // 条件字段用可变 entries 组装：三元展开会让 TS 推出 schema 形状联合，无法赋给 GenericSchema。
    const fields: Record<string, v.GenericSchema> = {
      file: v.pipe(
        v.picklist(['', ...selectableEntries.map((entry) => entry.assetKey ?? '')]),
        v.title(messages.setupFileField),
        v.metadata({ propertyPanel: {
          order: 0,
          readOnly: !canChange || busy || loading,
          optionLabels: {
            '': loading ? messages.setupLoading : messages.selectSetupScript,
            ...Object.fromEntries(selectableEntries.map((entry) => [entry.assetKey, entry.name])),
          },
        } }),
      ),
    }
    if (reference) {
      fields.exports = v.pipe(
        v.unknown(),
        v.title(messages.setupExports),
        v.metadata({ propertyPanel: {
          editor: 'page-script-members',
          layout: 'full-width',
          order: 1,
        } }),
      )
    }
    return v.object(fields)
  }, [busy, canChange, loading, messages, reference, selectableEntries])
  const membersValue = useMemo<ScriptMembersValue>(() => ({
    snapshot,
    scopeAvailable: scope !== undefined,
  }), [scope, snapshot])
  const panelValue = useMemo(() => ({
    file: currentValue,
    ...(reference ? { exports: membersValue } : {}),
  }), [currentValue, membersValue, reference])

  return (
    <ComposePropertyPanelSection
      actions={(
        <>
          {!reference ? (
            <span className="compose-editor__inspector-section-status">
              {messages.setupDisconnected}
            </span>
          ) : null}
          {!reference && canCreate ? (
            <button
              aria-label={messages.quickCreateSetupScript}
              className="compose-editor__inspector-section-action"
              disabled={busy}
              title={messages.quickCreateSetupScript}
              type="button"
              onClick={() => { void createScript() }}
            ><AddIcon /></button>
          ) : null}
          {reference ? (
            <button
              aria-busy={reloading}
              aria-label={messages.reloadSetupScript}
              className="compose-editor__inspector-section-action"
              data-loading={reloading ? 'true' : 'false'}
              disabled={busy || !scope}
              title={messages.reloadSetupScript}
              type="button"
              onClick={() => { void reloadScript() }}
            ><ReloadIcon /></button>
          ) : null}
          {reference && currentEntry ? (
            <button
              aria-label={messages.setupMoreActions}
              className="compose-editor__inspector-section-action"
              disabled={busy}
              title={messages.setupMoreActions}
              type="button"
              onClick={(event) => actionsMenu.openAt(event, 'page-script')}
            ><MoreIcon /></button>
          ) : null}
        </>
      )}
      defaultExpanded
      title={messages.setupProperty}
    >
      <ComposePropertyPanel
        renderers={PAGE_SCRIPT_RENDERERS}
        schema={schema}
        value={panelValue}
        onValueChange={(_next, change) => {
          if (change.path[0] === 'file') void chooseScript(change.value as string)
        }}
      />
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
    </ComposePropertyPanelSection>
  )
}
