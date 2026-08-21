## MODIFIED Requirements

### Requirement: 无 React 的 Stage Engine 包

Stage Engine MUST 只依赖 `@compose-ui/core` 与 `@compose-ui/interaction-kernel`，并 MUST 接受
core 定义的 Layout Snapshot 协议而不得依赖 layout-engine 或 Yoga。

`@compose-ui/interaction-kernel` 是零运行时依赖的交互内核包，因此这条依赖 MUST NOT 引入
React、DOM 或第二套文档协议。

#### Scenario: 独立消费已解析布局
- **WHEN** 非 DOM 消费者提供 v6 document 与合法 Snapshot
- **THEN** 可以计算世界几何、吸附与空间命令
- **AND** 构建产物不包含 Yoga、WASM、React 或 DOM 类型

#### Scenario: 依赖清单只有两项
- **WHEN** 检查本包的 `package.json`
- **THEN** `dependencies` 只有 `@compose-ui/core` 与 `@compose-ui/interaction-kernel`
- **AND** 没有 `peerDependencies`

### Requirement: Stage 交互插件仲裁

Stage Engine MUST 从 `@compose-ui/interaction-kernel` 消费插件契约、注册表与会话仲裁器，
MUST NOT 自行实现第二套仲裁逻辑。Stage 侧 MUST 只保留 `StageKernelProfile` 这一处绑定与
建立在它之上的既有名称别名。

Stage 的公共入口 MUST 继续导出既有名称，使插件与消费方不因抽包而改动。

插件按声明的 `priority` 注册，Session Arbiter 在指针按下时按优先级逐个询问插件，同一时刻
MUST 至多存在一个活动会话。

`claim` 的结果 MUST 是三态：返回会话表示接管并独占后续事件；返回 `consumed` 表示本次按下
已被处理但不产生会话，Arbiter MUST 停止询问其余插件；返回 `null` 表示不接管，Arbiter
MUST 继续询问下一个插件。

Arbiter MUST 在调用 `commit` 前，先以 pointerup 的点与修饰键调用一次会话的 `update`；
因此 `commit` MUST NOT 依赖外部传入的终点。会话 MUST NOT 在 `update` 中写文档，`commit`
MUST 至多规划一个命令或 batch，`cancel` MUST 丢弃全部预览。

插件 MUST NOT 自行组装或发布 snapshot，MUST 经内核统一的发布路径，使派生字段不缺失。
内核 MUST 向插件提供当前快照的只读访问与保留 `temporaryPan` 的空闲快照工厂，使插件不必
各自复制「哪些内核状态跨会话存活」这条规则。

Arbiter MUST 暴露活动会话由哪个插件创建。内核在处理非指针事件时 MUST 依据该插件身份判定，
MUST NOT 依据会话自报的手势类型——手势分类属于插件，不得回流到内核。

#### Scenario: 内核来自独立包

- **WHEN** 检查 Stage Engine 的交互内核目录
- **THEN** 插件契约、注册表与仲裁器由 `@compose-ui/interaction-kernel` 提供
- **AND** Stage 侧只有 profile 绑定与别名，没有第二份仲裁实现

#### Scenario: 抽包不改变公共名称

- **WHEN** 消费方从 `@compose-ui/stage-engine` 导入既有的插件与仲裁名称
- **THEN** 全部仍然可用且语义不变
- **AND** 插件源码不需要修改

#### Scenario: 按优先级接管

- **WHEN** 一次指针按下同时满足两个插件的接管条件
- **THEN** 优先级更高的插件创建会话并独占后续事件
- **AND** 优先级更低的插件不被询问

#### Scenario: consumed 阻止后续判定

- **WHEN** 某个插件对一次按下返回 `consumed`
- **THEN** Arbiter 停止询问其余插件
- **AND** 不创建会话，后续指针移动不产生任何预览或效果

#### Scenario: 提交前吃掉最终点

- **WHEN** 用户拖动后在一个新位置松手
- **THEN** 会话先收到以该位置为参数的 `update`，再收到 `commit`
- **AND** 提交的几何与该最终位置一致

#### Scenario: 单体插件保持既有行为

- **WHEN** 内核只注册包装既有实现的单个插件
- **THEN** marquee、move、resize、segment-resize、rotate、guide、paint、path、draw
  与外部拖入的行为与重构前逐项一致
- **AND** snapshot、effect 与 surface port 协议不变

#### Scenario: 插件读取内核快照

- **WHEN** 插件在 claim 中读取当前快照以判定是否接管
- **THEN** 读到的是判定当刻的值而非注册时的快照
- **AND** 插件据此发布的快照以内核提供的空闲快照为基线，`temporaryPan` 不被抹掉

#### Scenario: 依据活动插件身份处理非指针事件

- **WHEN** 内核在非指针事件上需要区分当前会话的种类
- **THEN** 依据 Arbiter 暴露的活动插件 id 判定
- **AND** 无活动会话时该 id 为空
