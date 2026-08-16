import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  COMPOSE_ANIMATION_COMMAND_TYPES,
  applyComposeAnimationAtTime,
  findComposeKeyframeAt,
  findComposeAnimationTrack,
} from '@compose-ui/animation'
import type { ComposeAnimationValueKind } from '@compose-ui/animation'
import { getComposeAnimations } from '@compose-ui/core'
import type {
  CommandDispatchResult,
  ComposeDocument,
  EditorCommand,
  JsonObject,
  JsonValue,
} from '@compose-ui/core'
import type {
  ComposeAnimationPanelAction,
  ComposeAnimationPanelValue,
} from '@compose-ui/animation-panel'
import {
  buildAnimationPanelModel,
  translateAnimationPanelAction,
} from './animation-document-adapter'
import type { AnimationPropertyLabelPort } from './animation-document-adapter'
import { getAnimationKeyState } from './animation-key-state'
import type { AnimationKeyState } from './animation-key-state'

/** 动画模式的编辑器会话状态；永不写入文档或撤销历史。 */
interface AnimationModeSessionState {
  readonly currentTimeMs: number
  readonly isPlaying: boolean
  readonly autoRecord: boolean
  readonly selectedKeyframeId: string | null
  readonly selectedTrackId: string | null
  readonly selectedPropertyId: string | null
  readonly selectedClipId: string | null
  readonly easingEditor: 'curve' | 'spring'
}

const INITIAL_SESSION: AnimationModeSessionState = {
  currentTimeMs: 0,
  isPlaying: false,
  autoRecord: true,
  selectedKeyframeId: null,
  selectedTrackId: null,
  selectedPropertyId: null,
  selectedClipId: null,
  easingEditor: 'curve',
}

/** `useAnimationMode` 的接入端口。 */
export interface AnimationModeOptions {
  readonly document: ComposeDocument | undefined
  readonly dispatch?: (command: EditorCommand) => CommandDispatchResult
  readonly idFactory: () => string
  /** 创建第一条动画时的默认名称（已本地化）。 */
  readonly defaultAnimationName: string
  readonly propertyLabel?: AnimationPropertyLabelPort
}

/** 动画模式向编辑器其余部分暴露的会话接口。 */
export interface AnimationModeSession {
  /** 底部动画标签是否为活动标签。 */
  readonly active: boolean
  readonly setActive: (active: boolean) => void
  /** 当前使用的动画；无动画文档下为 null，时间线显示创建引导。 */
  readonly animationId: string | null
  readonly playheadMs: number
  readonly autoRecord: boolean
  /** 动画模式下画布应显示的采样文档；非动画模式即基础文档。 */
  readonly displayDocument: ComposeDocument | undefined
  /** 面板受控值；无文档时为 null。 */
  readonly panelValue: ComposeAnimationPanelValue | null
  readonly onPanelValueChange: (next: ComposeAnimationPanelValue) => void
  readonly onPanelAction: (action: ComposeAnimationPanelAction) => void
  /** 空状态创建引导：建立第一条动画并进入正常时间线。 */
  readonly createAnimation: () => void
  /** 菱形按钮状态查询。 */
  readonly keyStateFor: (
    entityId: string,
    path: readonly (string | number)[],
  ) => AnimationKeyState
  /** 菱形按钮点击：keyed 删帧，其余以当前值在播放头处打点。 */
  readonly toggleKey: (
    entityId: string,
    path: readonly (string | number)[],
    valueKind: ComposeAnimationValueKind,
    currentValue: JsonValue,
  ) => void
}

/**
 * 编辑器动画模式的会话与文档桥接。
 *
 * @remarks
 * 会话字段（播放头、播放状态、选择、自动记录）只活在这里；面板的模型部分每次从文档
 * 重建，编辑通过 `onPanelAction` 翻译成动画命令派发到**基础文档**——这条分工就是
 * "播放不产生事务"与"编辑可撤销"同时成立的原因。
 *
 * 面板 `onValueChange` 的快照里也带 model 与 playbackMode，但这里只收会话字段：
 * 模型的事实来源是文档，面板本地的乐观修改会在命令落地后的重建中得到同样结果。
 */
export function useAnimationMode(options: AnimationModeOptions): AnimationModeSession {
  const { defaultAnimationName, dispatch, document, idFactory, propertyLabel } = options
  const [active, setActive] = useState(false)
  const [session, setSession] = useState(INITIAL_SESSION)

  const animations = document ? getComposeAnimations(document) : []
  // 基础能力阶段 UI 只用第一条动画；多动画选择留给后续提案。
  const animationId = animations[0]?.id ?? null
  const animation = animations[0] ?? null

  const dispatchRef = useRef(dispatch)
  const documentRef = useRef(document)
  const idFactoryRef = useRef(idFactory)
  useEffect(() => {
    dispatchRef.current = dispatch
    documentRef.current = document
    idFactoryRef.current = idFactory
  }, [dispatch, document, idFactory])

  const dispatchDraft = useCallback((type: string, payload: JsonObject, mergeKey?: string) => {
    dispatchRef.current?.({
      id: idFactoryRef.current(),
      type,
      payload,
      meta: {
        source: 'animation-mode',
        ...(mergeKey !== undefined ? { mergeKey } : {}),
      },
    })
  }, [])

  const panelValue = useMemo<ComposeAnimationPanelValue | null>(() => {
    if (!document) return null
    const model = animationId
      ? buildAnimationPanelModel(document, animationId, { propertyLabel })
      : { durationMs: 300, tracks: [] as const }
    return {
      model,
      currentTimeMs: Math.min(session.currentTimeMs, model.durationMs),
      selectedKeyframeId: session.selectedKeyframeId,
      selectedTrackId: session.selectedTrackId,
      selectedPropertyId: session.selectedPropertyId,
      selectedClipId: session.selectedClipId,
      isPlaying: session.isPlaying,
      playbackMode: animation?.playbackMode ?? 'play-once',
      autoRecord: session.autoRecord,
      easingEditor: session.easingEditor,
    }
  }, [animation?.playbackMode, animationId, document, propertyLabel, session])

  const onPanelValueChange = useCallback((next: ComposeAnimationPanelValue) => {
    setSession({
      currentTimeMs: next.currentTimeMs,
      isPlaying: next.isPlaying,
      autoRecord: next.autoRecord,
      selectedKeyframeId: next.selectedKeyframeId,
      selectedTrackId: next.selectedTrackId ?? null,
      selectedPropertyId: next.selectedPropertyId ?? null,
      selectedClipId: next.selectedClipId ?? null,
      easingEditor: next.easingEditor,
    })
  }, [])

  const onPanelAction = useCallback((action: ComposeAnimationPanelAction) => {
    const baseDocument = documentRef.current
    if (!baseDocument || !animationId) return
    // 一个动作可能展开成多条命令（如删除某对象的全部轨道）；它们共享 mergeKey 合成一次事务。
    for (const draft of translateAnimationPanelAction(baseDocument, animationId, action)) {
      dispatchDraft(draft.type, draft.payload, draft.mergeKey)
    }
  }, [animationId, dispatchDraft])

  const createAnimation = useCallback(() => {
    dispatchDraft(COMPOSE_ANIMATION_COMMAND_TYPES.create, {
      animationId: idFactoryRef.current(),
      name: defaultAnimationName,
      durationMs: 300,
    })
  }, [defaultAnimationName, dispatchDraft])

  const displayDocument = useMemo(() => {
    if (!active || !document || !animationId) return document
    return applyComposeAnimationAtTime(document, animationId, session.currentTimeMs)
  }, [active, animationId, document, session.currentTimeMs])

  const keyStateFor = useCallback((
    entityId: string,
    path: readonly (string | number)[],
  ): AnimationKeyState => {
    // 直接闭包基础文档而不是读 ref：菱形按钮在渲染期调用本函数，渲染期禁止访问 ref。
    if (!document || !animationId) return 'unavailable'
    return getAnimationKeyState(document, animationId, entityId, path, session.currentTimeMs)
  }, [animationId, document, session.currentTimeMs])

  const toggleKey = useCallback((
    entityId: string,
    path: readonly (string | number)[],
    valueKind: ComposeAnimationValueKind,
    currentValue: JsonValue,
  ) => {
    const baseDocument = documentRef.current
    if (!baseDocument || !animationId) return
    const entity = baseDocument.entities[entityId]
    const track = entity ? findComposeAnimationTrack(entity, animationId, path) : null
    const existing = track ? findComposeKeyframeAt(track, session.currentTimeMs) : null
    if (existing) {
      dispatchDraft(COMPOSE_ANIMATION_COMMAND_TYPES.removeKeyframe, {
        animationId,
        entityId,
        path: path as JsonValue,
        keyframeId: existing.id,
      })
      return
    }
    dispatchDraft(COMPOSE_ANIMATION_COMMAND_TYPES.setKeyframe, {
      animationId,
      entityId,
      path: path as JsonValue,
      valueKind,
      keyframeId: idFactoryRef.current(),
      timeMs: session.currentTimeMs,
      value: currentValue,
    })
  }, [animationId, dispatchDraft, session.currentTimeMs])

  return {
    active,
    setActive,
    animationId,
    playheadMs: session.currentTimeMs,
    autoRecord: session.autoRecord,
    displayDocument,
    panelValue,
    onPanelValueChange,
    onPanelAction,
    createAnimation,
    keyStateFor,
    toggleKey,
  }
}
