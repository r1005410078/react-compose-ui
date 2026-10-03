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

### 运行时结构：随产物一起走

```
<场景>.zip
├── Scene.qml                     导出器生成：图形 + page 对象 + 绑定
├── page.setup.mjs                作者的 setup，导出期降级、全局改写为 import
└── ComposeRuntime/               QML 模块（目录 import，含 qmldir）
    ├── qmldir
    ├── ComposePage.qml           加载 setup、建作用域、校验类型并写回 page 属性
    ├── globals.mjs               定时器、queueMicrotask、fetch 子集、WebSocket
    └── script-runtime.mjs        @compose-ui/script-runtime 的可移植构建产物
```

- **运行时随产物一起交付**，不部署到 Qt 的 import path。原设计是在 `native/qt/runtime/` 维护一份
  副本、用哈希校验防止手改；改成随产物走之后，副本与那项校验都不存在了——`ComposePage.qml`、
  `globals.mjs`、`qmldir` 是 `qml-export` 包里的真实文件（以 `?raw` 读入），`script-runtime.mjs`
  直接取自 `script-runtime` 构建期产出、从包根导出的常量 `COMPOSE_PORTABLE_RUNTIME_SOURCE`（跨包只许从
  包根导入，单开文件子路径会绕开那条边界）。产物自包含，
  `qml Scene.qml` 即可运行；代价是每份产物多约 20 KB。
- `qml-export` 只依赖 `core`：它不编译、不打包，调用方交来**已经可在 V4 中运行**的 setup 与运行时
  两段文本，它把它们放进文件列表。
- 全局名的清单只有一份（`COMPOSE_PORTABLE_GLOBALS`），`globals.mjs` 实际导出的名字由
  `qml-export` 从源码读出（`COMPOSE_QML_RUNTIME_GLOBALS`），编辑器的用例断言两者相同——不一致的
  症状是编译器往脚本里注入了运行时没有的 import，Qt 上整个 setup 模块加载失败。

### `page` 对象：静态生成，每个绑定自带回退

导出器从 `Bindings` 静态收集被引用的导出名，生成：

```qml
import "ComposeRuntime"
import "page.setup.mjs" as PageSetup

ComposePage {
    id: page
    setup: PageSetup.setup
    bindings: ({"temperature":{"property":"x_temperature","kinds":["text"]}})
    property var x_temperature: undefined
}
Text { text: page.x_temperature === undefined ? "23.5" : page.text(page.x_temperature) }
```

- 不用 `QQmlPropertyMap`：那需要 C++，第一期要保持「`qml` 工具直接能跑」。导出名在导出时就是
  已知的，静态生成还让产物可读、可 diff。
- 属性名一律加 `x_` 前缀：导出名是作者起的，可能撞上 `ComposePage` 自己的成员，也可能不是合法
  的 QML 属性名。原始导出名留在 `bindings` 里。
- **属性初值是 `undefined`，回退写在每个绑定表达式里**，而不是给属性一个初值：同一个导出名可能
  被两个对象绑定、而两者在文档里的静态值不同，属性初值只能取其一。写在表达式里之后，「脚本还没
  跑完 / 导出缺失 / 类型不符」三种情形下每个对象都显示它**自己**的静态值。
- 能动态化的只有不牵动几何的两类：文字（`text`）与颜色（文字的 `color`、曲线的 `stroke` 及箭头
  填充）。线宽、字号改变箭头、虚线或文字度量，它们的几何在导出时就算死了，仍按静态值导出并报
  `binding.static-value`。组件实例内部的绑定同样静态：嵌套文档没有脚本作用域（预览也不向内传）。
- `ComposePage` 订阅被绑定的每个导出，校验类型后写回；缺失与类型不符分别报
  `script.binding-missing-export` / `script.binding-type-mismatch`，属性回到 `undefined`。setup 本身
  失败时（抛错、没返回对象），各绑定的「导出缺失」只是它的后果，不再逐个报。
- 颜色在运行时换算成 Qt 的 `#aarrggbb`，与导出器写静态值的 `qmlColor` 同一条规则。
- 方法导出通过 `page.call(name, ...args)` 调用，供将来的交互使用；本变更不生成任何调用点。

### 全局对象补齐

| 全局                                    | 实现                                  | 说明                                                                   |
| --------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| `setTimeout` / `setInterval` / `clear*` | 由 `ComposePage` 动态创建 QML `Timer` | 页面销毁时全部停止，与 effect cleanup 一致                             |
| `fetch`                                 | 基于 QML `XMLHttpRequest`             | 只覆盖 `method`/`headers`/`body` 与 `Response.text()/json()`；不支持流 |
| `WebSocket`                             | 包装 `QtWebSockets` 的 `WebSocket`    | 对齐 `onopen`/`onmessage`/`onclose`/`send`/`close`                     |
| `console`                               | 引擎自带                              | —                                                                      |

- V4 的全局对象只读，这些名字**挂不上去**。因此降级编译时用 esbuild 的 `inject` 把脚本里对它们的
  自由引用改写成 `import { … } from "./ComposeRuntime/globals.mjs"`，作者源码不变；`globals.mjs` 的
  定时器与 WebSocket 都挂在当前 `ComposePage` 上，页面销毁时一并停掉。
- `fetch` 的相对路径相对**场景文件所在目录**解析，与浏览器里相对页面地址解析对应；不处理的话
  `XMLHttpRequest` 会相对调用方模块（`ComposeRuntime/`）解析。
- WebSocket 连接失败时 QtWebSockets 先报 Closed 再报 Error，而浏览器是 error 与 close(1006) 各一次；
  垫片把 Closed 推迟一拍，保证 close 只发一次。
- 同一份清单同时生成编辑器可移植模式用的类型声明，避免「编辑器说能用、Qt 上没有」。
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
- **作者的 setup** 在导出那一刻于浏览器内降级，用 `esbuild-wasm`（已评审通过）：与构建期同一个
  编译器、同一个版本（0.28.1，两处锁死），降级语义一致。wasm 约 10 MB，编辑器是库构建，打进来会
  被内联成 base64 进首屏，因此编译器由宿主注入（`qmlScriptCompiler`），宿主给出 wasm 的 URL，
  只在第一次导出时加载。宿主没注入时交付静态场景并说明脚本没有随导出。
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

- 动画 `playing` / `currentTime` 绑定在 Qt 侧的实现，留给动画导出变更。
