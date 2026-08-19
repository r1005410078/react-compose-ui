import { isComposeAnimationFileName } from '@compose-ui/animation'
import { COMPOSE_ANIMATION_COMMAND_TYPES } from '@compose-ui/animation'
import type { ComposeKeyframeInterpolation } from '@compose-ui/animation'
import {
  COMPOSE_EASING_PRESETS,
  composeEasingPresetInterpolation,
  getComposeEasingPresetLabels,
  matchComposeEasingPreset,
} from '@compose-ui/animation-panel'
import type { ComposeEasingSelectionId } from '@compose-ui/animation-panel'
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
import { ComposePropertyPanel, ComposePropertyPanelSection } from '@compose-ui/property-panel'
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
import {
  buildAnimationBindingValue,
  buildAnimationBindingVariables,
  bindingsPayloadFromPanel,
  canBindAnimationTarget,
  getEmptyScopeSnapshot,
  subscribeEmptyScope,
} from './animation-binding-fields'
import { createPageAnimationFile } from './animation-asset-store'
import { KeyframeEasingRenderer } from './keyframe-easing-field'
import type { KeyframeEasingValue } from './keyframe-easing-field'
import type { AnimationKeyframeEasing } from './keyframe-easing'

/** Canvas Inspector 动画 Section 的 Editor 侧输入。 @internal */
export interface PageAnimationScopePanelProps {
  readonly pageName: string
  readonly pageParentId: string
  readonly provider: ComposeAssetProvider
  readonly reference: ComposePageAnimationReference | null
  /**
   * 新建动画归属的场景（根 Frame）Entity id。
   *
   * @remarks
   * 动画文件按场景分区，因此新建时必须知道这条清单属于哪一块；宿主传当前动画作用域场景。
   */
  readonly frameId: string | null
  /** 会话镜像中的绑定动画清单；撤销越过水合事务后可能暂缺。 */
  readonly animation: ComposeAnimation | null
  /** 页面作用域；缺省时绑定候选为空。 */
  readonly scope?: ComposePageScriptScope
  readonly dispatch: (command: EditorCommand) => unknown
  readonly idFactory: () => string
  /** 绑定/更换/解除动画文件；由宿主完成页面包装写入与镜像水合。 */
  readonly onAnimationChange: (reference: ComposePageAnimationReference | null) => Promise<void>
  readonly onError: (message: string) => void
  /** 时间线当前选中关键帧的缓动上下文；为空时不渲染缓动三行。 */
  readonly keyframeEasing?: AnimationKeyframeEasing | null
  /** 改写选中关键帧的出向插值；`transient` 表示连续调节的中间值。 */
  readonly onInterpolationChange?: (
    interpolation: ComposeKeyframeInterpolation,
    transient: boolean,
  ) => void
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

/** 关键帧标识行：对象 / 属性 · 出向区间，让用户确认正在编辑哪一段曲线。 */
function keyframeSummary(easing: AnimationKeyframeEasing) {
  const range = easing.nextTimeMs === null
    ? `${easing.timeMs} ms`
    : `${easing.timeMs} ms → ${easing.nextTimeMs} ms`
  return `${easing.entityName} / ${easing.propertyLabel} · ${range}`
}

/** 缓动字段的自定义 renderer 表；实例级注册，不进属性面板的内建 editor。 */
const KEYFRAME_EASING_RENDERERS = [{
  id: 'animation-easing',
  component: KeyframeEasingRenderer,
  // 贴边而不是全宽：曲线的判读依赖完整时间轴，行首留一条竖带既浪费又误导。
  layout: 'full-bleed' as const,
}]

function AddIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/**
 * 「动画」作为 Canvas Inspector 的一个共享 Property Panel Section。
 *
 * @remarks
 * 内容是嵌入宿主 Root 的 `ComposePropertyPanel`：动画文件是标准 picklist 字段行，
 * 播放控制绑定复用面板既有的绑定入口——不引入第二个工具栏或独立分组 chrome。
 * 快捷创建与解除绑定放在 Section 标题行的 actions 槽。
 * @internal
 */
export function PageAnimationScopePanel({
  animation,
  dispatch,
  frameId,
  idFactory,
  keyframeEasing = null,
  onAnimationChange,
  onError,
  onInterpolationChange,
  pageName,
  pageParentId,
  provider,
  reference,
  scope,
}: PageAnimationScopePanelProps) {
  const i18n = useComposeI18nContext()
  const editorMessages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)
  const messages = editorMessages.animationMode
  const actionsMenu = useComposeContextMenu<'page-animation'>()
  const presetLabels = useMemo(
    () => getComposeEasingPresetLabels(i18n?.locale === 'en-US' ? 'en-US' : 'zh-CN'),
    [i18n?.locale],
  )
  const [entries, setEntries] = useState<readonly ComposeAssetEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const scopeSnapshot = useSyncExternalStore(
    scope?.subscribe ?? subscribeEmptyScope,
    scope?.getSnapshot ?? getEmptyScopeSnapshot,
    scope?.getSnapshot ?? getEmptyScopeSnapshot,
  )

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

  const canChange = provider.capabilities.write !== false
    && typeof provider.writeFile === 'function'
  const canCreate = provider.capabilities.createFile !== false
    && typeof provider.createFile === 'function'
  const currentValue = reference?.providerId === provider.id ? reference.assetKey : ''
  // 绑定引用可能指向已不在同目录列表中的文件（被移动/重命名）；补一个占位候选保住当前值。
  const selectableEntries = useMemo(() => reference
    && !entries.some((entry) => entry.assetKey === reference.assetKey)
    ? [{
        id: reference.assetKey,
        parentId: pageParentId,
        name: reference.assetKey.split('/').pop() ?? reference.assetKey,
        kind: 'file' as const,
        assetKey: reference.assetKey,
      }, ...entries]
    : entries, [entries, pageParentId, reference])

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
      if (!frameId) throw new Error('没有可绑定动画的场景')
      const result = await createPageAnimationFile(provider, pageParentId, pageName, frameId, {
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

  const bound = reference !== null
  const mirrorReady = bound && animation !== null
  const currentTimeBound = animation?.bindings?.currentTime !== undefined
  const schema = useMemo(() => {
    // 条件字段用可变 entries 组装：三元展开会让 TS 推出 schema 形状联合，无法赋给 GenericSchema。
    const fields: Record<string, v.GenericSchema> = {
      file: v.pipe(
        v.picklist(['', ...selectableEntries.map((entry) => entry.assetKey ?? '')]),
        v.title(messages.animationFileField),
        v.metadata({ propertyPanel: {
          order: 0,
          // 只锁文件选择：绑定行走文档命令，与 Provider 可写性无关。
          readOnly: !canChange || busy || loading,
          optionLabels: {
            '': loading ? messages.animationLoading : messages.selectAnimationFile,
            ...Object.fromEntries(selectableEntries.map((entry) => [entry.assetKey, entry.name])),
          },
        } }),
      ),
    }
    if (mirrorReady) {
      // currentTime 已绑定 = 脚本完全接管时间轴：playing 不再开放绑定入口，
      // 与动画检查器保持同一约束（见 animation-inspector.tsx）。
      fields.playing = currentTimeBound
        ? v.pipe(
            v.boolean(),
            v.title(messages.inspectorPlaying),
            v.description(messages.playingTakenOver),
          )
        : v.pipe(
            v.boolean(),
            v.title(messages.inspectorPlaying),
            v.metadata({ propertyPanel: { binding: { enabled: true }, order: 1 } }),
          )
      fields.currentTimeMs = v.pipe(
        v.number(),
        v.title(messages.inspectorCurrentTime),
        v.metadata({ propertyPanel: { binding: { enabled: true }, order: 2 } }),
      )
    }
    // 缓动三行只在时间线选中某个关键帧时出现；没有选中就没有编辑对象。
    if (mirrorReady && keyframeEasing) {
      fields.keyframe = v.pipe(
        v.string(),
        v.title(messages.keyframeField),
        v.metadata({ propertyPanel: { order: 3, readOnly: true } }),
      )
      fields.easingPreset = v.pipe(
        v.picklist([...COMPOSE_EASING_PRESETS.map((preset) => preset.id), 'custom']),
        v.title(messages.easingPresetField),
        v.metadata({ propertyPanel: { order: 4, optionLabels: presetLabels } }),
      )
      fields.easing = v.pipe(
        v.unknown(),
        v.title(messages.easingField),
        v.metadata({ propertyPanel: { editor: 'animation-easing', layout: 'full-bleed', order: 5 } }),
      )
    }
    return v.object(fields)
  }, [
    busy, canChange, currentTimeBound, keyframeEasing, loading, messages, mirrorReady,
    presetLabels, selectableEntries,
  ])
  // playing 的字面值承载可持久化的自动播放开关；currentTimeMs 编辑期不播放、字面值只是占位。
  const panelValue = useMemo(() => ({
    file: currentValue,
    ...(mirrorReady ? { playing: animation?.autoplay === true, currentTimeMs: 0 } : {}),
    ...(mirrorReady && keyframeEasing
      ? {
          keyframe: keyframeSummary(keyframeEasing),
          easingPreset: matchComposeEasingPreset(keyframeEasing.interpolation),
          easing: {
            interpolation: keyframeEasing.interpolation,
            // 末帧的出向段没有下一帧，说明必须常驻而不是折叠进字段描述。
            note: keyframeEasing.nextTimeMs === null ? messages.lastKeyframeNote : null,
          } satisfies KeyframeEasingValue,
        }
      : {}),
  }), [animation?.autoplay, currentValue, keyframeEasing, messages, mirrorReady])
  const variables = useMemo(() => buildAnimationBindingVariables(scopeSnapshot), [scopeSnapshot])
  const bindingValue = useMemo(
    () => (animation ? buildAnimationBindingValue(animation) : []),
    [animation],
  )

  return (
    <ComposePropertyPanelSection
      actions={(
        <>
          {!bound ? (
            <span className="compose-editor__inspector-section-status">
              {messages.animationDisconnected}
            </span>
          ) : null}
          {!bound && canCreate ? (
            <button
              aria-label={messages.quickCreateAnimation}
              className="compose-editor__inspector-section-action"
              disabled={busy}
              title={messages.quickCreateAnimation}
              type="button"
              onClick={() => { void createAnimation() }}
            ><AddIcon /></button>
          ) : null}
          {bound ? (
            <button
              aria-label={messages.animationMoreActions}
              className="compose-editor__inspector-section-action"
              disabled={busy}
              title={messages.animationMoreActions}
              type="button"
              onClick={(event) => actionsMenu.openAt(event, 'page-animation')}
            ><MoreIcon /></button>
          ) : null}
        </>
      )}
      defaultExpanded
      title={editorMessages.canvasInspector.animation}
    >
      <ComposePropertyPanel
        renderers={KEYFRAME_EASING_RENDERERS}
        schema={schema}
        value={panelValue}
        {...(mirrorReady && animation
          ? {
              binding: {
                value: bindingValue,
                variables,
                onChange: (next) => {
                  dispatch({
                    id: idFactory(),
                    type: COMPOSE_ANIMATION_COMMAND_TYPES.configure,
                    payload: {
                      animationId: animation.id,
                      bindings: bindingsPayloadFromPanel(next),
                    },
                    meta: { source: 'canvas-animation-inspector' },
                  } as EditorCommand)
                },
                canBind: (target, variable) =>
                  canBindAnimationTarget(target.address.path, variable),
              },
            }
          : {})}
        onValueChange={(_next, change) => {
          if (change.path[0] === 'file') {
            void chooseAnimation(change.value as string)
            return
          }
          // 未绑定变量时手动勾选播放 = 持久化的自动播放开关（写入清单，随保存回写动画文件）。
          // currentTimeMs 的字面编辑不写文档：编辑期不播放。
          if (change.path[0] === 'playing' && animation) {
            dispatch({
              id: idFactory(),
              type: COMPOSE_ANIMATION_COMMAND_TYPES.configure,
              payload: { animationId: animation.id, autoplay: change.value === true },
              meta: { source: 'canvas-animation-inspector' },
            } as EditorCommand)
            return
          }
          if (!keyframeEasing || !onInterpolationChange) return
          if (change.path[0] === 'easingPreset') {
            onInterpolationChange(
              composeEasingPresetInterpolation(
                change.value as ComposeEasingSelectionId,
                keyframeEasing.interpolation,
              ),
              false,
            )
            return
          }
          if (change.path[0] === 'easing') {
            // 连续调节以 input 提交、离散提交以 commit 提交；宿主据此决定是否合并撤销。
            onInterpolationChange(
              (change.value as KeyframeEasingValue).interpolation,
              change.reason === 'input',
            )
          }
        }}
      />
      {bound && !mirrorReady ? (
        <p className="compose-editor__inspector-section-note">{messages.mirrorMissing}</p>
      ) : null}
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
    </ComposePropertyPanelSection>
  )
}
