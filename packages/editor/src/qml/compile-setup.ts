import {
  COMPOSE_PORTABLE_SCRIPT_TARGET,
  composePortableGlobalsShim,
} from '@compose-ui/script-runtime'

/**
 * 把页面 setup 降级成 Qt（V4 引擎）能运行的 ES 模块。
 *
 * @remarks
 * 由宿主注入：编译器是一个约 10 MB 的 wasm，编辑器是库构建，打进来会被内联成 base64 进首屏。
 * {@link createComposeQmlScriptCompiler} 是默认实现，宿主只需给出 wasm 的 URL。
 *
 * @public
 */
export interface ComposeEditorQmlScriptCompiler {
  /**
   * @param source - 页面 setup 的源码（自包含 ES 模块，导出名为 `setup` 的函数）。
   * @returns 降级后的模块文本；全局名已改写为对 `./ComposeRuntime/globals.mjs` 的导入。
   * @throws 源码有语法错误或引用了别的模块时，`message` 是编译器给出的说明。
   */
  compile(source: string): Promise<string>
}

/** 降级后的 setup 写在产物根目录，从那里看过去的运行时全局模块。 */
const GLOBALS_SPECIFIER = './ComposeRuntime/globals.mjs'
const SHIM = 'compose-portable-globals'

type Esbuild = typeof import('esbuild-wasm')
let ready: Promise<Esbuild> | null = null

/**
 * 默认的 setup 编译器：`esbuild-wasm`，与 `@compose-ui/script-runtime` 构建可移植运行时用的是同一个
 * 编译器、同一个目标版本，两处降级语义一致。
 *
 * @remarks
 * 只在第一次 `compile` 时动态加载并初始化，不进编辑器首屏。esbuild 的 `initialize` 一个页面只能
 * 调用一次，因此初始化结果在模块里共享。
 *
 * 作者源码里对 `setTimeout`、`fetch` 等全局的引用由 `inject` 改写成对运行时全局模块的导入——V4 的
 * 全局对象只读，挂不上去；作者源码不变。
 *
 * @param options.wasmURL - `esbuild.wasm` 的地址；Node 环境可省略。
 * @public
 */
export function createComposeQmlScriptCompiler(
  options: { readonly wasmURL?: string | URL } = {},
): ComposeEditorQmlScriptCompiler {
  const load = () => {
    ready ??= import('esbuild-wasm').then(async (esbuild) => {
      await esbuild.initialize(options.wasmURL === undefined ? {} : { wasmURL: options.wasmURL })
      return esbuild
    })
    return ready
  }
  return {
    async compile(source) {
      const esbuild = await load()
      const result = await esbuild.build({
        stdin: { contents: source, loader: 'js', sourcefile: 'page.setup.js' },
        bundle: true,
        write: false,
        format: 'esm',
        target: COMPOSE_PORTABLE_SCRIPT_TARGET,
        inject: [SHIM],
        legalComments: 'none',
        logLevel: 'silent',
        plugins: [{
          name: 'compose-portable-globals',
          setup(build) {
            build.onResolve({ filter: new RegExp(`^${SHIM}$`) }, (args) => ({ path: args.path, namespace: SHIM }))
            build.onLoad({ filter: /.*/, namespace: SHIM }, () => ({
              contents: composePortableGlobalsShim(GLOBALS_SPECIFIER),
              loader: 'js',
            }))
            build.onResolve({ filter: /^\.\/ComposeRuntime\/globals\.mjs$/ }, (args) => ({
              path: args.path,
              external: true,
            }))
          },
        }],
      })
      return result.outputFiles[0]!.text
    },
  }
}
