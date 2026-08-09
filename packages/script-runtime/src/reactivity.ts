import type {
  ComposeComputed,
  ComposePageScriptContext,
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

/** 单个页面实例拥有的响应式 owner。 @internal */
export class ComposeReactiveOwner {
  private readonly effects: EffectRecord[] = []
  private readonly observers = new Set<ReactiveObserver>()
  private readonly pendingEffects = new Set<EffectRecord>()
  private flushScheduled = false
  private nextEffectId = 0
  private disposed = false

  constructor(
    private readonly reportDiagnostic: (diagnostic: ComposeScriptDiagnostic) => void,
    private readonly onFlushComplete: () => void,
    private readonly maxEffectRunsPerFlush: number,
  ) {}

  createState<T>(initial: T): ComposeState<T> {
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
    const dependency: Dependency = { observers: new Set() }
    let dirty = true
    let initialized = false
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
      }
      catch (cause) {
        this.reportDiagnostic({
          code: 'script.computed-threw',
          message: cause instanceof Error ? cause.message : 'Computed 执行失败',
          cause,
        })
      }
      finally {
        activeObserver = previous
        dirty = false
      }
    }

    return {
      [COMPUTED_BRAND]: true,
      get value() {
        track(dependency)
        if (dirty) evaluate()
        return initialized ? value : undefined as T
      },
    } as InternalComputed<T>
  }

  createEffect(run: () => void | (() => void)): void {
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
    const runCounts = new Map<number, number>()
    while (this.pendingEffects.size > 0 && !this.disposed) {
      const batch = [...this.pendingEffects]
      this.pendingEffects.clear()
      for (const effect of batch) {
        const runs = (runCounts.get(effect.id) ?? 0) + 1
        runCounts.set(effect.id, runs)
        if (runs > this.maxEffectRunsPerFlush) {
          effect.paused = true
          removeDependencies(effect)
          this.reportDiagnostic({
            code: 'script.effect-cycle',
            message: `Effect 在一次刷新中执行超过 ${this.maxEffectRunsPerFlush} 次，已暂停`,
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

  context(): ComposePageScriptContext {
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
