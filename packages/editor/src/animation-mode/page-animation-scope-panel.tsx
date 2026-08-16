import { isComposeAnimationFileName } from '@compose-ui/animation'
import { COMPOSE_ANIMATION_COMMAND_TYPES } from '@compose-ui/animation'
import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
import {
  ComposeContextMenu,
  ComposeContextMenuContent,
  ComposeContextMenuItem,
  useComposeContextMenu,
} from '@compose-ui/components'
import type {
  ComposeAnimation,
  ComposePageAnimationReference,
  EditorCommand,
} from '@compose-ui/core'
import { ComposePropertyPanel } from '@compose-ui/property-panel'
import type { ComposePageScriptScope } from '@compose-ui/script-runtime'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import * as v from 'valibot'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import { getEditorMessages } from '../editor-i18n'
import {
  buildAnimationBindingValue,
  buildAnimationBindingVariables,
  bindingsPayloadFromPanel,
  canBindAnimationTarget,
  getEmptyScopeSnapshot,
  subscribeEmptyScope,
} from './animation-binding-fields'
import { createPageAnimationFile } from './animation-asset-store'

/** Canvas Inspector 动画属性的 Editor 侧输入。 @internal */
export interface PageAnimationScopePanelProps {
  readonly pageName: string
  readonly pageParentId: string
  readonly provider: ComposeAssetProvider
  readonly reference: ComposePageAnimationReference | null
  /** 会话镜像中的绑定动画清单；撤销越过水合事务后可能暂缺。 */
  readonly animation: ComposeAnimation | null
  /** 页面作用域；缺省时绑定候选为空。 */
  readonly scope?: ComposePageScriptScope
  readonly dispatch: (command: EditorCommand) => unknown
  readonly idFactory: () => string
  /** 绑定/更换/解除动画文件；由宿主完成页面包装写入与镜像水合。 */
  readonly onAnimationChange: (reference: ComposePageAnimationReference | null) => Promise<void>
  readonly onError: (message: string) => void
}

function referenceEntry(
  reference: ComposePageAnimationReference,
  parentId: string,
): ComposeAssetEntry {
  return {
    id: reference.assetKey,
    parentId,
    name: reference.assetKey.split('/').pop() ?? reference.assetKey,
    kind: 'file',
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

function AddIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/** 已绑定动画的播放控制变量绑定编辑。 */
function AnimationBindingFields({
  animation,
  dispatch,
  idFactory,
  scope,
  label,
  messages,
}: {
  readonly animation: ComposeAnimation
  readonly dispatch: (command: EditorCommand) => unknown
  readonly idFactory: () => string
  readonly scope?: ComposePageScriptScope
  readonly label: string
  readonly messages: ReturnType<typeof getEditorMessages>['animationMode']
}) {
  const snapshot = useSyncExternalStore(
    scope?.subscribe ?? subscribeEmptyScope,
    scope?.getSnapshot ?? getEmptyScopeSnapshot,
    scope?.getSnapshot ?? getEmptyScopeSnapshot,
  )
  const variables = useMemo(() => buildAnimationBindingVariables(snapshot), [snapshot])
  const bindingValue = useMemo(() => buildAnimationBindingValue(animation), [animation])
  const currentTimeBound = animation.bindings?.currentTime !== undefined
  const schema = useMemo(() => v.object({
    // currentTime 已绑定 = 脚本完全接管时间轴：playing 不再开放绑定入口，
    // 与动画检查器保持同一约束（见 animation-inspector.tsx）。
    playing: currentTimeBound
      ? v.pipe(
          v.boolean(),
          v.title(messages.inspectorPlaying),
          v.description(messages.playingTakenOver),
        )
      : v.pipe(
          v.boolean(),
          v.title(messages.inspectorPlaying),
          v.metadata({ propertyPanel: { binding: { enabled: true } } }),
        ),
    currentTimeMs: v.pipe(
      v.number(),
      v.title(messages.inspectorCurrentTime),
      v.metadata({ propertyPanel: { binding: { enabled: true } } }),
    ),
  }), [currentTimeBound, messages])
  // 编辑期不播放：两行的字面值只是占位，绑定才是事实来源。
  const panelValue = useMemo(() => ({ playing: false, currentTimeMs: 0 }), [])

  return (
    <ComposePropertyPanel
      aria-label={label}
      className="compose-editor__page-animation-bindings"
      binding={{
        value: bindingValue,
        variables,
        onChange: (next) => {
          dispatch({
            id: idFactory(),
            type: COMPOSE_ANIMATION_COMMAND_TYPES.configure,
            payload: { animationId: animation.id, bindings: bindingsPayloadFromPanel(next) },
            meta: { source: 'canvas-animation-inspector' },
          } as EditorCommand)
        },
        canBind: (target, variable) => canBindAnimationTarget(target.address.path, variable),
      }}
      schema={schema}
      value={panelValue}
      onValueChange={() => {
        // playing / currentTimeMs 的字面编辑不写文档：编辑期不播放。
      }}
    />
  )
}

/** 当前页面动画文件的选择、快捷创建、解除与播放控制绑定。 @internal */
export function PageAnimationScopePanel({
  animation,
  dispatch,
  idFactory,
  onAnimationChange,
  onError,
  pageName,
  pageParentId,
  provider,
  reference,
  scope,
}: PageAnimationScopePanelProps) {
  const i18n = useComposeI18nContext()
  const editorMessages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)
  const messages = editorMessages.animationMode
  const contentId = useId()
  const actionsMenu = useComposeContextMenu<'page-animation'>()
  const [entries, setEntries] = useState<readonly ComposeAssetEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const loadEntries = useCallback(async (signal?: AbortSignal) => {
    try {
      const listed = await provider.list({ folderId: pageParentId, signal })
      if (signal?.aborted) return
      setEntries(listed
        .filter((entry) => entry.kind === 'file'
          && entry.assetKey !== undefined
          && isComposeAnimationFileName(entry.name))
        .sort((left, right) => left.name.localeCompare(right.name)))
    }
    catch {
      if (signal?.aborted) return
      onError(messages.animationListFailed)
    }
    finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [messages.animationListFailed, onError, pageParentId, provider])

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
  const canCreate = provider.capabilities.createFile !== false
    && typeof provider.createFile === 'function'
  const currentValue = reference?.providerId === provider.id ? reference.assetKey : ''
  const selectableEntries = currentEntry
    && !entries.some((entry) => entry.assetKey === currentEntry.assetKey)
    ? [currentEntry, ...entries]
    : entries

  const chooseAnimation = async (assetKey: string) => {
    const entry = selectableEntries.find((candidate) => candidate.assetKey === assetKey)
    if (!entry?.assetKey || entry.assetKey === reference?.assetKey) return
    setBusy(true)
    try {
      await onAnimationChange({
        providerId: provider.id,
        assetKey: entry.assetKey,
        scope: provider.referenceScope ?? 'persistent',
      })
    }
    catch {
      onError(messages.animationOperationFailed)
    }
    finally {
      setBusy(false)
    }
  }

  const createAnimation = async () => {
    setBusy(true)
    let created: ComposeAssetEntry | undefined
    try {
      const result = await createPageAnimationFile(provider, pageParentId, pageName, {
        id: idFactory(),
        name: messages.defaultAnimationName,
      })
      created = result.entry
      const createdEntry = created
      const assetKey = createdEntry.assetKey
      // createPageAnimationFile 已保证 assetKey 存在；这里只为收窄类型。
      if (!assetKey) throw new Error('动画文件缺少稳定 assetKey')
      await onAnimationChange({
        providerId: provider.id,
        assetKey,
        scope: provider.referenceScope ?? 'persistent',
      })
      setEntries((current) => current.some((entry) => entry.assetKey === assetKey)
        ? current
        : [...current, createdEntry])
    }
    catch {
      onError(created ? messages.animationOrphaned : messages.animationOperationFailed)
    }
    finally {
      setBusy(false)
    }
  }

  const unlinkAnimation = async () => {
    setBusy(true)
    try {
      await onAnimationChange(null)
    }
    catch {
      onError(messages.animationOperationFailed)
    }
    finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section
        aria-label={editorMessages.canvasInspector.animation}
        className="compose-editor__page-script-property compose-editor__page-animation-property"
        data-expanded={expanded ? 'true' : 'false'}
        data-state={reference ? 'bound' : 'unbound'}
      >
        <header className="compose-editor__page-script-header">
          <button
            aria-controls={contentId}
            aria-expanded={expanded}
            aria-label={expanded ? messages.collapseAnimation : messages.expandAnimation}
            className="compose-editor__page-script-toggle"
            type="button"
            onClick={() => setExpanded((current) => !current)}
          >
            <ChevronIcon />
            <span>{editorMessages.canvasInspector.animation}</span>
          </button>
          {!reference ? (
            <span
              className="compose-editor__page-script-status"
              data-state="disconnected"
            >
              <span aria-hidden="true" />
              {messages.animationDisconnected}
            </span>
          ) : null}
          {reference && currentEntry ? (
            <button
              aria-label={messages.animationMoreActions}
              className="compose-editor__page-script-more"
              disabled={busy}
              title={messages.animationMoreActions}
              type="button"
              onClick={(event) => actionsMenu.openAt(event, 'page-animation')}
            ><MoreIcon /></button>
          ) : null}
        </header>

        {expanded ? (
          <div className="compose-editor__page-script-body" id={contentId}>
            <div className="compose-editor__page-script-controls">
              <select
                aria-label={messages.selectAnimationFile}
                disabled={!canChange || busy || loading}
                title={currentEntry?.name}
                value={currentValue}
                onChange={(event) => { void chooseAnimation(event.target.value) }}
              >
                <option value="">{loading ? messages.animationLoading : messages.selectAnimationFile}</option>
                {selectableEntries.map((entry) => (
                  <option key={entry.assetKey} value={entry.assetKey}>{entry.name}</option>
                ))}
              </select>
              {!reference ? (
                <button
                  aria-label={messages.quickCreateAnimation}
                  className="compose-editor__page-script-create"
                  disabled={!canCreate || busy}
                  title={messages.quickCreateAnimation}
                  type="button"
                  onClick={() => { void createAnimation() }}
                ><AddIcon /><span>{editorMessages.pages.quickCreate}</span></button>
              ) : null}
            </div>

            {reference ? (
              animation ? (
                <AnimationBindingFields
                  animation={animation}
                  dispatch={dispatch}
                  idFactory={idFactory}
                  label={messages.bindingsLabel}
                  messages={messages}
                  scope={scope}
                />
              ) : (
                <p className="compose-editor__page-script-empty">{messages.mirrorMissing}</p>
              )
            ) : null}
          </div>
        ) : null}
      </section>

      {reference && currentEntry ? (
        <ComposeContextMenu {...actionsMenu.rootProps}>
          <ComposeContextMenuContent aria-label={messages.animationActions} align="end">
            <ComposeContextMenuItem
              disabled={!canChange || busy}
              variant="destructive"
              onClick={() => {
                actionsMenu.close()
                void unlinkAnimation()
              }}
            >{messages.unlinkAnimation}</ComposeContextMenuItem>
          </ComposeContextMenuContent>
        </ComposeContextMenu>
      ) : null}
    </>
  )
}
