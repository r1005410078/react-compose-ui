import type { ComposePageFile, TransactionRuntime } from '@compose-ui/core'
import type { ComposeLibraryPort, ComposeLibraryRecord } from '@compose-ui/library'
import type { ReactNode } from 'react'
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

/** 缩略图与最近打开这条支线上的诊断。 @public */
export interface ComposeEditorLibraryDiagnostic {
  readonly code: 'thumbnail-failed' | 'record-open-failed'
  readonly pageKey: string
  readonly cause: unknown
}

/**
 * Editor 与页面库端口的接线。
 *
 * @remarks
 * 接上它，编辑器的 body 就多出**页面库**那一档，标志成为回库的门。除此之外 Editor 只用它做
 * 两件事：保存成功后异步上传缩略图，以及打开页面时记一次「最近打开」。
 * 它 MUST NOT 成为第二条保存入口——页面内容仍然只走 `ComposePageStore.writePage` 与它的
 * `expectedRevision` 乐观锁；同一件事的两个入口迟早写出两种行为。
 * @public
 */
export interface ComposeEditorLibraryConfig {
  readonly port: ComposeLibraryPort
  /**
   * 把一页渲染成缩略图。
   *
   * @remarks
   * **由宿主注入**：Editor 不认识光栅化。把 DOM 变成位图要么引一个第三方运行时（按本仓库的
   * 边界那要自己占一个包），要么走 `foreignObject` 序列化，两条都是独立的决定，不该作为保存
   * 路径的副作用被带进来。
   *
   * 缺席即不产出缩略图，图墙画占位——**缺一张图是可见的降级，不是失败**。
   *
   * @returns 渲染不出来时返回 `null`，MUST NOT 抛出。
   */
  readonly renderThumbnail?: (input: {
    readonly pageKey: string
    readonly page: ComposePageFile
    readonly signal?: AbortSignal
  }) => Promise<Blob | null>
  /**
   * 诊断出口。
   *
   * @remarks
   * 缺席即静默。这条支线**永远不打断用户**：让保存因为一张缩略图失败是不可接受的，
   * 而弹一个用户无从处理的错误只是把同一件事换个地方打断他。
   */
  readonly onDiagnostic?: (diagnostic: ComposeEditorLibraryDiagnostic) => void
  /**
   * 把一页渲染成真实画面，用于页面库的全屏演示。
   *
   * @remarks
   * **由宿主注入**，与 `renderThumbnail` 同一条理由：它就是既有的只读 `ComposePreview`，
   * 而 `editor` 与 `preview` 是同一层的两个入口包，谁也不该依赖谁。缺席即那一屏没有演示按钮
   * ——一个按下去什么都不发生的按钮比没有更差。
   */
  readonly renderPage?: (record: ComposeLibraryRecord) => ReactNode
  /**
   * 编辑器是否从页面库那一屏起手。
   *
   * @remarks
   * **缺席即 `true`**：页面库一旦接上就是应用入口，这是它的产品定位，因此既有宿主一个字节
   * 不改、行为逐字不变。缺席值取 `true` 而不是 `false` 是有理由的——反过来会让每一个已经接上
   * 库的宿主在升级之后静默换掉入口，而那个变化在屏幕上读起来像「页面库没了」。
   *
   * 给 `false` 表示「库可达但不抢入口」：标志那扇门、应用菜单里的「返回页面库」、图墙、全屏
   * 演示与「就用这个」照旧都在，收走的只是打开编辑器先看到哪一屏。
   *
   * 它**只喂初值，不是受控属性**：当前在不在库里仍然只有一个持有者，把它从 `true` 改成
   * `false` 不会把已经进了库的用户拽回画布。
   *
   * @defaultValue true
   */
  readonly openOnStart?: boolean
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
  /** 页面库接线；缺席时缩略图与「最近打开」都不产生。 */
  readonly library?: ComposeEditorLibraryConfig
}
