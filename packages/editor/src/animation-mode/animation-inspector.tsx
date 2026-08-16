import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import * as v from 'valibot'
import { COMPOSE_ANIMATION_COMMAND_TYPES } from '@compose-ui/animation'
import type {
  ComposeAnimation,
  EditorCommand,
  JsonObject,
} from '@compose-ui/core'
import { ComposePropertyPanel } from '@compose-ui/property-panel'
import type { ComposePageScriptScope } from '@compose-ui/script-runtime'
import {
  buildAnimationBindingValue,
  buildAnimationBindingVariables,
  bindingsPayloadFromPanel,
  canBindAnimationTarget,
  getEmptyScopeSnapshot,
  subscribeEmptyScope,
} from './animation-binding-fields'

/** 动画检查器的可本地化文案。 */
export interface AnimationInspectorMessages {
  readonly inspectorLabel: string
  readonly inspectorName: string
  readonly inspectorDuration: string
  readonly inspectorPlaybackMode: string
  readonly inspectorPlaying: string
  readonly inspectorCurrentTime: string
  readonly playingTakenOver: string
}

/** 动画检查器的受控属性。 */
export interface AnimationInspectorProps {
  readonly animation: ComposeAnimation
  readonly dispatch: (command: EditorCommand) => unknown
  readonly idFactory: () => string
  /** 页面作用域；缺省时绑定候选为空但检查器其余功能不受影响。 */
  readonly scope?: ComposePageScriptScope
  readonly messages: AnimationInspectorMessages
}

/**
 * 时间线选中动画本身时的右侧检查器：名称、时长、播放模式与播放控制绑定。
 *
 * @remarks
 * 所有修改派发 `animation.configure` 写入文档清单，因此可撤销。播放控制绑定复用属性
 * 面板既有的绑定入口与变量选择器：`playing` 只接布尔导出、`currentTime` 只接数值导出
 * （`canBind` 语义过滤）；`currentTime` 已绑定时 `playing` 目标经 `isTargetEnabled`
 * 禁用——脚本已完全接管时间轴，播放绑定在该状态下永远不会生效。
 * `playing` / `currentTime` 两行的字面值只是占位（编辑期不播放），编辑它们不写入文档。
 */
export function AnimationInspector({
  animation,
  dispatch,
  idFactory,
  messages,
  scope,
}: AnimationInspectorProps) {
  const snapshot = useSyncExternalStore(
    scope?.subscribe ?? subscribeEmptyScope,
    scope?.getSnapshot ?? getEmptyScopeSnapshot,
    scope?.getSnapshot ?? getEmptyScopeSnapshot,
  )
  const variables = useMemo(() => buildAnimationBindingVariables(snapshot), [snapshot])

  const currentTimeBound = animation.bindings?.currentTime !== undefined
  const schema = useMemo(() => v.object({
    name: v.pipe(v.string(), v.minLength(1), v.title(messages.inspectorName)),
    durationMs: v.pipe(v.number(), v.minValue(1), v.title(messages.inspectorDuration)),
    playbackMode: v.pipe(
      v.picklist(['play-once', 'loop', 'ping-pong']),
      v.title(messages.inspectorPlaybackMode),
    ),
    // currentTime 已绑定 = 脚本完全接管时间轴：playing 不再开放绑定入口，
    // 字段说明给出接管原因，避免用户配出永远不会生效的组合。
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

  const panelValue = useMemo(() => ({
    name: animation.name,
    durationMs: animation.durationMs,
    playbackMode: animation.playbackMode,
    // 编辑期不播放：这两行只承载绑定入口，字面值是占位。
    playing: false,
    currentTimeMs: 0,
  }), [animation])

  const bindingValue = useMemo(() => buildAnimationBindingValue(animation), [animation])

  const latest = useRef({ animation, dispatch, idFactory })
  useEffect(() => {
    latest.current = { animation, dispatch, idFactory }
  })
  const configure = (payload: JsonObject) => {
    const current = latest.current
    current.dispatch({
      id: current.idFactory(),
      type: COMPOSE_ANIMATION_COMMAND_TYPES.configure,
      payload: { animationId: current.animation.id, ...payload },
      meta: { source: 'animation-inspector' },
    } as EditorCommand)
  }

  return (
    <div className="compose-editor__animation-inspector">
      {/* 面板的字段描述默认折叠，接管原因必须始终可见：单独渲染一条说明。 */}
      {currentTimeBound ? (
        <p className="compose-editor__animation-binding-note" role="note">
          {messages.playingTakenOver}
        </p>
      ) : null}
      <ComposePropertyPanel
        aria-label={messages.inspectorLabel}
      binding={{
        value: bindingValue,
        variables,
        onChange: (next) => {
          configure({ bindings: bindingsPayloadFromPanel(next) })
        },
        canBind: (target, variable) => canBindAnimationTarget(target.address.path, variable),
      }}
      schema={schema}
      value={panelValue}
      onValueChange={(next, change) => {
        const field = change.path[0]
        if (field === 'name' && next.name !== animation.name) {
          configure({ name: next.name })
        }
        else if (field === 'durationMs' && next.durationMs !== animation.durationMs) {
          configure({ durationMs: next.durationMs })
        }
        else if (field === 'playbackMode' && next.playbackMode !== animation.playbackMode) {
          configure({ playbackMode: next.playbackMode })
        }
        // playing / currentTimeMs 的字面编辑不写文档：编辑期不播放，绑定才是事实。
      }}
      />
    </div>
  )
}
