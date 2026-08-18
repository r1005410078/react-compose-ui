import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { applyComposeAnimationAtTime } from '@compose-ui/animation'
import { getComposeAnimations, isComposeFrameEntity } from '@compose-ui/core'
import type { ComposeDocument } from '@compose-ui/core'
import type { ComposePageScriptScope } from '@compose-ui/script-runtime'
import {
  INITIAL_COMPOSE_ANIMATION_PLAYBACK,
  advanceComposeAnimationPlayback,
} from './animation-playback-model'
import type { ComposeAnimationBindingReading } from './animation-playback-model'
import { useAnimationFrameLoop } from './use-animation-frame-loop'

/** 一次绑定读取的结果：读数 + 失效项（导出缺失或类型不符，均按未绑定处理）。 */
interface BindingSnapshot extends ComposeAnimationBindingReading {
  readonly issues: readonly {
    readonly exportName: string
    readonly code: 'script.binding-missing-export' | 'script.binding-type-mismatch'
    readonly message: string
  }[]
}

const EMPTY_SNAPSHOT: BindingSnapshot = { issues: [] }

function resolveBindingSnapshot(
  scope: ComposePageScriptScope | undefined,
  playingName: string | null,
  currentTimeName: string | null,
): BindingSnapshot {
  if (!scope || (playingName === null && currentTimeName === null)) return EMPTY_SNAPSHOT
  const issues: {
    exportName: string
    code: 'script.binding-missing-export' | 'script.binding-type-mismatch'
    message: string
  }[] = []
  const readValue = (exportName: string, target: string): unknown => {
    const snapshot = scope.getExport(exportName)
    if (!snapshot) {
      issues.push({
        exportName,
        code: 'script.binding-missing-export',
        message: `动画播放控制 ${target} 绑定的导出 ${exportName} 不存在`,
      })
      return undefined
    }
    if (snapshot.kind !== 'value') {
      issues.push({
        exportName,
        code: 'script.binding-type-mismatch',
        message: `动画播放控制 ${target} 不能绑定方法导出 ${exportName}`,
      })
      return undefined
    }
    return snapshot.value
  }
  let playing: boolean | undefined
  if (playingName !== null) {
    const value = readValue(playingName, 'playing')
    if (typeof value === 'boolean') playing = value
    else if (value !== undefined) {
      issues.push({
        exportName: playingName,
        code: 'script.binding-type-mismatch',
        message: `动画播放控制 playing 需要布尔导出，${playingName} 的值不是布尔`,
      })
    }
  }
  let currentTimeMs: number | undefined
  if (currentTimeName !== null) {
    const value = readValue(currentTimeName, 'currentTime')
    if (typeof value === 'number' && Number.isFinite(value)) currentTimeMs = value
    else if (value !== undefined) {
      issues.push({
        exportName: currentTimeName,
        code: 'script.binding-type-mismatch',
        message: `动画播放控制 currentTime 需要有限数值导出，${currentTimeName} 的值不是数值`,
      })
    }
  }
  return {
    ...(playing !== undefined ? { playing } : {}),
    ...(currentTimeMs !== undefined ? { currentTimeMs } : {}),
    issues,
  }
}

function sameSnapshot(left: BindingSnapshot, right: BindingSnapshot): boolean {
  return left.playing === right.playing
    && left.currentTimeMs === right.currentTimeMs
    && left.issues.length === right.issues.length
    && left.issues.every((issue, index) => (
      issue.exportName === right.issues[index]?.exportName
      && issue.code === right.issues[index]?.code
    ))
}

/** `useComposeAnimationPlayback` 的输入。 */
export interface ComposeAnimationPlaybackOptions {
  readonly document: ComposeDocument | undefined
  readonly scope: ComposePageScriptScope | undefined
  /**
   * 是否启用动画采样与脚本驱动。
   *
   * @remarks
   * 宿主自带 `layoutSnapshot` 时必须禁用：采样会改变文档几何，而快照属于基础文档，
   * 两者错配会让画面与布局脱节。
   */
  readonly enabled: boolean
  /**
   * 宿主接管的播放头毫秒（如预览对话框的手动播放会话）；存在时优先于脚本绑定。
   */
  readonly timeMsOverride?: number
  /**
   * 提供动画清单的 Frame。
   *
   * @remarks
   * v7 的清单归属 Frame。省略时回退到第一个根 Frame——Preview 本来就只渲染一个 Frame，
   * 播放的自然是它自己的时间线。
   */
  readonly frameId?: string | null
}

/**
 * 预览侧的动画播放：按文档第一条动画的播放控制绑定驱动，返回当前时刻的采样文档。
 *
 * @remarks
 * - 无任何绑定且无宿主接管时，停在 0 ms 的采样结果且不推进（动画不自动播放）。
 * - `playing` 绑定按上升沿从头播放语义推进；`currentTime` 绑定完全接管时间轴。
 * - 订阅用 `subscribeExport` 单导出粒度；绑定失效按未绑定处理并经
 *   `reportDiagnostic` 报告，绝不抛错，也不修改文档中的绑定。
 * - 卸载或作用域变化时订阅与 rAF 一并释放（rAF 生命周期共用 `useAnimationFrameLoop`）。
 */
export function useComposeAnimationPlayback(
  options: ComposeAnimationPlaybackOptions,
): ComposeDocument | undefined {
  const { document, enabled, frameId, scope, timeMsOverride } = options
  const hostFrameId = document
    ? frameId ?? document.rootIds.find((id) => isComposeFrameEntity(document.entities[id])) ?? null
    : null
  const animation = enabled && document && hostFrameId
    ? getComposeAnimations(document, hostFrameId)[0]
    : undefined
  const playingName = animation?.bindings?.playing?.exportName ?? null
  const currentTimeName = animation?.bindings?.currentTime?.exportName ?? null

  // 绑定读数作为外部 store：单导出订阅。快照只在订阅回调（事件上下文）里重算并
  // 按值比较后替换，`getSnapshot` 是纯读取——渲染期不做任何写入。
  const readingStore = useMemo(() => {
    const holder = { snapshot: resolveBindingSnapshot(scope, playingName, currentTimeName) }
    return {
      subscribe(listener: () => void) {
        if (!scope) return () => undefined
        const names = [playingName, currentTimeName]
          .filter((name): name is string => name !== null)
        const disposers = names.map((name) => scope.subscribeExport(name, () => {
          const next = resolveBindingSnapshot(scope, playingName, currentTimeName)
          if (!sameSnapshot(holder.snapshot, next)) holder.snapshot = next
          listener()
        }))
        return () => disposers.forEach((dispose) => dispose())
      },
      getSnapshot: () => holder.snapshot,
    }
  }, [currentTimeName, playingName, scope])
  const boundReading = useSyncExternalStore(
    readingStore.subscribe,
    readingStore.getSnapshot,
    readingStore.getSnapshot,
  )
  // 手动勾选的自动播放：playing 未绑定时按恒 true 读数处理——挂载首帧即触发
  // 上升沿从头播放，播放模式照常生效；脚本绑定存在时仍由绑定接管。
  const autoplay = playingName === null && animation?.autoplay === true
  const reading = useMemo<BindingSnapshot>(
    () => (autoplay ? { ...boundReading, playing: true } : boundReading),
    [autoplay, boundReading],
  )

  // 失效诊断在 effect 中报告并按内容去重：同一失效原因只报一次，恢复有效后允许再报。
  const reportedIssues = useRef(new Set<string>())
  useEffect(() => {
    if (!scope) return
    const keys = new Set(reading.issues.map((issue) => `${issue.exportName}:${issue.code}`))
    for (const issue of reading.issues) {
      const key = `${issue.exportName}:${issue.code}`
      if (reportedIssues.current.has(key)) continue
      reportedIssues.current.add(key)
      scope.reportDiagnostic({
        code: issue.code,
        message: issue.message,
        exportName: issue.exportName,
      })
    }
    for (const key of [...reportedIssues.current]) {
      if (!keys.has(key)) reportedIssues.current.delete(key)
    }
  }, [reading, scope])

  // 播放状态是纯数据：读数变化在渲染期 prev-adjust 推进一步（delta 0，承载沿检测），
  // 逐帧推进在 rAF 回调里用函数式更新完成。
  const [playback, setPlayback] = useState(INITIAL_COMPOSE_ANIMATION_PLAYBACK)
  const [appliedKey, setAppliedKey] = useState<{
    reading: BindingSnapshot
    animationId: string | null
  } | null>(null)
  const animationId = animation?.id ?? null
  if (appliedKey?.reading !== reading || appliedKey.animationId !== animationId) {
    setAppliedKey({ reading, animationId })
    if (animation) {
      setPlayback((current) => advanceComposeAnimationPlayback(
        appliedKey?.animationId === animationId ? current : INITIAL_COMPOSE_ANIMATION_PLAYBACK,
        reading,
        0,
        animation.durationMs,
        animation.playbackMode,
      ))
    }
    else {
      setPlayback(INITIAL_COMPOSE_ANIMATION_PLAYBACK)
    }
  }

  const frame = useRef({ reading, animation })
  useEffect(() => {
    frame.current = { reading, animation }
  })
  useAnimationFrameLoop(
    playback.running && timeMsOverride === undefined && animation !== undefined,
    (deltaMs) => {
      const current = frame.current
      if (!current.animation) return
      setPlayback((state) => advanceComposeAnimationPlayback(
        state,
        current.reading,
        deltaMs,
        current.animation!.durationMs,
        current.animation!.playbackMode,
      ))
    },
  )

  const timeMs = timeMsOverride !== undefined && animation
    ? Math.min(Math.max(timeMsOverride, 0), animation.durationMs)
    : playback.playhead.timeMs
  return useMemo(() => (
    document && animation
      ? applyComposeAnimationAtTime(document, animation.id, timeMs)
      : document
  ), [animation, document, timeMs])
}
