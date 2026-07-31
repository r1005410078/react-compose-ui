import {
  createComposeLayoutRuntime,
  type ComposeLayoutRuntimeState,
} from '@compose-ui/layout-engine'
import type { TransactionRuntime } from '@compose-ui/core'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

/** Editor 会话拥有的 LayoutRuntime React 适配。 */
export function useComposeEditorLayout(
  documentRuntime: TransactionRuntime,
): {
  readonly state: ComposeLayoutRuntimeState
  readonly runtime: ReturnType<typeof createComposeLayoutRuntime>
} {
  const [runtime] = useState(() => createComposeLayoutRuntime({
    document: documentRuntime.document,
  }))
  const state = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)
  const generation = useRef(0)

  // 这条订阅必须先于 Controller 的文档 useSyncExternalStore 注册。命令提交时先同步
  // 求出新 Snapshot，再让 React 读取新文档，避免外部拖放的 pointerup 期间卸载 Stage。
  useLayoutEffect(() => {
    const update = () => runtime.updateDocument(documentRuntime.document)
    update()
    return documentRuntime.subscribe(update)
  }, [documentRuntime, runtime])
  useEffect(() => {
    generation.current += 1
    const mounted = generation.current
    return () => queueMicrotask(() => {
      if (generation.current === mounted) runtime.dispose()
    })
  }, [runtime])
  // 页面切换会直接替换 TransactionRuntime prop，此时订阅 effect 尚未运行；这一帧
  // 必须显示 loading，不能把旧页面 Snapshot 与新页面 document 交给严格 SceneIndex。
  return {
    runtime,
    state: state.document === documentRuntime.document
      ? state
      : { status: 'loading', document: documentRuntime.document },
  }
}
