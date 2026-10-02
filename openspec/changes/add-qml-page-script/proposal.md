# 变更：页面脚本在 Qt 中运行，绑定导出为 QML 属性绑定

## 原因

`add-qml-export` 导出的 QML 是静态的。数据源协议尚未确定，**大屏的数据目前就是靠页面 setup 脚本
拿进来的**：脚本用 `ctx.state` / `computed` / `effect` 建响应式状态，文档的 `Bindings` 把 Renderer
prop 绑到脚本导出上。没有脚本，导出到 Qt 的大屏就是一张图。

现有模型与 QML 天然同构：文档里的「`text` 绑到导出 `temperature`」就是 QML 的
`text: page.temperature`，而 QML 自带的 JS 引擎（V4）能直接 import ES 模块。因此**同一份脚本可以
原样在 Qt 里跑**，不需要翻译，也不需要作者为 Qt 另写一份。

## 变更内容

- **脚本源码只有一份**：导出时把页面的 setup 模块原样拷贝进产物，QML 通过 ES 模块 import 加载。
- **响应式语义只有一份实现**：`@compose-ui/script-runtime` 新增一个可移植构建产物——把
  `reactivity` 与 `scope` 打成不引用任何浏览器全局的自包含 ES 模块，随 QML 运行时发布。
  MUST NOT 在 Qt 侧重写 state / computed / effect：effect 循环检测、cleanup 次序这些语义两份实现
  迟早对不上，而症状只在现场出现。
- **导出值桥接成普通 QML 属性**：导出器从文档的 `Bindings` 静态得知用到了哪些导出名，为每一个
  生成一条 `property var`，挂在一个 `page` 对象上；运行时订阅脚本作用域，把变化写进这些属性。
  被绑定的 Renderer prop 写成 `text: page.temperature`。**第一期不需要任何 C++**，`qml` 工具
  直接能跑。
- **可移植脚本 API**：响应式原语、`ctx.navigate` / `navigateBack`，加上一组补齐的全局对象
  （`setTimeout` / `setInterval` 及清除函数、基于 `XMLHttpRequest` 的 `fetch` 子集、`WebSocket`、
  `console`）。`window`、`document` 与任何 DOM API 不提供。
- 运行期失败**不让页面消失**：setup 抛错、导出缺失、类型不符时，被绑定的属性回退到文档中的静态
  值，并按现有诊断码报告——与浏览器端「还没配 / 配错了 / 配的东西没了」同一套判断。
- `ctx.navigate` 在 Qt 侧尚无多页面宿主，调用只产生 `script.navigation-unavailable` 诊断，与现有
  「未注入导航端口」的约定一致。
- 编辑器可选的**可移植模式**：宿主开启后，脚本编辑器按可移植 API 声明提示，把 `document`、
  `window` 等不可移植的全局标为错误——在写脚本时发现，而不是到 Qt 上跑起来才发现。默认关闭，
  只在浏览器里跑的宿主不受影响。
- 导出产物从单个 `.qml` 变为一个目录（打包为 zip 下载）：场景 QML、setup 模块，以及对运行时
  模块的引用。

## 影响

- 受影响的规范：新增 `qml-page-script`；`page-script-runtime` 新增可移植产物与可移植 API 声明
- 受影响的代码：
  - `packages/script-runtime/`：可移植 ES 模块构建产物、可移植全局声明
  - `packages/qml-export/`：`page` 对象生成、绑定生成、多文件产物
  - `native/qt/runtime/ComposeRuntime/`：QML 运行时模块（桥接、全局对象补齐）
  - `packages/editor/`：导出 zip、可选的可移植模式
- 依赖：`add-qt-runtime-foundation`、`add-qml-export` 先落地；本变更第一项任务是 V4 引擎能力 spike，
  其结论可能修改 design.md 中「是否需要导出时降级编译」那一条决策。
