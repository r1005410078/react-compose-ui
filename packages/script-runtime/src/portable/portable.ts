/**
 * 可移植运行时（Qt Quick 的 V4 引擎等非浏览器宿主）的唯一一份约定。
 *
 * @remarks
 * 「降到哪个语法版本」「补齐哪些全局」在构建期（本包的可移植产物）与导出期（编辑器降级作者的
 * setup）两处都要用，写在这里一处——两处各写一份的症状是「运行时能跑、作者的脚本在 Qt 里报语法
 * 错误」，而那只在现场出现。
 */

/**
 * 降级编译的目标语法版本。
 *
 * @remarks
 * Qt 6.8 的 V4 实测：`async`/`await`、对象展开、类字段、`catch` 省略绑定、逻辑赋值都解析失败；
 * 生成器、可选链与 `??` 支持。ES2016 让编译器把 `async` 降成生成器、把对象展开降成
 * `Object.assign`，可选链与 `??` 也一并降掉（无害）。
 *
 * @public
 */
export const COMPOSE_PORTABLE_SCRIPT_TARGET = 'es2016'

/**
 * 可移植宿主替脚本补齐的全局名。
 *
 * @remarks
 * V4 的全局对象是只读的，不能像浏览器那样往上挂；因此导出时由编译器把脚本里对这些名字的引用
 * 改写成对宿主全局模块的 import（esbuild 的 `inject`），作者源码不变。不在这里的浏览器全局
 * （`window`、`document`、`structuredClone`、`WeakRef`……）在可移植宿主上不存在。
 *
 * @public
 */
export const COMPOSE_PORTABLE_GLOBALS = [
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'queueMicrotask',
  'fetch',
  'WebSocket',
] as const

/**
 * 可移植宿主上**不存在**的浏览器全局：脚本引用它们在 Qt 里会抛 `ReferenceError`。
 *
 * @remarks
 * 编辑器的可移植模式据此在写脚本时就标错，而不是到 Qt 上跑起来才发现。清单是保守的——列的都是
 * V4 确实没有的：DOM 与 BOM（`window`、`document`、`location`……）、存储、实测缺失的
 * `structuredClone` / `WeakRef` / `globalThis`，以及 V4 没有的 Web API（`URL`、`Blob`、
 * `TextEncoder`、`AbortController`……）。`fetch` 不在这里：它被补齐了，但只是子集——`method` /
 * `headers` / `body` 与 `Response.text()` / `json()`，不支持流与 `AbortSignal`，Qt 里也没有同源策略。
 *
 * @public
 */
export const COMPOSE_PORTABLE_UNAVAILABLE_GLOBALS = [
  'window',
  'self',
  'globalThis',
  'document',
  'navigator',
  'location',
  'history',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'alert',
  'confirm',
  'prompt',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'matchMedia',
  'getComputedStyle',
  'customElements',
  'structuredClone',
  'WeakRef',
  'FinalizationRegistry',
  'Blob',
  'File',
  'FileReader',
  'URL',
  'URLSearchParams',
  'Worker',
  'EventSource',
  'TextEncoder',
  'TextDecoder',
  'AbortController',
] as const

/** 可移植全局名。 @public */
export type ComposePortableGlobal = typeof COMPOSE_PORTABLE_GLOBALS[number]

/**
 * 生成编译器 `inject` 用的垫片模块源码：把每个可移植全局转导自宿主的全局模块。
 *
 * @param globalsSpecifier - 从被编译的模块看过去，宿主全局模块的导入路径。
 * @public
 */
export function composePortableGlobalsShim(globalsSpecifier: string): string {
  return `export { ${COMPOSE_PORTABLE_GLOBALS.join(', ')} } from ${JSON.stringify(globalsSpecifier)}\n`
}
