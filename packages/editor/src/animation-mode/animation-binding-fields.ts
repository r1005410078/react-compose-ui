import type {
  ComposeAnimation,
  ComposeAnimationBindings,
  ComposePageExportReference,
  JsonValue,
} from '@compose-ui/core'
import type {
  ComposePropertyPanelBinding,
  ComposePropertyPanelVariable,
} from '@compose-ui/property-panel'
import type { ComposePageScriptScope } from '@compose-ui/script-runtime'

/** 空作用域的稳定快照与订阅：让消费方在无 scope 时保持同一 Hook 结构。 @internal */
export const EMPTY_SCOPE_SNAPSHOT = { exports: [], diagnostics: [], disposed: false } as const
export const subscribeEmptyScope = () => () => undefined
export const getEmptyScopeSnapshot = () => EMPTY_SCOPE_SNAPSHOT

function pageReference(exportName: string): ComposePageExportReference {
  return { scope: 'page', exportName }
}

type ScopeSnapshot = ReturnType<ComposePageScriptScope['getSnapshot']>

/** 把页面作用域导出映射为属性面板绑定候选变量。 @internal */
export function buildAnimationBindingVariables(
  snapshot: Pick<ScopeSnapshot, 'exports'>,
): readonly ComposePropertyPanelVariable[] {
  return snapshot.exports
    .filter((item) => item.kind === 'value')
    .map((item) => ({
      id: item.name,
      label: item.name,
      scope: 'page' as const,
      value: item.kind === 'value' ? item.value : undefined,
      kind: 'value' as const,
    }))
}

/** 把清单上的播放控制绑定映射为属性面板的绑定值。 @internal */
export function buildAnimationBindingValue(
  animation: ComposeAnimation,
): readonly ComposePropertyPanelBinding[] {
  return [
    ...(animation.bindings?.playing
      ? [{
          target: { path: ['playing'], targetId: 'value' },
          variableId: animation.bindings.playing.exportName,
        }]
      : []),
    ...(animation.bindings?.currentTime
      ? [{
          target: { path: ['currentTimeMs'], targetId: 'value' },
          variableId: animation.bindings.currentTime.exportName,
        }]
      : []),
  ]
}

/**
 * 把属性面板的绑定变化换算成 `animation.configure` 的 bindings payload。
 *
 * @remarks
 * `null` 清除整个 bindings 命名空间；configure 的 undefined 语义是「不碰绑定」。
 * @internal
 */
export function bindingsPayloadFromPanel(
  next: readonly ComposePropertyPanelBinding[],
): JsonValue {
  const exportOf = (field: string) => next
    .find((binding) => binding.target.path[0] === field)?.variableId
  const playing = exportOf('playing')
  const currentTime = exportOf('currentTimeMs')
  const bindings: ComposeAnimationBindings = {
    ...(playing !== undefined ? { playing: pageReference(playing) } : {}),
    ...(currentTime !== undefined ? { currentTime: pageReference(currentTime) } : {}),
  }
  return (playing !== undefined || currentTime !== undefined
    ? bindings
    : null) as unknown as JsonValue
}

/** `playing` 只接布尔导出、`currentTimeMs` 只接有限数值导出。 @internal */
export function canBindAnimationTarget(
  path: readonly (string | number)[],
  variable: ComposePropertyPanelVariable,
): boolean {
  if (path[0] === 'playing') return typeof variable.value === 'boolean'
  if (path[0] === 'currentTimeMs') {
    return typeof variable.value === 'number' && Number.isFinite(variable.value)
  }
  return false
}
