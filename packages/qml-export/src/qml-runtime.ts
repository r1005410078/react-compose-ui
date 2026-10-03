import globalsModule from './runtime/globals.mjs?raw'

/** 运行时模块里不属于「脚本全局」的生命周期导出。 */
const LIFECYCLE_EXPORTS = new Set(['attach', 'detach'])

/**
 * Qt 运行时替页面脚本补齐的全局名，按 `globals.mjs` 的导出读出来。
 *
 * @remarks
 * 从源码读而不是另写一份清单：清单与实现分开写，加了一个补齐却忘了登记（或反过来）时，编译器会
 * 往脚本里注入一个运行时根本没有的 import，症状是 Qt 上整个 setup 模块加载失败。它必须与
 * `@compose-ui/script-runtime` 的 `COMPOSE_PORTABLE_GLOBALS` 相同——本包不依赖那个包，校验放在
 * 两边都依赖的地方。
 *
 * @public
 */
export const COMPOSE_QML_RUNTIME_GLOBALS: readonly string[] = [...globalsModule.matchAll(/^export function (\w+)/gm)]
  .map((match) => match[1]!)
  .filter((name) => !LIFECYCLE_EXPORTS.has(name))
