## MODIFIED Requirements

### Requirement: Stage 交互插件仲裁

Stage Engine MUST 提供 headless 交互内核：插件按声明的 `priority` 注册，Session Arbiter
在指针按下时按优先级逐个询问插件，同一时刻 MUST 至多存在一个活动会话。

`claim` 的结果 MUST 是三态：返回会话表示接管并独占后续事件；返回 `consumed` 表示本次按下
已被处理但不产生会话，Arbiter MUST 停止询问其余插件；返回 `null` 表示不接管，Arbiter
MUST 继续询问下一个插件。

Arbiter MUST 在调用 `commit` 前，先以 pointerup 的点与修饰键调用一次会话的 `update`；
因此 `commit` MUST NOT 依赖外部传入的终点。会话 MUST NOT 在 `update` 中写文档，`commit`
MUST 至多规划一个命令或 batch，`cancel` MUST 丢弃全部预览。

插件 MUST NOT 自行组装或发布 snapshot，MUST 经内核统一的发布路径，使派生字段不缺失。

全部手势 MUST 住在插件里，内核 MUST NOT 保留任何按手势种类分类的判定或兜底实现。插件注册表
MUST 逐项覆盖优先级表——没有兜底实现时，漏掉一项就是一类命中彻底无人接管。优先级 MUST 两两
不同，使询问顺序完全确定。

指针生命周期之外中止会话（并发上下文变化、surface 断开、dispose）MUST 经由会话自己的 `cancel`
还原它发布过的快照与捕获过的指针——内核不知道某个会话发布过什么。

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

#### Scenario: 注册表覆盖整张优先级表

- **WHEN** 优先级表中存在没有对应插件的条目
- **THEN** 校验失败

#### Scenario: 已抽取集合从唯一登记处推导

- **WHEN** 新插件被加入登记处
- **THEN** controller 注册它，覆盖性校验同时对它生效
- **AND** 登记处中出现优先级表里没有的 id 时校验失败

#### Scenario: 指针生命周期之外中止

- **WHEN** surface 断开或 controller dispose 时仍有活动会话
- **THEN** 该会话的 `cancel` 被调用，快照回到空闲且指针捕获被释放
