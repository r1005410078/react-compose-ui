import type { ComposeAssetResolver } from '@compose-ui/assets'
import type { ComposePageSetupReference } from '@compose-ui/core'
import { createComposePageScriptScope } from './scope'
import type {
  ComposePageScriptScope,
  ComposeScriptDiagnosticCode,
} from './types'

/** Loader 返回的已执行 ESM 命名导出。 @public */
export interface ComposeScriptModule {
  readonly setup?: unknown
  readonly [exportName: string]: unknown
}

/** 一次模块加载结果。 @public */
export interface ComposeLoadedScriptModule {
  readonly module: ComposeScriptModule
  readonly revision: string
}

/** 宿主可替换的页面脚本模块加载端口。 @public */
export interface ComposeScriptModuleLoader {
  load(
    reference: ComposePageSetupReference,
    signal?: AbortSignal,
  ): Promise<ComposeLoadedScriptModule>
}

/** 默认 Loader 与页面实例协调层使用的稳定加载错误。 @public */
export class ComposeScriptLoadError extends Error {
  readonly code: Extract<
    ComposeScriptDiagnosticCode,
    'script.unsupported-module' | 'script.module-load-failed' | 'script.module-load-cancelled'
  >
  readonly cause?: unknown

  constructor(
    code: ComposeScriptLoadError['code'],
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message)
    this.name = 'ComposeScriptLoadError'
    this.code = code
    this.cause = options?.cause
  }
}

/** 默认同 Realm JavaScript ESM Loader 的依赖。 @public */
export interface CreateComposeJavaScriptModuleLoaderOptions {
  readonly assetResolver: ComposeAssetResolver
  readonly importModule?: (url: string) => Promise<ComposeScriptModule>
  readonly createObjectURL?: (blob: Blob) => string
  readonly revokeObjectURL?: (url: string) => void
}

function isJavaScript(reference: ComposePageSetupReference, mediaType: string): boolean {
  const normalizedType = mediaType.toLowerCase().split(';', 1)[0]?.trim() ?? ''
  const assetKey = reference.assetKey.toLowerCase()
  if (normalizedType.includes('typescript') || /\.[cm]?tsx?$/u.test(assetKey)) return false
  return [
    'application/javascript',
    'text/javascript',
    'application/ecmascript',
    'text/ecmascript',
  ].includes(normalizedType) || /\.[cm]?js$/u.test(assetKey)
}

/**
 * 创建只执行受信任、自包含 JavaScript ESM 的默认同 Realm Loader。
 *
 * @remarks
 * 不转译 TypeScript，不解析 npm/相对 import 图，也不提供安全沙箱。
 * @public
 */
export function createComposeJavaScriptModuleLoader(
  options: CreateComposeJavaScriptModuleLoaderOptions,
): ComposeScriptModuleLoader {
  const importModule = options.importModule ?? (async (url: string) =>
    import(/* @vite-ignore */ url) as Promise<ComposeScriptModule>)
  const createObjectURL = options.createObjectURL ?? ((blob: Blob) => URL.createObjectURL(blob))
  const revokeObjectURL = options.revokeObjectURL ?? ((url: string) => { URL.revokeObjectURL(url) })

  return {
    async load(reference, signal) {
      let resolved
      try {
        resolved = await options.assetResolver.resolve({ reference, signal })
      }
      catch (cause) {
        if (signal?.aborted) {
          throw new ComposeScriptLoadError('script.module-load-cancelled', '页面脚本加载已取消', { cause })
        }
        throw new ComposeScriptLoadError('script.module-load-failed', '页面脚本资源读取失败', { cause })
      }
      if (!isJavaScript(reference, resolved.mediaType)) {
        throw new ComposeScriptLoadError(
          'script.unsupported-module',
          `默认 Loader 只支持自包含 JavaScript ESM：${reference.assetKey}`,
        )
      }

      const moduleUrl = createObjectURL(resolved.blob)
      try {
        const loaded = await importModule(moduleUrl)
        return { module: loaded, revision: resolved.revision }
      }
      catch (cause) {
        if (signal?.aborted) {
          throw new ComposeScriptLoadError('script.module-load-cancelled', '页面脚本加载已取消', { cause })
        }
        throw new ComposeScriptLoadError(
          'script.module-load-failed',
          '页面脚本导入失败；请检查语法、CSP 与自包含 import 约束',
          { cause },
        )
      }
      finally {
        // `import()` resolve 时模块已完成求值，因此可以立即释放 Blob URL。代价是模块
        // 之后拿不回自己的 URL：内部的动态 `import()`、`import.meta.url` 和
        // `new Worker(import.meta.url)` 都会失败，且错误不会指向这里。这是「自包含
        // JavaScript」约束的具体含义，放宽它需要改为按实例持有并在 dispose 时释放。
        revokeObjectURL(moduleUrl)
      }
    },
  }
}

/**
 * 加载 setup 模块并建立页面实例作用域。
 *
 * @remarks
 * 本函数**永不 reject**：资源失败、模块导入失败和取消都会 resolve 出一个带对应
 * diagnostic 的空作用域，让页面可以继续用文档字面 Props 渲染。
 *
 * 因此取消不会体现为异常——调用方必须在 resolve 后自行检查 `signal.aborted` 或自己的
 * 卸载标记，并 dispose 这个迟到到达的作用域，否则它的 Effect 会继续运行。React 消费方
 * 应改用 `@compose-ui/component-registry` 的 `useComposePageScriptScope`，它已经封装了
 * 这套竞态处理。
 *
 * @public
 */
export async function loadComposePageScriptScope(input: {
  readonly reference: ComposePageSetupReference
  readonly loader: ComposeScriptModuleLoader
  readonly signal?: AbortSignal
}): Promise<{ readonly scope: ComposePageScriptScope; readonly revision: string | null }> {
  try {
    const loaded = await input.loader.load(input.reference, input.signal)
    return {
      scope: createComposePageScriptScope(loaded.module.setup),
      revision: loaded.revision,
    }
  }
  catch (cause) {
    const error = cause instanceof ComposeScriptLoadError
      ? cause
      : new ComposeScriptLoadError('script.module-load-failed', '页面脚本加载失败', { cause })
    return {
      scope: createComposePageScriptScope(() => ({}), {
        initialDiagnostics: [{
          code: error.code,
          message: error.message,
          cause: error.cause,
        }],
      }),
      revision: null,
    }
  }
}
