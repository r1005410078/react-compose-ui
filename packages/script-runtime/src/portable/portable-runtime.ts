import source from 'virtual:compose-portable-runtime'

/**
 * 可移植运行时的模块文本：页面作用域与响应式原语，供 Qt（V4 引擎）等非浏览器宿主加载。
 *
 * @remarks
 * 由构建期从同一份 `scope` + `reactivity` 源码打出（降级到 {@link COMPOSE_PORTABLE_SCRIPT_TARGET}，
 * 补齐 `queueMicrotask` 与 `flatMap`），**不是**第二份实现。导出入口是 `createComposePageScriptScope`；
 * 导出到 Qt 时它被写成产物里的 `ComposeRuntime/script-runtime.mjs`。只在浏览器里运行脚本的宿主
 * 用不到它，打包器会把这段文本摇掉。
 *
 * @public
 */
export const COMPOSE_PORTABLE_RUNTIME_SOURCE: string = source
