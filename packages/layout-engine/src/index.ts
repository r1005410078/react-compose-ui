/**
 * 提供无 React、无 DOM 的 ComposeDocument v6 Yoga 布局运行时。
 *
 * @remarks
 * 公共 API 仅暴露 core 的 JSON 协议；Yoga Node、Config 与 WASM 指针始终留在包内。
 *
 * @packageDocumentation
 */

export { createComposeLayoutRuntime, resolveComposeDocumentLayout } from './layout-runtime'
export type {
  ComposeLayoutRuntime,
  ComposeLayoutRuntimeOptions,
  ComposeLayoutRuntimeState,
} from './layout-runtime'
