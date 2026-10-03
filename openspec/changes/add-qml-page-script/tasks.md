# 任务

## 0. Spike（先做，结论回写 design.md）

- [x] 0.1 Qt 6.8 中：QML `import` ES 模块、`Promise`、`async`/`await`、可选链、`??`
      - 逐项结果见 design.md「语法支持」：`async`/`await`、对象展开、类字段等解析失败；可选链与 `??` 支持。
- [x] 0.2 手工打包 `reactivity` + `scope`，在 V4 中创建作用域
      - `esbuild --target=es2016` + 两行前置补齐（`queueMicrotask`、`flatMap`）后可用。
- [x] 0.3 `Timer` 驱动 state → QML 文本刷新整条链路
      - 三次 `tick` 后 `3 / count 3 / effect saw 3`，诊断为空。
- [x] 0.4 结论写入 design.md「语法支持」一节；若需降级编译，补充依赖决策并重新评审
      - 需要降级编译；浏览器内编译器（候选 `esbuild-wasm`）待评审。

## 1. 可移植运行时产物

- [x] 1.1 `script-runtime` 构建新增自包含 ES 模块产物，不含浏览器全局引用
      - 构建插件（`scripts/portable-runtime-plugin.ts`）用 esbuild 0.28.1 把同一份源码打成 ES2016 模块（`inject`
        补 `queueMicrotask` 与 `flatMap`），以字符串常量 `COMPOSE_PORTABLE_RUNTIME_SOURCE` 从包根导出。
      - Red：首版产出 `dist/portable/` 文件、编辑器按子路径 `?raw` 导入，被架构检查拒绝（跨包只许从包根
        导入）→ 改为包根常量；构建与 Vitest 用同一个插件。
- [x] 1.2 用例：在无浏览器全局的环境中 import 并创建作用域
      - Red：`vm` 新上下文里创建作用域报 `script.invalid-return`——setup 写在测试这一侧，跨 realm 的对象
        原型不是该上下文的 `Object.prototype`；setup 改在同一上下文里定义后通过。
- [x] 1.3 可移植全局清单与不可用清单（含 `fetch` 子集差异说明）
      - `COMPOSE_PORTABLE_GLOBALS` / `COMPOSE_PORTABLE_UNAVAILABLE_GLOBALS`；不另出类型声明——Monaco 的 DOM
        lib 被所有编辑器共享，见 4.2。

## 2. Qt 运行时模块

- [x] 2.1 运行时 `qmldir`、`ComposePage.qml`
      - 改为随产物走：住 `packages/qml-export/src/runtime/`，导出时写进 `ComposeRuntime/`（见 design.md）。
- [x] 2.2 `globals.mjs`：定时器、`fetch`、`WebSocket` 补齐，页面销毁时释放
      - Red：WebSocket 连接被拒时 `onclose` 触发两次（QtWebSockets 先报 Closed 再报 Error）→ Closed 推迟
        一拍、close 只发一次；冒烟结果 `error 连接被拒绝` → `close 1006`。
      - `fetch` 相对路径相对场景目录解析（`script-fetch` 夹具读到 `42.5 kW`）。
- [x] 2.3 ~~复制运行时产物并加哈希一致性校验~~：运行时随产物走，没有副本可校验；改为断言产物里的
      `script-runtime.mjs` 就是构建产物（`export-active-scene.test.ts`）。
- [x] 2.4 一致性校验：可移植清单与运行时补齐清单一致
      - `COMPOSE_QML_RUNTIME_GLOBALS` 从 `globals.mjs` 源码读出，编辑器用例断言与 `COMPOSE_PORTABLE_GLOBALS` 相同。
- [x] 2.5 `qt-version.json` 加入 `qtwebsockets`

## 3. 导出器

- [x] 3.1 从 `Bindings` 收集导出名，生成 `page` 对象
      - 属性初值改为 `undefined`、回退写进每个绑定表达式（同一导出被两个静态值不同的对象绑定时，初值
        只能取其一）。
- [x] 3.2 被绑定 prop 生成 `page.x` 绑定（Vitest）
      - 可动态化：文字 `text` / `color`、曲线 `stroke`（含箭头填充）；其余与实例内部的绑定静态并报诊断。
- [x] 3.3 产物改为文件列表；无 setup 时与静态导出一致

## 4. 编辑器

- [x] 4.1 导出打包为 zip（`fflate`）；setup 经宿主注入的 `qmlScriptCompiler`（esbuild-wasm）降级
      - 编译用例在 node 环境跑：jsdom 的 `TextEncoder` 产出别的 realm 的 `Uint8Array`，esbuild 拒收。
- [x] 4.2 可移植模式宿主选项（`portableScripts`）
      - 不切换类型声明、不关 DOM lib：Monaco 的 JS 语言服务配置被所有打开的 JS 编辑器共享。改用 Profile
        的源码诊断，只标自由引用（对象键、属性访问、字符串、注释、本地声明都不算）。
- [x] 4.3 用例：可移植模式下 `document` 被标错；默认模式不变（Profile 级 Vitest）

## 5. 验收

- [x] 5.1 `qml-grab` 支持延迟截图参数，用于脚本驱动的夹具（底座阶段已有 `--delay-ms`；带 setup 的夹具取 800ms）
- [x] 5.2 夹具：计数脚本、缺失导出、setup 抛错、fetch 本地 JSON
      - 参考图 = 写进 `expected.json` 的文档（预览不跑脚本），Qt 跑真脚本；本机四份差异 0.028%–0.144%。
        判别性：计数夹具的静态值是白色 `0` 加红条，Qt 截图是绿色 `count 3` 加绿条。
- [x] 5.3 CI Qt job 跑脚本夹具
      - run 37088448728：Linux 上四份脚本夹具 0.002%–0.120%，13/13 通过。

## 6. 文档与验证

- [x] 6.1 `AGENTS.md`：Qt 侧脚本「同一份源码、同一份响应式实现」的约束
- [x] 6.2 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
      - 全部通过；`test:e2e` 397 passed。Red：示例首页带 setup，导出改交 zip 后旧的两条 e2e 把 zip 当文本读 →
        用例按文件名分支，并新增「导出带脚本的场景」（真实浏览器里加载 esbuild.wasm、降级、打包）。
      - 本机 Qt 流水线 13/13 通过。
- [x] 6.3 `npx openspec validate add-qml-page-script --strict`
