## MODIFIED Requirements

### Requirement: 会话自检上下文兼容性

交互会话 MUST 能在受控上下文变化后自行判断是否仍然成立，内核 MUST NOT 通过枚举手势种类
做这件事。判定为不成立时内核 MUST 取消该会话。未声明判定的会话 MUST 视为始终成立。

判据 MUST 按会话是否持有**冻结几何**划分，而不是按它是否提到某个 Entity：

- 持有冻结几何的会话（旋转中心、外接盒、基准角度、起始局部坐标等在接管当刻算好、之后不再
  重算的量）MUST 在 `document` 引用、`layoutSnapshot.revision` 或 `tool` 任一变化时判定为
  不成立。这类会话的错误不在交互期显形——预览照常跟随指针，只有落库的数值是错的。
- 每帧从当前上下文重新求值的会话（图层取色）与不引用任何 Entity 的会话（平移只改视口、
  绘制只由世界坐标定义）MUST NOT 因并发文档变化中止。

会话的 `cancel` MUST 接收插件上下文：会话在接管与推进过程中发布过快照、捕获过指针，
取消时 MUST 由它自己还原，内核不知道某个会话发布过什么。

#### Scenario: 空间手势被并发变化中止

- **WHEN** 旋转进行中，选区被别处的编辑改成另一批目标
- **THEN** 旋转会话被取消，快照回到空闲且指针捕获被释放
- **AND** 不产生任何命令

#### Scenario: 并发文档变化中止冻结几何会话

- **WHEN** 旋转进行中，别处的编辑替换了 `document`，而选区与顶层目标都没有变化
- **THEN** 旋转会话被取消，松手不产生任何命令

#### Scenario: 并发布局重排中止冻结几何会话

- **WHEN** 旋转进行中，`document` 不变但 `layoutSnapshot.revision` 前进
- **THEN** 旋转会话被取消

#### Scenario: 工具切换中止空间手势

- **WHEN** 旋转进行中工具切换为 select
- **THEN** 旋转会话被取消

#### Scenario: 逐帧求值的会话不被并发文档变化中止

- **WHEN** 图层取色进行中文档因别处编辑而变化，采样目标未变
- **THEN** 取色会话保持进行，并按新文档采样

#### Scenario: 无 Entity 引用的会话不受影响

- **WHEN** 会话未声明兼容性判定且上下文发生变化
- **THEN** 会话保持进行

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

绞杀式抽取期间，已从单体中抽出的插件 MUST 只有一处登记，供 controller 组装注册表与抽取顺序
不变量校验共用。每个已登记插件 MUST 在优先级表中存在同名条目且优先级一致。

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

#### Scenario: 已抽取集合从唯一登记处推导

- **WHEN** 新插件被加入登记处
- **THEN** controller 注册它，抽取顺序不变量同时对它生效
- **AND** 登记处中出现优先级表里没有的 id 时校验失败

#### Scenario: 单体插件保持既有行为

- **WHEN** 内核只注册包装既有实现的单个插件
- **THEN** pan、marquee、move、resize、segment-resize、rotate、guide、paint、path、draw
  与外部拖入的行为与重构前逐项一致
- **AND** snapshot、effect 与 surface port 协议不变
