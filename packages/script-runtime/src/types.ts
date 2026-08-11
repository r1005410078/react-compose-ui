/** 页面脚本运行时的稳定诊断码。 @public */
export type ComposeScriptDiagnosticCode =
  | 'script.missing-setup'
  | 'script.setup-threw'
  | 'script.invalid-return'
  | 'script.effect-threw'
  | 'script.effect-cleanup-threw'
  | 'script.effect-invalid-cleanup'
  | 'script.effect-cycle'
  | 'script.context-after-setup'
  | 'script.computed-threw'
  | 'script.method-threw'
  | 'script.method-rejected'
  | 'script.unsupported-module'
  | 'script.module-load-failed'
  | 'script.module-load-cancelled'

/** 不进入文档历史的页面脚本运行诊断。 @public */
export interface ComposeScriptDiagnostic {
  readonly code: ComposeScriptDiagnosticCode
  readonly message: string
  readonly exportName?: string
  readonly cause?: unknown
}

/** 通过 `.value` 读写的页面实例响应式状态。 @public */
export interface ComposeState<T> {
  /** 当前值；写入不同值时通知依赖它的 computed 与 effect。 */
  value: T
}

/** 通过只读 `.value` 获取的派生值。 @public */
export interface ComposeComputed<T> {
  /** 当前派生值；依赖变化后会在下次读取时重新计算。 */
  readonly value: T
}

/** setup 可使用的无编译响应式上下文。 @public */
export interface ComposePageScriptContext {
  /**
   * 创建初始值为 `undefined` 的响应式状态。
   *
   * @returns 可通过 `.value` 读写的 State。
   * @example
   * ```js
   * const selected = ctx.state()
   * selected.value = 'first'
   * ```
   */
  state(): ComposeState<undefined>

  /**
   * 创建响应式状态，并从初始值推导 `.value` 类型。
   *
   * @param initial 状态的初始值。
   * @returns 可通过 `.value` 读写的 State。
   * @example
   * ```js
   * const count = ctx.state(0)
   * count.value += 1
   * ```
   */
  state<T>(initial: T): ComposeState<T>

  /**
   * 创建只读派生值，并自动跟踪读取函数访问的 State 与 Computed。
   *
   * @param read 计算并返回派生值的函数。
   * @returns 可通过只读 `.value` 获取的 Computed。
   * @example
   * ```js
   * const doubled = ctx.computed(() => count.value * 2)
   * ```
   */
  computed<T>(read: () => T): ComposeComputed<T>

  /**
   * 注册立即执行且自动跟踪依赖的副作用。
   *
   * @remarks
   * 依赖变化时先调用上一次返回的 cleanup，再重新执行；页面销毁时也会调用 cleanup。
   *
   * @param run 副作用函数；可以返回 cleanup 清理函数。
   * @example
   * ```js
   * const count = ctx.state(0)
   * ctx.effect(() => {
   *   const current = count.value
   *   const timer = setTimeout(() => console.log(current), 1000)
   *   return () => clearTimeout(timer)
   * })
   * ```
   */
  effect(run: () => void | (() => void)): void
}

/** 页面 setup 函数。 @public */
export type ComposePageSetup = (context: ComposePageScriptContext) => Record<string, unknown>

/** 页面作用域中的当前成员快照。 @public */
export type ComposePageScriptExport =
  | {
      readonly name: string
      readonly kind: 'value'
      readonly value: unknown
      readonly reactive: boolean
    }
  | {
      readonly name: string
      readonly kind: 'method'
      readonly method: (...args: unknown[]) => unknown
    }

/** 页面脚本实例的只读快照。 @public */
export interface ComposePageScriptSnapshot {
  readonly exports: readonly ComposePageScriptExport[]
  readonly diagnostics: readonly ComposeScriptDiagnostic[]
  readonly disposed: boolean
}

/** 每次页面渲染实例独占的 setup 返回作用域。 @public */
export interface ComposePageScriptScope {
  getSnapshot(): ComposePageScriptSnapshot
  getExport(exportName: string): ComposePageScriptExport | undefined
  subscribe(listener: () => void): () => void
  subscribeExport(exportName: string, listener: () => void): () => void
  /** 调用方法并把同步异常与 Promise rejection 隔离为 diagnostic。 */
  invokeMethod(exportName: string, args: readonly unknown[]): void
  /** 由绑定与加载适配层发布同一实例生命周期内的诊断。 */
  reportDiagnostic(diagnostic: ComposeScriptDiagnostic): void
  dispose(): void
}
