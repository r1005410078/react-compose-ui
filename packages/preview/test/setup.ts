import { configure } from '@testing-library/react'
import '../../../test/setup'

/**
 * 放宽 Testing Library 异步工具的默认超时。
 *
 * preview 的测试渲染的是真实 ComposePreview，挂载时会异步加载 Yoga WASM，
 * 期间组件停在 role="status" 的加载态。默认 1000ms 在单包运行时够用，但在
 * monorepo 全量并发跑测试时 WASM 编译会被 CPU 争抢拖长，导致等待加载态消失的
 * 断言随机超时。这里只兜底调度延迟，不改变任何断言语义。
 */
configure({ asyncUtilTimeout: 10_000 })
