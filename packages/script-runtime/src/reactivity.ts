import type {
  ComposeComputed,
  ComposeReactivePrimitives,
  ComposeScriptDiagnostic,
  ComposeState,
} from './types'

const STATE_BRAND = Symbol('compose-state')
const COMPUTED_BRAND = Symbol('compose-computed')

interface Dependency {
  readonly observers: Set<ReactiveObserver>
}

interface ReactiveObserver {
  readonly dependencies: Set<Dependency>
  active: boolean
  schedule(): void
}

interface InternalState<T> extends ComposeState<T> {
  readonly [STATE_BRAND]: true
}

interface InternalComputed<T> extends ComposeComputed<T> {
  readonly [COMPUTED_BRAND]: true
}

interface EffectRecord extends ReactiveObserver {
  readonly id: number
  readonly run: () => void
  cleanup?: () => void
  paused: boolean
}

let activeObserver: ReactiveObserver | null = null

function removeDependencies(observer: ReactiveObserver): void {
  observer.dependencies.forEach((dependency) => { dependency.observers.delete(observer) })
  observer.dependencies.clear()
}

function track(dependency: Dependency): void {
  if (!activeObserver?.active) return
  dependency.observers.add(activeObserver)
  activeObserver.dependencies.add(dependency)
}

/** 在不建立依赖关系的情况下求值，用于 setup 之外创建的降级 Computed。 */
function untracked<T>(read: () => T): T {
  const previous = activeObserver
  activeObserver = null
  try {
    return read()
  }
  finally {
    activeObserver = previous
  }
}

/** 单个页面实例拥有的响应式 owner。 @internal */
export class ComposeReactiveOwner {
  private readonly effects: EffectRecord[] = []
  private readonly observers = new Set<ReactiveObserver>()
  private readonly pendingEffects = new Set<EffectRecord>()
  private flushScheduled = false
  private nextEffectId = 0
  private disposed = false
  private sealed = false

  constructor(
    private readonly reportDiagnostic: (diagnostic: ComposeScriptDiagnostic) => void,
    private readonly onFlushComplete: () => void,
    private readonly maxEffectRunsPerFlush: number,
  ) {}

  /**
   * 密封响应式 context。setup 返回后调用，之后新建的原语不再注册到本实例。
   *
   * @remarks
   * 没有这道闸门时，在 Effect 内部创建 Computed/Effect 会让 `observers` 与 `effects`
   * 只增不减，且旧 Effect 继续订阅依赖并执行，形成无界增长。
   */
  seal(): void {
    this.sealed = true
  }

  private reportContextAfterSetup(api: 'state' | 'computed' | 'effect'): void {
    this.reportDiagnostic({
      code: 'script.context-after-setup',
      message: `ctx.${api}() 只能在 setup 同步执行期间调用，本次调用不会注册到页面实例`,
    })
  }

  createState<T>(initial: T): ComposeState<T> {
    if (this.sealed) {
      this.reportContextAfterSetup('state')
      // 降级为普通可读写 Cell：不跟踪依赖，也不参与调度。
      return { value: initial } as InternalState<T>
    }
    const dependency: Dependency = { observers: new Set() }
    let value = initial
    const scheduleObservers = () => {
      if (this.disposed) return
      ;[...dependency.observers].forEach((observer) => { observer.schedule() })
    }
    return {
      [STATE_BRAND]: true,
      get value() {
        track(dependency)
        return value
      },
      set value(next: T) {
        if (Object.is(value, next)) return
        value = next
        scheduleObservers()
      },
    } as InternalState<T>
  }

  createComputed<T>(read: () => T): ComposeComputed<T> {
    if (this.sealed) {
      this.reportContextAfterSetup('computed')
      // 降级为不跟踪依赖的惰性求值：保持 `.value` 可读，误用只表现为一条诊断。
      return { get value() { return untracked(read) } } as InternalComputed<T>
    }
    const dependency: Dependency = { observers: new Set() }
    let dirty = true
    let initialized = false
    let errored = false
    let value: T
    const observer: ReactiveObserver = {
      dependencies: new Set(),
      active: true,
      schedule: () => {
        if (dirty || this.disposed) return
        dirty = true
        ;[...dependency.observers].forEach((subscriber) => { subscriber.schedule() })
      },
    }
    this.observers.add(observer)

    const evaluate = () => {
      removeDependencies(observer)
      const previous = activeObserver
      activeObserver = observer
      try {
        value = read()
        initialized = true
        errored = false
      }
      catch (cause) {
        errored = true
        this.reportDiagnostic({
          code: 'script.computed-threw',
          message: cause instanceof Error ? cause.message : 'Computed 执行失败',
          cause,
        })
      }
      finally {
        activeObserver = previous
        // 即使抛错也退出 dirty：`.value` 可能在一次渲染中被读多次，保持 dirty 会让
        // 每次读取都重新抛错并重复发布同一条诊断。抛错点之前已跟踪到的依赖变化仍会
        // 通过 schedule() 把 dirty 置回 true，从而获得重算机会。
        dirty = false
      }
    }

    return {
      [COMPUTED_BRAND]: true,
      get value() {
        track(dependency)
        if (dirty) evaluate()
        // 抛错时返回 undefined 而不是上一次的成功结果：陈旧值看起来正常，会让消费者
        // 把失效数据当成有效数据继续使用。
        if (errored || !initialized) return undefined as T
        return value
      },
    } as InternalComputed<T>
  }

  createEffect(run: () => void | (() => void)): void {
    if (this.sealed) {
      this.reportContextAfterSetup('effect')
      return
    }
    const record: EffectRecord = {
      id: this.nextEffectId++,
      dependencies: new Set(),
      active: true,
      paused: false,
      run: () => {
        if (!record.active || record.paused || this.disposed) return
        this.runCleanup(record)
        removeDependencies(record)
        const previous = activeObserver
        activeObserver = record
        try {
          const cleanup = run()
          if (typeof cleanup === 'function') {
            record.cleanup = cleanup
          }
          else if (cleanup !== undefined) {
            this.reportDiagnostic({
              code: 'script.effect-invalid-cleanup',
              message: 'Effect 只能返回 cleanup 函数或 undefined',
            })
          }
        }
        catch (cause) {
          this.reportDiagnostic({
            code: 'script.effect-threw',
            message: cause instanceof Error ? cause.message : 'Effect 执行失败',
            cause,
          })
        }
        finally {
          activeObserver = previous
        }
      },
      schedule: () => {
        if (!record.active || record.paused || this.disposed) return
        this.pendingEffects.add(record)
        this.scheduleFlush()
      },
    }
    this.effects.push(record)
    this.observers.add(record)
    record.run()
  }

  private runCleanup(record: EffectRecord): void {
    const cleanup = record.cleanup
    record.cleanup = undefined
    if (!cleanup) return
    try {
      cleanup()
    }
    catch (cause) {
      this.reportDiagnostic({
        code: 'script.effect-cleanup-threw',
        message: cause instanceof Error ? cause.message : 'Effect cleanup 执行失败',
        cause,
      })
    }
  }

  private scheduleFlush(): void {
    if (this.flushScheduled || this.disposed) return
    this.flushScheduled = true
    queueMicrotask(() => { this.flush() })
  }

  private flush(): void {
    this.flushScheduled = false
    if (this.disposed) return
    // 调度上限是「单轮刷新内的收敛保护」，不是对 Effect 的永久判决：上一轮被截断的
    // Effect 在这一轮重新参与调度，因此一次合法的写入突发不会永久停用它，而真正的
    // 死循环每轮仍会被截断并再次告警。
    this.effects.forEach((effect) => { effect.paused = false })
    const runCounts = new Map<number, number>()
    while (this.pendingEffects.size > 0 && !this.disposed) {
      const batch = [...this.pendingEffects]
      this.pendingEffects.clear()
      for (const effect of batch) {
        const runs = (runCounts.get(effect.id) ?? 0) + 1
        runCounts.set(effect.id, runs)
        if (runs > this.maxEffectRunsPerFlush) {
          // 只暂停本轮；保留依赖订阅，否则复位后它再也不会被任何依赖唤醒。
          effect.paused = true
          this.reportDiagnostic({
            code: 'script.effect-cycle',
            message: `Effect 在一次刷新中执行超过 ${this.maxEffectRunsPerFlush} 次，本轮刷新已中止`,
          })
          continue
        }
        effect.run()
      }
    }
    this.onFlushComplete()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.pendingEffects.clear()
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index]!
      effect.active = false
      this.runCleanup(effect)
    }
    this.observers.forEach((observer) => {
      observer.active = false
      removeDependencies(observer)
    })
  }

  /**
   * 只含响应式原语的上下文子集。
   *
   * @remarks
   * 返回类型刻意不是完整的 `ComposePageScriptContext`——导航由宿主端口提供，
   * 响应式 owner 不应该知道页面之间怎么跳。scope 负责把两半合成交给 setup。
   */
  context(): ComposeReactivePrimitives {
    return {
      state: <T>(initial?: T) => this.createState(initial as T),
      computed: <T>(read: () => T) => this.createComputed(read),
      effect: (run) => { this.createEffect(run) },
    }
  }
}

/** @internal */
export function isComposeState(value: unknown): value is ComposeState<unknown> {
  return typeof value === 'object' && value !== null && STATE_BRAND in value
}

/** @internal */
export function isComposeComputed(value: unknown): value is ComposeComputed<unknown> {
  return typeof value === 'object' && value !== null && COMPUTED_BRAND in value
}
