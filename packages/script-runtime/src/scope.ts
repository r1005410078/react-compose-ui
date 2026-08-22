import type { ComposeNavigationPort, ComposePageReference } from '@compose-ui/core'
import { ComposeReactiveOwner, isComposeComputed, isComposeState } from './reactivity'
import type {
  ComposeComputed,
  ComposePageSetup,
  ComposePageScriptExport,
  ComposePageScriptScope,
  ComposePageScriptSnapshot,
  ComposeScriptDiagnostic,
  ComposeState,
} from './types'

interface ReactiveValueRecord {
  readonly kind: 'reactive-value'
  readonly cell: ComposeState<unknown> | ComposeComputed<unknown>
}

interface StaticValueRecord {
  readonly kind: 'static-value'
  readonly value: unknown
}

interface MethodRecord {
  readonly kind: 'method'
  readonly method: (...args: unknown[]) => unknown
}

type ExportRecord = ReactiveValueRecord | StaticValueRecord | MethodRecord

/** 创建页面 setup 实例时的调度选项。 @public */
export interface CreateComposePageScriptScopeOptions {
  /** 单次 microtask flush 内单个 Effect 的最大执行次数。 @defaultValue 100 */
  readonly maxEffectRunsPerFlush?: number
  /** 加载层传入的初始诊断。 */
  readonly initialDiagnostics?: readonly ComposeScriptDiagnostic[]
  /**
   * 宿主注入的导航端口。
   *
   * @remarks
   * 必须与声明式 `Interaction` 使用**同一个实例**，否则脚本跳转与画布配的跳转会各自
   * 维护一份当前页面与返回栈。缺省时 `ctx.navigate` 仍然存在，但调用只产生 diagnostic——
   * 让它不存在会把"宿主没接导航"变成 TypeError，脚本其余部分跟着一起挂掉。
   */
  readonly navigation?: ComposeNavigationPort
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * 调用 setup 并创建一个页面渲染实例独占的返回作用域。
 *
 * @remarks
 * 函数不执行源码转换。setup 必须同步返回普通对象；State/Computed/Function 只存在于运行时。
 * @public
 */
export function createComposePageScriptScope(
  setup: ComposePageSetup,
  options?: CreateComposePageScriptScopeOptions,
): ComposePageScriptScope
export function createComposePageScriptScope(
  setup: unknown,
  options?: CreateComposePageScriptScopeOptions,
): ComposePageScriptScope
export function createComposePageScriptScope(
  setup: unknown,
  options: CreateComposePageScriptScopeOptions = {},
): ComposePageScriptScope {
  const diagnostics: ComposeScriptDiagnostic[] = [...(options.initialDiagnostics ?? [])]
  const listeners = new Set<() => void>()
  const exportListeners = new Map<string, Set<() => void>>()
  const records = new Map<string, ExportRecord>()
  const changedExports = new Set<string>()
  let disposed = false
  let initializing = true
  let snapshotCache: ComposePageScriptSnapshot | undefined

  const notify = () => {
    if (disposed || initializing) return
    // 没有任何导出成员变化时不发布快照：脚本内部私有 State 的写入同样会触发一轮刷新，
    // 但它对作用域消费者不可见，不应唤醒 Inspector、脚本面板等全部订阅者。
    if (changedExports.size === 0) return
    snapshotCache = undefined
    const names = [...changedExports]
    changedExports.clear()
    listeners.forEach((listener) => { listener() })
    names.forEach((name) => {
      exportListeners.get(name)?.forEach((listener) => { listener() })
    })
  }
  const reportDiagnostic = (diagnostic: ComposeScriptDiagnostic) => {
    diagnostics.push(diagnostic)
    snapshotCache = undefined
    if (!initializing && !disposed) listeners.forEach((listener) => { listener() })
  }
  const owner = new ComposeReactiveOwner(
    reportDiagnostic,
    notify,
    options.maxEffectRunsPerFlush ?? 100,
  )

  const navigation = options.navigation
  const resolveTarget = (target: string | ComposePageReference): ComposePageReference | null => {
    if (typeof target !== 'string') return target
    return navigation ? navigation.referenceFor(target) : null
  }
  const guardNavigation = (): boolean => {
    if (!navigation) {
      reportDiagnostic({
        code: 'script.navigation-unavailable',
        message: '宿主未注入导航端口，跳转被忽略',
      })
      return false
    }
    if (initializing) {
      reportDiagnostic({
        code: 'script.navigation-during-setup',
        message: 'setup 同步执行期间不能跳转，调用被忽略',
      })
      return false
    }
    return true
  }
  const navigationContext = {
    async navigate(target: string | ComposePageReference) {
      if (!guardNavigation()) return
      const reference = resolveTarget(target)
      if (reference === null) return
      await navigation!.navigate(reference)
    },
    async navigateBack() {
      if (!guardNavigation()) return
      await navigation!.back()
    },
  }

  let returned: unknown
  if (typeof setup !== 'function') {
    reportDiagnostic({ code: 'script.missing-setup', message: '页面模块必须导出 setup 函数' })
  }
  else {
    try {
      returned = setup({ ...owner.context(), ...navigationContext })
    }
    catch (cause) {
      reportDiagnostic({
        code: 'script.setup-threw',
        message: cause instanceof Error ? cause.message : 'setup 执行失败',
        cause,
      })
    }
  }

  if (typeof setup === 'function' && !isPlainObject(returned)) {
    reportDiagnostic({
      code: 'script.invalid-return',
      message: 'setup 必须同步返回普通对象',
    })
  }
  else if (isPlainObject(returned)) {
    Object.entries(returned).forEach(([name, value]) => {
      if (isComposeState(value) || isComposeComputed(value)) {
        records.set(name, { kind: 'reactive-value', cell: value })
      }
      else if (typeof value === 'function') {
        records.set(name, { kind: 'method', method: value as (...args: unknown[]) => unknown })
      }
      else {
        records.set(name, { kind: 'static-value', value })
      }
    })
    records.forEach((record, name) => {
      if (record.kind !== 'reactive-value') return
      owner.createEffect(() => {
        void record.cell.value
        changedExports.add(name)
      })
    })
  }

  if (!isPlainObject(returned)) {
    owner.dispose()
  }
  // 导出跟踪 Effect 建立完毕后才密封：此后脚本再调用 ctx 原语只产生诊断。
  owner.seal()
  initializing = false
  changedExports.clear()

  const getExport = (name: string): ComposePageScriptExport | undefined => {
    const record = records.get(name)
    if (!record) return undefined
    if (record.kind === 'method') return { name, kind: 'method', method: record.method }
    if (record.kind === 'static-value') {
      return { name, kind: 'value', value: record.value, reactive: false }
    }
    return { name, kind: 'value', value: record.cell.value, reactive: true }
  }

  return {
    getSnapshot() {
      if (snapshotCache) return snapshotCache
      snapshotCache = {
        exports: [...records.keys()].flatMap((name) => {
          const current = getExport(name)
          return current ? [current] : []
        }),
        diagnostics: [...diagnostics],
        disposed,
      }
      return snapshotCache
    },
    getExport,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    subscribeExport(exportName, listener) {
      let target = exportListeners.get(exportName)
      if (!target) {
        target = new Set()
        exportListeners.set(exportName, target)
      }
      target.add(listener)
      return () => {
        target?.delete(listener)
        if (target?.size === 0) exportListeners.delete(exportName)
      }
    },
    invokeMethod(exportName, args) {
      if (disposed) return
      const record = records.get(exportName)
      if (record?.kind !== 'method') return
      let result: unknown
      try {
        result = record.method(...args)
      }
      catch (cause) {
        reportDiagnostic({
          code: 'script.method-threw',
          exportName,
          message: cause instanceof Error ? cause.message : `方法 ${exportName} 执行失败`,
          cause,
        })
        return
      }
      if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
        void Promise.resolve(result).catch((cause: unknown) => {
          if (disposed) return
          reportDiagnostic({
            code: 'script.method-rejected',
            exportName,
            message: cause instanceof Error ? cause.message : `方法 ${exportName} Promise 失败`,
            cause,
          })
        })
      }
    },
    reportDiagnostic,
    dispose() {
      if (disposed) return
      disposed = true
      snapshotCache = undefined
      owner.dispose()
      listeners.clear()
      exportListeners.clear()
      changedExports.clear()
    },
  }
}
