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
内核 MUST 向插件提供当前快照的只读访问与保留 `temporaryPan` 的空闲快照工厂，使插件不必
各自复制「哪些内核状态跨会话存活」这条规则。

Arbiter MUST 暴露活动会话由哪个插件创建。内核在处理非指针事件时 MUST 依据该插件身份判定，
MUST NOT 依据会话自报的手势类型——手势分类属于插件，不得回流到内核。

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

## ADDED Requirements

### Requirement: 平移手势插件

平移 MUST 由独立的交互插件实现，并按 `STAGE_GESTURE_PRIORITY` 声明的优先级排在单体插件之前。
该插件 MUST NOT 读取文档或场景索引——平移只改变视口，不引用任何 Entity。

插件 MUST 在 `tool` 为 pan、处于临时平移状态、或按下的是中键时接管。会话 MUST 在每次指针
移动上发出视口变更，其位移 MUST 以按下时的视口与按下点为基线。会话结束 MUST NOT 产生任何
文档命令。

单体插件 MUST NOT 再保留平移分支：两处判定并存时，行为将依赖优先级顺序而非显式实现，
优先级写错会静默回退且没有可见失败。

#### Scenario: 三种入口都接管平移

- **WHEN** 用户在 pan 工具下按下、在按住临时平移键时按下、或按下中键
- **THEN** 平移插件接管本次按下并捕获指针
- **AND** 后续移动按「按下时视口 + 指针位移」改变视口

#### Scenario: 平移不产生文档命令

- **WHEN** 用户完成一次平移并松手
- **THEN** 不产生任何命令或 batch
- **AND** 快照回到空闲且指针捕获被释放

#### Scenario: 临时平移结束时取消会话

- **WHEN** 用户在平移进行中松开临时平移键
- **THEN** 平移会话被取消
- **AND** 临时平移标志随之清除
