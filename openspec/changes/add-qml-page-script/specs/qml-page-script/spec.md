## ADDED Requirements

### Requirement: 同一份 setup 在 Qt 中执行

导出 MUST 把页面 setup 模块原样（或仅经导出期语法降级）放入产物，Qt 侧 MUST 以 ES 模块方式加载并
调用其 `setup` 导出。作者 MUST NOT 需要为 Qt 另写一份脚本。

#### Scenario: 计数脚本驱动文字

- **WHEN** 页面 setup 用 `ctx.state(0)` 与 `setInterval` 每秒加一并导出为 `count`，某文字的 `text`
  绑定到 `count`
- **THEN** 在 Qt 中运行导出产物两秒后，该文字显示的数值不小于 2

#### Scenario: 页面没有 setup

- **WHEN** 页面没有设置 setup 脚本
- **THEN** 导出产物不含 `page` 对象与 setup 模块，与静态导出相同

### Requirement: 响应式语义的单一实现

Qt 侧的 `ctx.state`、`computed`、`effect` MUST 由 `@compose-ui/script-runtime` 的可移植构建产物提供，
MUST NOT 另行实现。导出产物里的运行时 MUST 直接取自该构建产物，MUST NOT 在仓库里另存一份副本。

#### Scenario: 运行时取自构建产物

- **WHEN** 导出一个带 setup 的场景
- **THEN** 产物里的 `ComposeRuntime/script-runtime.mjs` 与 `script-runtime` 的可移植构建产物逐字节相同

#### Scenario: effect cleanup 次序

- **WHEN** 一个 effect 的依赖在 Qt 中变化
- **THEN** 上一次返回的 cleanup 先于新一次执行被调用，与浏览器端行为一致

### Requirement: 导出值桥接为 QML 属性

导出器 MUST 从文档的 `Bindings` 收集被引用的导出名，为每一个在 `page` 对象上生成一条初值为
`undefined` 的属性；被绑定且可动态化的 Renderer prop（文字的 `text` 与 `color`、曲线的 `stroke`）
MUST 生成对 `page` 属性的 QML 绑定，并 MUST 在该属性为 `undefined` 时回退到**本对象**在文档中的
静态值。运行时 MUST 只把被生成过属性的导出写回。不能动态化的绑定（改变几何或文字度量的 prop）
与组件实例内部的绑定 MUST 按静态值导出并给出诊断。

#### Scenario: 绑定生成

- **WHEN** 文字的 `text` 绑定到导出 `temperature`，曲线的描边 `stroke` 绑定到导出 `alarmColor`
- **THEN** QML 中 `page` 上有对应 `temperature` 与 `alarmColor` 的两条属性
- **AND** 两个对象分别绑定到这两条属性，并各自带着自己的静态值作为回退

#### Scenario: 同一个导出被两个对象绑定

- **WHEN** 两个文字绑定同一个导出，而它们在文档里的静态值不同
- **THEN** 脚本给出值之前，两个文字各自显示自己的静态值

#### Scenario: 脚本尚未完成

- **WHEN** setup 仍在加载或执行中
- **THEN** 被绑定的对象显示文档中的静态值

### Requirement: 运行期失败保留静态画面

setup 抛错、导出缺失或导出类型与目标不符时，受影响的属性 MUST 保持静态值，并 MUST 按页面脚本运行时
既有的诊断码报告；其余对象与其余绑定 MUST 照常工作。

#### Scenario: 导出缺失

- **WHEN** 文字绑定到导出 `voltage`，而 setup 没有返回 `voltage`
- **THEN** 该文字保持静态值并报告 `script.binding-missing-export`
- **AND** 其他绑定照常更新

#### Scenario: 使用了不可移植的全局

- **WHEN** setup 中访问 `document.title`
- **THEN** 报告 `script.setup-threw` 诊断，全部被绑定对象保持静态值，场景照常显示

### Requirement: 可移植全局对象

Qt 运行时 MUST 在 setup 执行前提供 `setTimeout`、`setInterval`、`clearTimeout`、`clearInterval`、
`fetch`（基于 `XMLHttpRequest` 的子集）、`WebSocket` 与 `console`；页面销毁时 MUST 停止全部定时器并
关闭由页面打开的 WebSocket。

#### Scenario: fetch 取 JSON

- **WHEN** setup 中 `await fetch(url)` 后调用 `response.json()`
- **THEN** 得到与浏览器端相同结构的对象

#### Scenario: fetch 的相对路径

- **WHEN** setup 中 `fetch('data.json')`
- **THEN** 路径相对场景文件所在目录解析，与浏览器端相对页面地址解析对应

#### Scenario: WebSocket 连接失败

- **WHEN** setup 创建的 `WebSocket` 连接被拒绝
- **THEN** 依次触发一次 `onerror` 与一次 `onclose`（`code` 1006），与浏览器一致

#### Scenario: 页面销毁

- **WHEN** 承载页面的 QML 对象被销毁
- **THEN** 该页面创建的所有定时器停止触发，WebSocket 被关闭，effect cleanup 被调用

### Requirement: Qt 侧导航不可用

在 Qt 侧尚无多页面宿主时，`ctx.navigate` 与 `ctx.navigateBack` MUST 只产生
`script.navigation-unavailable` 诊断，MUST NOT 抛出。

#### Scenario: 脚本调用导航

- **WHEN** setup 返回的方法中调用 `ctx.navigate('pages/detail.page.json')`
- **THEN** 产生 `script.navigation-unavailable` 诊断，当前场景不变

### Requirement: 多文件导出产物

带 setup 的场景导出 MUST 产出自包含的目录：场景 QML、setup 模块与 `ComposeRuntime/` 运行时目录，
使 Qt 不需要额外配置 import path 即可运行；`qml-export` MUST 以文件列表返回产物，编辑器 MUST 将其
打包为单个 zip 交付。没有 setup 的场景 MUST 仍交付单个 `.qml` 文件。

#### Scenario: 导出带脚本的场景

- **WHEN** 用户导出一个设置了 setup 的激活场景
- **THEN** 下载的 zip 中包含场景 `.qml`、setup 模块与 `ComposeRuntime/`，场景 QML 引用两者

### Requirement: 导出期降级编译

带 setup 的导出 MUST 把 setup 降级到 Qt 的 JavaScript 引擎能解析的语法，并 MUST 把脚本中对可移植
全局（定时器、`fetch`、`WebSocket` 等）的引用改写为对运行时全局模块的导入；作者源码 MUST NOT
需要为此修改。降级编译器由宿主注入；宿主未注入时 MUST 交付静态场景并说明脚本没有随导出；编译
失败时 MUST NOT 交付文件，并 MUST 给出编译器的说明。

#### Scenario: 使用 async 的 setup

- **WHEN** setup 中有 `async` 方法与对象展开
- **THEN** 产物中的 setup 模块不含这两种语法，在 Qt 中照常运行

#### Scenario: 宿主没有注入编译器

- **WHEN** 页面有 setup 而宿主没有提供编译器
- **THEN** 下载静态场景 `.qml`，提示说明页面脚本没有随导出

#### Scenario: setup 有语法错误

- **WHEN** setup 源码无法解析
- **THEN** 不下载任何文件，提示带编译器给出的错误位置

### Requirement: 编辑器可移植模式

编辑器 MUST 提供默认关闭的宿主选项；开启后脚本编辑器 MUST 把对不可移植浏览器全局的自由引用在编辑时
标为错误，清单 MUST 来自 `@compose-ui/script-runtime` 的公开定义。实现 MUST NOT 修改被所有脚本编辑器
共享的语言服务配置（例如全局关掉 DOM lib），以免影响同时打开的其他脚本。

#### Scenario: 开启可移植模式

- **WHEN** 宿主开启可移植模式，作者在 setup 中输入 `document.title`
- **THEN** 脚本编辑器把 `document` 标为未定义

#### Scenario: 不是自由引用

- **WHEN** 可移植模式下脚本里出现 `config.window`、`{ window: 1 }`、字符串或注释里的 `document`
- **THEN** 这些位置不被标错

#### Scenario: 默认模式

- **WHEN** 宿主未开启可移植模式
- **THEN** 脚本编辑器的类型提示与现状一致
