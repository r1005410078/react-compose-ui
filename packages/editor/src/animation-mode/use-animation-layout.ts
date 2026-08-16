import { createComposeLayoutRuntime } from '@compose-ui/layout-engine'
import type { ComposeLayoutRuntimeState } from '@compose-ui/layout-engine'
import type { ComposeDocument } from '@compose-ui/core'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

/**
 * 动画模式专用的第二个 Layout Runtime，为采样文档求解布局。
 *
 * @remarks
 * 不复用 controller 的 Runtime：那个实例订阅着基础文档的事务流，从外部往里灌采样文档
 * 会和它自己的订阅互相覆盖，还要在退出模式时"恢复"——本质是把会话状态藏进别人的机器。
 * 第二个 Yoga 实例只在动画模式首次激活时创建，预览对话框走的也是独立 Runtime 的路子。
 */
export function useAnimationLayout(
  document: ComposeDocument | undefined,
  enabled: boolean,
): { readonly state: ComposeLayoutRuntimeState | null } {
  const [runtime, setRuntime] = useState<ReturnType<typeof createComposeLayoutRuntime> | null>(null)
  const runtimeRef = useRef(runtime)
  useEffect(() => {
    runtimeRef.current = runtime
  }, [runtime])

  useEffect(() => {
    if (!enabled || !document) return
    if (!runtimeRef.current) {
      setRuntime(createComposeLayoutRuntime({ document }))
      return
    }
    runtimeRef.current.updateDocument(document)
  }, [document, enabled])

  useEffect(() => () => {
    runtimeRef.current?.dispose()
  }, [])

  const subscribe = runtime?.subscribe ?? (() => () => undefined)
  const getState = runtime?.getState ?? (() => null)
  const state = useSyncExternalStore(subscribe, getState, getState)
  return { state: enabled ? state : null }
}
