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
import type { EditorMessages } from '../editor-i18n'
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

/** 页面配置面板动画分组里一块根场景的绑定行数据。 @internal */
export interface PageAnimationSceneBinding {
  readonly frameId: string
  /** 场景名，作为绑定行的行标签。 */
  readonly name: string
  readonly reference: ComposePageAnimationReference | null
  /** 会话镜像中的绑定动画清单；撤销越过水合事务后可能暂缺。 */
  readonly animation: ComposeAnimation | null
  /** 激活场景：预览默认目标与发布对象。 */
  readonly isActive: boolean
  /** 当前动画作用域场景：时间线正在编辑的那一块，可与激活场景不同。 */
  readonly isScope: boolean
}

/** Canvas Inspector 动画 Section 的 Editor 侧输入。 @internal */
export interface PageAnimationScopePanelProps {
  readonly pageName: string
  readonly pageParentId: string
  readonly provider: ComposeAssetProvider
  /** 按文档 `rootIds` 顺序排列的根场景绑定行；每行编辑各自 Frame 的绑定。 */
  readonly scenes: readonly PageAnimationSceneBinding[]
  /** 页面作用域；缺省时绑定候选为空。 */
  readonly scope?: ComposePageScriptScope
  readonly dispatch: (command: EditorCommand) => unknown
  readonly idFactory: () => string
  /** 绑定/更换/解除某块场景的动画文件；由宿主完成文档命令写入与镜像水合。 */
  readonly onAnimationChange: (
    reference: ComposePageAnimationReference | null,
    frameId: string,
  ) => Promise<void>
  readonly onError: (message: string) => void
  /** 时间线当前选中关键帧的缓动上下文；为空时不渲染缓动三行。 */
  readonly keyframeEasing?: AnimationKeyframeEasing | null
  /** 改写选中关键帧的出向插值；`transient` 表示连续调节的中间值。 */
  readonly onInterpolationChange?: (
    interpolation: ComposeKeyframeInterpolation,
    transient: boolean,
  ) => void
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

/** 文件 picklist 里代表「新建动画文件」的哨兵值；assetKey 不可能与之冲突。 */
const CREATE_FILE_OPTION = '__compose-create-animation-file__'

type AnimationModeMessages = EditorMessages['animationMode']

/** 绑定行的行标签：场景名加激活/编辑中徽标；两者重合时只标激活。 */
function sceneRowTitle(scene: PageAnimationSceneBinding, messages: AnimationModeMessages) {
  const badges = [
    ...(scene.isActive ? [messages.sceneActiveBadge] : []),
    ...(scene.isScope && !scene.isActive ? [messages.sceneScopeBadge] : []),
  ]
  return badges.length > 0 ? `${scene.name}（${badges.join(' · ')}）` : scene.name
}

interface SceneBindingPanelProps {
  readonly scene: PageAnimationSceneBinding
  readonly entries: readonly ComposeAssetEntry[]
  readonly loading: boolean
  readonly busy: boolean
  readonly canChange: boolean
  readonly canCreate: boolean
  readonly pageParentId: string
  readonly providerId: string
  readonly messages: AnimationModeMessages
  readonly presetLabels: Readonly<Record<string, string>>
  readonly scopeSnapshot: ReturnType<ComposePageScriptScope['getSnapshot']>
  readonly dispatch: PageAnimationScopePanelProps['dispatch']
  readonly idFactory: () => string
  readonly onChooseFile: (scene: PageAnimationSceneBinding, assetKey: string) => void
  readonly onCreateFile: (scene: PageAnimationSceneBinding) => void
  readonly onUnlink: (scene: PageAnimationSceneBinding) => void
  readonly keyframeEasing: AnimationKeyframeEasing | null
  readonly onInterpolationChange?: PageAnimationScopePanelProps['onInterpolationChange']
}

/**
 * 一块根场景的绑定行组：文件字段行 + 已绑定时的播放控制与（作用域场景的）缓动行。
 *
 * @remarks
 * 每块场景拥有独立的 `ComposePropertyPanel` 与绑定配置，使 playing/currentTimeMs 的
 * 变量绑定只落到该场景自己的动画清单，互不串写。
 */
function SceneBindingPanel({
  busy,
  canChange,
  canCreate,
  dispatch,
  entries,
  idFactory,
  keyframeEasing,
  loading,
  messages,
  onChooseFile,
  onCreateFile,
  onInterpolationChange,
  onUnlink,
  pageParentId,
  presetLabels,
  providerId,
  scene,
  scopeSnapshot,
}: SceneBindingPanelProps) {
  const { animation, reference } = scene
  const currentValue = reference?.providerId === providerId ? reference.assetKey : ''
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

  const bound = reference !== null
  const mirrorReady = bound && animation !== null
  const currentTimeBound = animation?.bindings?.currentTime !== undefined
  const showEasing = scene.isScope && mirrorReady && keyframeEasing !== null
  const schema = useMemo(() => {
    // 条件字段用可变 entries 组装：三元展开会让 TS 推出 schema 形状联合，无法赋给 GenericSchema。
    const fields: Record<string, v.GenericSchema> = {
      file: v.pipe(
        v.picklist([
          '',
          ...selectableEntries.map((entry) => entry.assetKey ?? ''),
          ...(canCreate ? [CREATE_FILE_OPTION] : []),
        ]),
        v.title(sceneRowTitle(scene, messages)),
        v.metadata({ propertyPanel: {
          order: 0,
          // 只锁文件选择：绑定行走文档命令，与 Provider 可写性无关。
          readOnly: !canChange || busy || loading,
          optionLabels: {
            // 已绑定行的空选项就是「取消关联」；未绑定行是占位提示。
            '': bound
              ? messages.unlinkAnimation
              : (loading ? messages.animationLoading : messages.selectAnimationFile),
            ...Object.fromEntries(selectableEntries.map((entry) => [entry.assetKey, entry.name])),
            ...(canCreate ? { [CREATE_FILE_OPTION]: messages.createAnimationFileOption } : {}),
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
    // 缓动三行只在时间线选中某个关键帧时出现，且只属于作用域场景的行组。
    if (showEasing) {
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
    bound, busy, canChange, canCreate, currentTimeBound, loading, messages, mirrorReady,
    presetLabels, scene, selectableEntries, showEasing,
  ])
  // playing 的字面值承载可持久化的自动播放开关；currentTimeMs 编辑期不播放、字面值只是占位。
  const panelValue = useMemo(() => ({
    file: currentValue,
    ...(mirrorReady ? { playing: animation?.autoplay === true, currentTimeMs: 0 } : {}),
    ...(showEasing && keyframeEasing
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
  }), [animation?.autoplay, currentValue, keyframeEasing, messages, mirrorReady, showEasing])
  const variables = useMemo(() => buildAnimationBindingVariables(scopeSnapshot), [scopeSnapshot])
  const bindingValue = useMemo(
    () => (animation ? buildAnimationBindingValue(animation) : []),
    [animation],
  )

  return (
    <>
      <ComposePropertyPanel
        renderers={showEasing ? KEYFRAME_EASING_RENDERERS : undefined}
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
                      // 清单级命令必须显式携带该行场景的 frameId，缺失会被 handler 拒绝。
                      frameId: scene.frameId,
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
            const nextValue = change.value as string
            if (nextValue === CREATE_FILE_OPTION) onCreateFile(scene)
            else if (nextValue === '') { if (bound) onUnlink(scene) }
            else onChooseFile(scene, nextValue)
            return
          }
          // 未绑定变量时手动勾选播放 = 持久化的自动播放开关（写入清单，随保存回写动画文件）。
          // currentTimeMs 的字面编辑不写文档：编辑期不播放。
          if (change.path[0] === 'playing' && animation) {
            dispatch({
              id: idFactory(),
              type: COMPOSE_ANIMATION_COMMAND_TYPES.configure,
              payload: { frameId: scene.frameId, animationId: animation.id, autoplay: change.value === true },
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
    </>
  )
}

/**
 * 「动画」作为 Canvas Inspector 的一个共享 Property Panel Section。
 *
 * @remarks
 * 分组按文档 `rootIds` 顺序为每块根场景显示一个绑定行：行标签是场景名（激活/编辑中
 * 徽标标注两个可能不同的身份），行内容是该 Frame 自己的动画绑定。文件行是标准 picklist
 * 字段：已绑定行的空选项充当「取消关联」，可创建的 Provider 追加「新建动画文件」选项，
 * 创建按「页面名-场景名」命名并只绑定该行的场景——不复用其他场景已绑定的文件。
 * 播放控制绑定复用面板既有的绑定入口，不引入第二个工具栏或独立分组 chrome。
 * @internal
 */
export function PageAnimationScopePanel({
  dispatch,
  idFactory,
  keyframeEasing = null,
  onAnimationChange,
  onError,
  onInterpolationChange,
  pageName,
  pageParentId,
  provider,
  scenes,
  scope,
}: PageAnimationScopePanelProps) {
  const i18n = useComposeI18nContext()
  const editorMessages = getEditorMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)
  const messages = editorMessages.animationMode
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

  const chooseAnimation = useCallback(async (
    scene: PageAnimationSceneBinding,
    assetKey: string,
  ) => {
    if (assetKey === scene.reference?.assetKey) return
    setBusy(true)
    try {
      await onAnimationChange({
        providerId: provider.id,
        assetKey,
        scope: provider.referenceScope ?? 'persistent',
      }, scene.frameId)
    }
    catch {
      onError(messages.animationOperationFailed)
    }
    finally {
      setBusy(false)
    }
  }, [messages.animationOperationFailed, onAnimationChange, onError, provider])

  const createAnimation = useCallback(async (scene: PageAnimationSceneBinding) => {
    setBusy(true)
    let created: ComposeAssetEntry | undefined
    try {
      // 每块场景一份自己的文件：按「页面名-场景名」命名，不复用其他场景已绑定的引用。
      const result = await createPageAnimationFile(
        provider,
        pageParentId,
        `${pageName}-${scene.name}`,
        scene.frameId,
        {
          id: idFactory(),
          name: messages.defaultAnimationName,
        },
      )
      created = result.entry
      const createdEntry = created
      const assetKey = createdEntry.assetKey
      // createPageAnimationFile 已保证 assetKey 存在；这里只为收窄类型。
      if (!assetKey) throw new Error('动画文件缺少稳定 assetKey')
      await onAnimationChange({
        providerId: provider.id,
        assetKey,
        scope: provider.referenceScope ?? 'persistent',
      }, scene.frameId)
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
  }, [
    idFactory, messages.animationOperationFailed, messages.animationOrphaned,
    messages.defaultAnimationName, onAnimationChange, onError, pageName, pageParentId, provider,
  ])

  const unlinkAnimation = useCallback(async (scene: PageAnimationSceneBinding) => {
    setBusy(true)
    try {
      await onAnimationChange(null, scene.frameId)
    }
    catch {
      onError(messages.animationOperationFailed)
    }
    finally {
      setBusy(false)
    }
  }, [messages.animationOperationFailed, onAnimationChange, onError])

  return (
    <ComposePropertyPanelSection
      defaultExpanded
      title={editorMessages.canvasInspector.animation}
    >
      {scenes.map((scene) => (
        <SceneBindingPanel
          busy={busy}
          canChange={canChange}
          canCreate={canCreate}
          dispatch={dispatch}
          entries={entries}
          idFactory={idFactory}
          key={scene.frameId}
          keyframeEasing={keyframeEasing}
          loading={loading}
          messages={messages}
          pageParentId={pageParentId}
          presetLabels={presetLabels}
          providerId={provider.id}
          scene={scene}
          scopeSnapshot={scopeSnapshot}
          onChooseFile={(target, assetKey) => { void chooseAnimation(target, assetKey) }}
          onCreateFile={(target) => { void createAnimation(target) }}
          onInterpolationChange={onInterpolationChange}
          onUnlink={(target) => { void unlinkAnimation(target) }}
        />
      ))}
    </ComposePropertyPanelSection>
  )
}
