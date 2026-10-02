## 上下文

- 页面 setup 是受信任、自包含的 JavaScript ESM，导出名为 `setup` 的函数
  （`packages/script-runtime/src/module-loader.ts`）。浏览器端以 Blob URL + `import()` 加载。
- `reactivity.ts` 无任何运行时导入，`scope.ts` 对 `core` 只有类型导入——两者天然可以脱离浏览器运行。
- 文档的 `Bindings.rendererProps.fields` 把顶层 Renderer prop 映射到 `{ scope: 'page', exportName }`；
  动画清单的 `bindings` 另有 `playing` / `currentTime`（本变更不处理动画）。
- Qt 6.8 的 QML 引擎支持在 QML 中 `import "x.mjs" as X` 加载 ES 模块。

## 目标 / 非目标

- 目标：同一份 setup 在 Qt 中执行；被绑定的 Renderer prop 随脚本导出实时更新；脚本能用定时器、
  HTTP 与 WebSocket 取数据。
- 非目标：动画播放绑定、Qt 侧多页面导航、`Interaction` 点击事件、安全沙箱、C++ 播放器 App。

## 决策

### 运行时结构

```
产物目录/
├── Scene.qml            导出器生成：图形 + page 对象 + 绑定
└── page.setup.mjs       页面 setup 源码，原样拷贝

native/qt/runtime/ComposeRuntime/   （QML 模块，部署时放在 import path 上）
├── qmldir
├── ComposePage.qml      加载 setup、建作用域、订阅并写回 page 属性
├── globals.mjs          setTimeout / setInterval / fetch / WebSocket 补齐
└── script-runtime.mjs   由 @compose-ui/script-runtime 构建产出，不手改
```

- `script-runtime.mjs` 由 JS 构建产出后**复制**进 `native/qt/runtime/`，不在 Qt 侧维护源码。
  仓库里用一个校验任务比较两者哈希，防止有人直接改了复制品。

### `page` 对象：静态生成而不是动态映射

导出器从 `Bindings` 静态收集全部被引用的导出名，生成：

```qml
ComposePage {
  id: page
  source: "page.setup.mjs"
  property var temperature: 23.5     // 初值 = 文档中该 prop 的静态值
  property var alarmColor: "#ff3b30"
}
Text { text: page.temperature }
```

- 不用 `QQmlPropertyMap`：那需要 C++，第一期要保持「`qml` 工具直接能跑」。导出名在导出时就是
  已知的，静态生成还让产物可读、可 diff。
- 属性初值写文档里的静态值：脚本还没跑完、或跑失败时，画面与静态导出一致，而不是一片空白。
- `ComposePage` 订阅作用域快照，只把**被生成过属性**的导出写回；脚本多导出的成员被忽略。
- 导出缺失或类型不符时**不写回**，属性停在静态值，并发对应诊断（`binding-missing-export` /
  `binding-type-mismatch`）。
- 方法导出通过 `page.call(name, ...args)` 调用，供将来的交互使用；本变更不生成任何调用点。

### 全局对象补齐

| 全局                                    | 实现                                  | 说明                                                                   |
| --------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| `setTimeout` / `setInterval` / `clear*` | 由 `ComposePage` 动态创建 QML `Timer` | 页面销毁时全部停止，与 effect cleanup 一致                             |
| `fetch`                                 | 基于 QML `XMLHttpRequest`             | 只覆盖 `method`/`headers`/`body` 与 `Response.text()/json()`；不支持流 |
| `WebSocket`                             | 包装 `QtWebSockets` 的 `WebSocket`    | 对齐 `onopen`/`onmessage`/`onclose`/`send`/`close`                     |
| `console`                               | 引擎自带                              | —                                                                      |

- 补齐的全局在 setup 执行**之前**注入；同一份清单同时生成编辑器可移植模式用的类型声明，二者
  读同一份定义，避免「编辑器说能用、Qt 上没有」。
- `qtwebsockets` 加入 `native/qt/qt-version.json` 的模块清单。

### 语法支持：先 spike 再定

V4 引擎对 ES2017 之后语法（尤其 `async` / `await`、可选链、`??`）的支持程度需要实测。第一项任务
是在 Qt 6.8 中跑通：import 可移植运行时、`async` 函数、`Promise`、`Timer` 驱动 state 刷新 QML
文本整条链路。

- 若全部支持：导出时原样拷贝 setup。
- 若有缺口：导出时在编辑器内用 `esbuild-wasm` 把 setup 降级编译到引擎支持的目标；**源码仍只有
  一份**，编译只发生在导出这一步。这会引入一个新依赖，届时在本文件中补充决策并重新评审。

### 编辑器可移植模式

- 宿主选项开启后，脚本编辑器的类型声明换成「可移植 API」版本，并关闭 DOM lib，于是 `document`
  等标识符在编辑时即报未定义。默认关闭：多数宿主只在浏览器运行，不该被收窄。

### 导出产物打包

- 产物变为多文件，编辑器打包成 zip 下载。zip 用 `fflate`（体积小、无依赖）；`qml-export` 本身仍只
  返回 `{ path, content }[]`，不认识 zip。

## 考虑过的替代方案

- **把脚本翻译成 QML 原生代码**：一般情况下不可能，且会产生第二份事实来源。
- **在 Qt 侧重写响应式原语**：语义漂移风险，见上。
- **C++ 宿主 + `QQmlPropertyMap`**：动态键更灵活，但第一期不需要 C++，留给播放器阶段。

## 风险 / 权衡

- 脚本作者使用了未补齐的浏览器 API → 运行期 `ReferenceError` 被归一为 `script.setup-threw` /
  `script.effect-threw` 诊断，页面保留静态值；可移植模式在编辑期提前暴露。
- `fetch` 子集与浏览器行为差异（CORS 在 Qt 中不存在、流不支持）→ 在可移植 API 声明的 TSDoc 中写明。
- 脚本是受信任代码，Qt 侧同样不是沙箱。

## 待解决问题

- V4 语法支持 spike 的结论（决定是否引入导出期降级编译）。
- 动画 `playing` / `currentTime` 绑定在 Qt 侧的实现，留给动画导出变更。
