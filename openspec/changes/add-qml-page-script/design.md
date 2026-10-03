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

### 语法支持：需要降级编译（spike 结论）

Qt 6.8.3 的 V4 逐项实测（每项单独一个模块，避免一处语法错误挡住其余）：

| 支持 | 不支持（解析失败） | 不支持（运行期缺 API） |
| --- | --- | --- |
| ES 模块 `import`/`export`、箭头函数与默认参数、数组解构与展开、模板字符串、生成器、`Promise`、`Map`/`Set`/`WeakMap`/`WeakSet`、`Symbol`、`Proxy`/`Reflect`、`**`、可选链 `?.`、`??`、数字分隔符 | `async`/`await`、对象展开与对象剩余解构、类字段与私有字段、`catch` 省略绑定、`??=` 等逻辑赋值、`BigInt` | `queueMicrotask`、`setTimeout`、`structuredClone`、`globalThis`、`WeakRef`、`Array.prototype.flat`/`flatMap`、`Object.fromEntries`、`String.prototype.replaceAll` |

`@compose-ui/script-runtime` 自己就用了 `async`/`await`、对象展开、`flatMap` 与 `queueMicrotask`，
作者的 setup 写 `async` 方法拉数据更是常态，因此**降级编译是必需的**，不是兜底。

验证过的链路：用 `esbuild --target=es2016` 把 `scope` + `reactivity` 打成一个 ES 模块（`async` 被降成
生成器，V4 支持生成器），前置两行补齐（`queueMicrotask` 用 `Promise.resolve().then`——V4 的 `then`
是微任务语义；`Array.prototype.flatMap`），同样降级的 setup 里写 `async tick()`、`computed`、`effect`；
QML `Timer` 每 50ms 调一次 `tick`，导出订阅把值写进 `property`，`Text` 跟着刷新——初值
`0 / count 0 / effect saw 0`，三次之后 `3 / count 3 / effect saw 3`，诊断为空。

决策：

- **源码仍只有一份**，降级只发生在构建与导出两处，作者不为 Qt 改写任何东西。
- **运行时**在 `script-runtime` 的包构建期产出可移植模块（目标 ES2016 + 上述前置补齐），不需要新
  依赖——构建工具链里已有能降级的编译器。
- **作者的 setup** 在导出那一刻于浏览器内降级，需要一个能在浏览器里跑的编译器，这是本变更唯一的
  新运行期依赖，**待评审**：候选是 `esbuild-wasm`（与构建期同一个编译器、降级语义一致；wasm 约
  10 MB，只在点「导出」时动态加载，不进编辑器首屏）。
- 不能降级的（`BigInt`）在可移植模式下标错；缺的运行期 API 由「全局对象补齐」与前置补齐覆盖，
  `structuredClone` / `WeakRef` 不补，写进可移植 API 声明的「不可用」清单。

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

- 作者 setup 的浏览器内降级编译器选型（候选 `esbuild-wasm`），待评审。
- 动画 `playing` / `currentTime` 绑定在 Qt 侧的实现，留给动画导出变更。
