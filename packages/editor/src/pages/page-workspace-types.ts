import type { ComposePageFile, TransactionRuntime } from '@compose-ui/core'
import type { ComposePageStore } from '@compose-ui/pages'
import type { ComposePageScriptScope, ComposeScriptModuleLoader } from '@compose-ui/script-runtime'

/** 当前活动页面的最小对外描述。 @public */
export interface ComposeEditorActivePage {
  /** 页面的稳定资源 key。 */
  readonly pageKey: string
  /** 去掉页面后缀的用户可见名称。 */
  readonly displayName: string
  /**
   * 该页面的事务运行时。
   *
   * @remarks
   * 宿主应把它作为 `useComposeEditorController` 的 `runtime`，使画布、场景树、Inspector 与
   * 历史面板跟随活动页面。Editor 保有每个已打开页面的运行时，因此各页面的撤销历史在切换
   * 标签后仍然保留。
   */
  readonly runtime: TransactionRuntime
  /** 页面文件聚合；宿主可据此组合独立 Preview。 */
  readonly page: ComposePageFile
  /** 当前页面标签独占的 setup 返回作用域。 */
  readonly scriptScope?: ComposePageScriptScope
}

/** Editor 的页面系统集成配置。 @public */
export interface ComposeEditorPagesConfig {
  /**
   * 页面 Store；省略时由 `assets.browser.provider` 派生。
   *
   * @remarks
   * 宿主自行创建 Store 时可与独立 Preview 共用同一实例，从而共享页面文档缓存。
   */
  readonly store?: ComposePageStore
  /** 页面 setup 使用的可替换模块 Loader；省略时由资源 Resolver 创建默认 JavaScript Loader。 */
  readonly scriptModuleLoader?: ComposeScriptModuleLoader
  /**
   * 活动页面变更回调。
   *
   * @remarks
   * 宿主必须据此切换传给 `useComposeEditorController` 的 `runtime`。没有页面打开时参数为 null，
   * 此时工作区回退到宿主自己的 controller。
   */
  readonly onActiveSessionChange?: (session: ComposeEditorActivePage | null) => void
  /** 首页指向变更回调。 */
  readonly onHomePageChange?: (pageKey: string | null) => void
}
