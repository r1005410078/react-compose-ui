## ADDED Requirements

### Requirement: 无框架的交互内核包

系统 MUST 提供 `@compose-ui/interaction-kernel`：**零运行时依赖**的交互内核包，内容为插件
契约、插件注册表与会话仲裁器。

本包 MUST NOT 依赖 React、ReactDOM 或任何 `@compose-ui/*` 包，MUST NOT 引用 DOM 类型
（`HTMLElement`、`PointerEvent`、`KeyboardEvent` 等），也 MUST NOT 引用任何具体文档协议的
类型。内核逻辑本身不认识文档，只有类型签名通过 profile 认识。

这条边界 MUST 由包依赖而不是命名约定承载：内核住在一个没有依赖的包里，引用文档类型必须
先加依赖，因此越界在安装清单上就是可见的。

#### Scenario: 依赖清单为空

- **WHEN** 检查本包的 `package.json`
- **THEN** 没有 `dependencies`，也没有 `peerDependencies`
- **AND** 源码中不出现 React、DOM 或 `@compose-ui/*` 的 import

#### Scenario: 内核不认识文档协议

- **WHEN** 检查内核源码
- **THEN** 不出现任何具体文档类型的名称
- **AND** 文档相关的类型只以 profile 的成员形式出现在类型签名上

### Requirement: 内核类型 Profile

内核用到的六个类型 MUST 打成**单个类型级记录** `InteractionKernelProfile`，而不是六个类型
参数：受控上下文、空间索引、归一化事件、询问 claim 的事件变体、效果与快照。

`claimEvent` MUST 由 profile 声明而不是由内核从事件联合中推导：内核若写死「claim 由指针
按下发起」，就排除了由键盘启动命令的文档类型。

`event` MUST 只约束为 `object`。写成只含可选属性的形状会构成 weak type，使不携带该属性的
事件变体因「没有共同属性」而无法赋值。

#### Scenario: 新文档类型绑定自己的 profile

- **WHEN** 一个新文档类型声明自己的 profile 并注册插件
- **THEN** 复用同一套注册表与仲裁规则，不必修改内核
- **AND** 内核源码中不出现该文档类型的任何名称

#### Scenario: 命令驱动的 claim 事件

- **WHEN** 某个 profile 把 `claimEvent` 声明为非指针事件
- **THEN** 类型检查通过
- **AND** 仲裁器按同样的规则询问插件

### Requirement: 插件注册与会话仲裁

内核 MUST 提供按 `priority` 降序排列的插件注册表，重复的插件 id MUST 被拒绝，且拒绝信息
MUST NOT 提及任何具体文档类型。

Session Arbiter MUST 在 claim 事件上按优先级逐个询问插件，同一时刻 MUST 至多存在一个活动
会话；已有活动会话时 MUST 直接拒绝新的接管。

`claim` 的结果 MUST 是三态：返回会话表示接管并独占后续事件；返回 `'consumed'` 表示本次
事件已被处理但不产生会话，仲裁器 MUST 停止询问其余插件；返回 `null` 表示不接管，仲裁器
MUST 继续询问下一个插件。

仲裁器 MUST 在调用 `commit` 前，先以结束事件调用一次会话的 `update`，因此 `commit`
MUST NOT 依赖外部传入的终点。会话 MUST NOT 在 `update` 中写文档。

仲裁器 MUST 在回调 `commit` 之前先清空自己的活动会话引用，使提交过程中的重入看到的是
「无会话」而不会把同一个会话提交两次。

#### Scenario: 按优先级接管

- **WHEN** 一次 claim 事件同时满足两个插件的接管条件
- **THEN** 优先级更高的插件创建会话并独占后续事件
- **AND** 优先级更低的插件不被询问

#### Scenario: consumed 阻止后续判定

- **WHEN** 某个插件返回 `'consumed'`
- **THEN** 仲裁器停止询问其余插件
- **AND** 不创建会话

#### Scenario: 提交前吃掉最终点

- **WHEN** 会话在一个新位置结束
- **THEN** 会话先收到以该位置为参数的 `update`，再收到 `commit`
- **AND** 提交用的状态与该最终位置一致

#### Scenario: 提交过程中的重入不会重复提交

- **WHEN** 会话的 `commit` 同步触发了又一次 `commit`
- **THEN** 第二次调用看到的是无活动会话，直接返回
- **AND** 会话只被提交一次

### Requirement: 会话自检与释放

会话 MUST 能在受控上下文变化后自行判断是否仍然成立，内核 MUST NOT 通过枚举手势种类做这件
事。判定为不成立时仲裁器 MUST 取消该会话。未声明判定的会话 MUST 视为始终成立。

仲裁器 MUST 提供**丢弃引用但不调用 `cancel`** 的释放路径，用于会话已通过其他途径自行拆除
的情况（宿主断开、controller dispose）；该路径 MUST 幂等。

`cancel` MUST 接收插件上下文：会话在接管与推进过程中发布过快照、占用过资源，取消时由它
自己还原，内核不知道某个会话发布过什么。

#### Scenario: 不兼容的会话被取消

- **WHEN** 上下文变化后会话的自检返回 false
- **THEN** 仲裁器取消该会话并报告发生了取消
- **AND** 随后可以接管新的 claim

#### Scenario: 未声明自检的会话不受影响

- **WHEN** 会话未声明兼容性判定且上下文发生变化
- **THEN** 会话保持进行

#### Scenario: 释放不触发 cancel

- **WHEN** 宿主调用释放路径
- **THEN** 活动会话的 `cancel` 不被调用
- **AND** 仲裁器回到无会话状态，重复调用无副作用
