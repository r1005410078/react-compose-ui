import {
  createComposeLayoutRuntime,
  type ComposeLayoutRuntimeState,
} from '@compose-ui/layout-engine'
import type { ComposeLayoutSnapshot, TransactionRuntime } from '@compose-ui/core'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

/** Editor 会话拥有的 LayoutRuntime React 适配。 */
export function useComposeEditorLayout(
  documentRuntime: TransactionRuntime,
): {
  /** 提交态状态：预览求解期间仍返回最后一次正式提交的结果，供 Controller 与命令使用。 */
  readonly state: ComposeLayoutRuntimeState
  /** resize 手势实时布局的预览 Snapshot；只应交给场景渲染，不得进入交互 context。 */
  readonly previewSnapshot: ComposeLayoutSnapshot | null
  readonly runtime: ReturnType<typeof createComposeLayoutRuntime>
} {
  const [runtime] = useState(() => createComposeLayoutRuntime({
    document: documentRuntime.document,
  }))
  const rawState = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)
  // 预览求解会暂时替换 Runtime 的当前状态；提交态消费方（Controller context、SceneIndex、
  // 命令几何）必须继续看到最后一次正式提交的结果，否则手势会被自己的预览打断。
  const state = useSyncExternalStore(
    runtime.subscribe,
    runtime.getCommittedState,
    runtime.getCommittedState,
  )
  const previewSnapshot = rawState.status === 'ready' && rawState.preview
    ? rawState.snapshot
    : null
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
    previewSnapshot,
    state: state.document === documentRuntime.document
      ? state
      : { status: 'loading', document: documentRuntime.document },
  }
}
