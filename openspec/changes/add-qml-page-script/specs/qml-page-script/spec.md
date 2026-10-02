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
MUST NOT 另行实现。随 QML 运行时发布的副本 MUST 有校验确保与构建产物一致。

#### Scenario: 运行时副本被手改

- **WHEN** `native/qt/runtime/` 中的运行时副本与 `script-runtime` 构建产物不一致
- **THEN** 校验任务失败并指出需要重新复制

#### Scenario: effect cleanup 次序

- **WHEN** 一个 effect 的依赖在 Qt 中变化
- **THEN** 上一次返回的 cleanup 先于新一次执行被调用，与浏览器端行为一致

### Requirement: 导出值桥接为 QML 属性

导出器 MUST 从文档的 `Bindings` 收集全部被引用的导出名，为每一个在 `page` 对象上生成一条属性，
初值为对应 Renderer prop 在文档中的静态值；被绑定的 Renderer prop MUST 生成对 `page` 属性的 QML
绑定。运行时 MUST 只把被生成过属性的导出写回。

#### Scenario: 绑定生成

- **WHEN** 文字的 `text` 绑定到导出 `temperature`，图形的填充色绑定到导出 `alarmColor`
- **THEN** QML 中 `page` 上有 `temperature` 与 `alarmColor` 两条属性
- **AND** 两个对象分别以 `page.temperature`、`page.alarmColor` 绑定

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

带 setup 的场景导出 MUST 产出场景 QML 与 setup 模块两个文件；`qml-export` MUST 以文件列表返回产物，
编辑器 MUST 将其打包为单个 zip 交付。

#### Scenario: 导出带脚本的场景

- **WHEN** 用户导出一个设置了 setup 的激活场景
- **THEN** 下载的 zip 中包含场景 `.qml` 与 setup 模块，场景 QML 引用该模块

### Requirement: 编辑器可移植模式

编辑器 MUST 提供默认关闭的宿主选项；开启后脚本编辑器 MUST 使用可移植 API 类型声明并不加载 DOM 类型，
使不可移植的全局在编辑时被标为错误。

#### Scenario: 开启可移植模式

- **WHEN** 宿主开启可移植模式，作者在 setup 中输入 `document.title`
- **THEN** 脚本编辑器把 `document` 标为未定义

#### Scenario: 默认模式

- **WHEN** 宿主未开启可移植模式
- **THEN** 脚本编辑器的类型提示与现状一致
