/**
 * 页面 Setup JavaScript 编辑器使用的全局类型声明。
 *
 * @remarks
 * 声明作为 Monaco JavaScript Language Service 的额外 `.d.ts` 注入，不会拼接到用户源码，
 * 也不参与 Script Runtime 的加载或执行。修改 Runtime 公共类型时必须同步更新此声明。
 *
 * @public
 */
export const COMPOSE_PAGE_SCRIPT_TYPE_DECLARATIONS = `
/** 通过 .value 读写的页面响应式状态。 */
interface ComposeState<T> {
  /** 当前值；写入不同值时通知依赖它的 computed 与 effect。 */
  value: T
}

/** 由 state 或其他 computed 派生的只读值。 */
interface ComposeComputed<T> {
  /** 当前派生值；依赖变化后会在下次读取时重新计算。 */
  readonly value: T
}

/**
 * 页面 setup 函数可使用的响应式工具集合。
 *
 * 三个方法只能在 setup 同步执行期间调用。setup 返回后（例如在事件方法或 effect 内部）
 * 再调用不会注册到页面实例，只会产生一条诊断并返回不参与响应式的降级对象。
 */
interface ComposePageScriptContext {
  /**
   * 创建可读写的响应式状态。传入 initial 时会自动推导 value 类型；不传时为 undefined。
   * 写入新值后，依赖该状态的 computed 与 effect 会自动更新。
   *
   * 示例：
   * \`\`\`javascript
   * const count = ctx.state(0)
   * count.value += 1
   * const selected = ctx.state()
   * selected.value = 'first'
   * \`\`\`
   */
  state(): ComposeState<undefined>

  /**
   * 创建可读写的响应式状态，并从 initial 自动推导 value 类型。
   * 写入新值后，依赖该状态的 computed 与 effect 会自动更新。
   *
   * 示例：
   * \`\`\`javascript
   * const count = ctx.state(0)
   * count.value += 1
   * \`\`\`
   *
   * @param initial 状态的初始值。
   */
  state<T>(initial: T): ComposeState<T>

  /**
   * 创建只读派生值。读取函数中访问的 state 与 computed 会被自动跟踪，
   * 依赖变化后在下次读取 value 时重新计算。
   * 读取函数抛错时 value 为 undefined，依赖修复并重算成功后自动恢复。
   *
   * 示例：
   * \`\`\`javascript
   * const count = ctx.state(0)
   * const doubled = ctx.computed(() => count.value * 2)
   * return { count, doubled }
   * \`\`\`
   *
   * @param read 计算并返回派生值的函数。
   */
  computed<T>(read: () => T): ComposeComputed<T>

  /**
   * 注册响应式副作用。run 会立即执行，并自动跟踪执行期间读取的响应式值；
   * 依赖变化时会先调用上一次返回的 cleanup，再重新执行。页面销毁时也会调用 cleanup。
   *
   * 示例：
   * \`\`\`javascript
   * const count = ctx.state(0)
   * ctx.effect(() => {
   *   const current = count.value
   *   const timer = setTimeout(() => console.log(current), 1000)
   *   return () => clearTimeout(timer)
   * })
   * \`\`\`
   *
   * @param run 副作用函数；可以返回 cleanup 清理函数。
   */
  effect(run: () => void | (() => void)): void

  /**
   * 跳转到目标页面。target 是页面的资源 key，也可以传一个完整的页面引用对象。
   *
   * 与画布上配置的点击跳转共用同一份当前页面与返回栈。
   * 只能在事件方法或 effect 中调用；在 setup 同步执行期间调用会被忽略并产生一条诊断。
   *
   * 示例：
   * \`\`\`javascript
   * return {
   *   openDetail: () => ctx.navigate('pages/detail.page.json'),
   * }
   * \`\`\`
   *
   * @param target 目标页面的资源 key，或完整页面引用。
   */
  navigate(target: string | { kind: 'page', providerId: string, assetKey: string, scope: string }): Promise<void>

  /** 返回上一页；没有可返回的页面时什么都不做。 */
  navigateBack(): Promise<void>
}

/** 页面 setup 函数；返回对象中的状态与方法可用于画布属性和事件绑定。 */
type ComposePageSetup = (
  context: ComposePageScriptContext,
) => Record<string, unknown>
`.trim()
