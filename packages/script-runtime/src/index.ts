/**
 * 提供无编译的页面 setup 响应式运行时与受信任 JavaScript Loader。
 *
 * @remarks
 * 本包无 React、无 Editor，并且不是安全沙箱。State、Computed 与 Function 只存在于页面实例内，
 * 永不写入 ComposeDocument。
 *
 * @packageDocumentation
 */

export { createComposePageScriptScope } from './scope'
export type { CreateComposePageScriptScopeOptions } from './scope'
export { COMPOSE_PAGE_SCRIPT_TYPE_DECLARATIONS } from './type-declarations'
export {
  ComposeScriptLoadError,
  createComposeJavaScriptModuleLoader,
  loadComposePageScriptScope,
} from './module-loader'
export type {
  ComposeLoadedScriptModule,
  ComposeScriptModule,
  ComposeScriptModuleLoader,
  CreateComposeJavaScriptModuleLoaderOptions,
} from './module-loader'
export type {
  ComposeComputed,
  ComposePageScriptContext,
  ComposePageScriptExport,
  ComposePageScriptScope,
  ComposePageScriptSnapshot,
  ComposePageSetup,
  ComposeScriptDiagnostic,
  ComposeScriptDiagnosticCode,
  ComposeState,
} from './types'

/** `@compose-ui/script-runtime` 的稳定包标识。 @public */
export const COMPOSE_UI_SCRIPT_RUNTIME_PACKAGE = '@compose-ui/script-runtime' as const
