## ADDED Requirements

### Requirement: 独立 Animation Asset v1

系统 MUST 以 `.animation.json` 和 `application/vnd.compose-ui.animation+json` 提供单时间线 Animation
Asset v1。资源 MUST 保存正整数毫秒 duration、稳定目标槽位、唯一属性轨道和按时间排序的关键帧，
并 MUST 由无 React/DOM 的 parser/serializer 严格校验。资源 MUST NOT 保存页面专属 Entity ID、运行时
播放状态或 setup 当前值。

#### Scenario: 往返合法动画资源

- **WHEN** 一份资源包含 self、命名槽位、颜色与位置轨道以及 Linear、Bezier、Spring、Hold 关键帧
- **THEN** parse 和 serialize 往返保留全部稳定 ID、时间、值和 easing
- **AND** 输出不包含消费页面的 Entity ID 或运行时状态

#### Scenario: 拒绝非法动画资源

- **WHEN** duration 非正整数、关键帧越界或重复、轨道目标不存在、同一属性轨道重复或 easing 参数非法
- **THEN** parser 返回带精确路径的稳定 issue
- **AND** 不返回部分有效资源

### Requirement: 稳定目标槽位与属性冲突

Animation Asset MUST 保留不可重映射的 `self` 目标，并 MAY 声明稳定命名槽位。节点映射 MUST 只接受
宿主普通后代且不得进入组件实例内部。不同活动动画不得同时驱动同一 Entity 的同一属性通道；失效映射
与冲突 MUST 保留原数据并产生非阻断 diagnostic。

#### Scenario: 把动画复用到另一组节点

- **WHEN** 两个宿主分别把同一资源的 self 和命名槽位映射到各自兼容节点
- **THEN** 两个播放器使用同一关键帧内容并只修改各自运行时目标
- **AND** 场景节点名称变化不破坏槽位 ID 或映射

#### Scenario: 后代槽位跨越实例边界

- **WHEN** 用户尝试把槽位绑定到组件实例内部复合地址或宿主子树之外
- **THEN** 编辑器拒绝该映射并说明边界
- **AND** 既有合法映射保持不变

#### Scenario: 两个动画竞争同一属性

- **WHEN** 两个资源映射后会同时驱动同一 Entity 的背景颜色
- **THEN** 编辑器按当次会话的文档事务顺序拒绝后创建的冲突映射
- **AND** 外部非法输入在运行时按 Hierarchy 深度优先、同级 sibling index 的稳定顺序只使用第一条轨道
  并诊断其余轨道

### Requirement: 节点 Animation 能力与播放参数

每个 Entity MUST 最多附加一个 Animation 能力。能力 MUST 保存可空稳定资源引用、目标映射和 authored
的 play、playback、delayMs、speed；默认值 MUST 为 false、once、0、1。只有 play MUST 作为 boolean
Component Field Contract 暴露给页面 setup value 绑定。移除能力 MUST 在同一事务中清理其字段绑定。

#### Scenario: 绑定动画并配置播放

- **WHEN** 用户给节点添加动画能力、选择资源并设置 loop、100ms delay 和 2 倍 speed
- **THEN** 一个文档事务保存资源引用、目标映射和参数
- **AND** 资源关键帧内容不复制进 ComposeDocument

#### Scenario: setup 控制 play

- **WHEN** Animation.play 绑定到页面返回的 boolean Computed 且其值从 false 变为 true
- **THEN** 播放器按 authored delay、speed 与 playback 从头启动
- **AND** Computed 的当前值不写入文档或历史

#### Scenario: 停止并恢复基础属性

- **WHEN** once 动画完成并保持末帧后 play 变为 false
- **THEN** 所有动画视觉覆盖被移除并恢复 authored 基础属性
- **AND** ComposeDocument、LayoutSnapshot 和事务历史没有变化

#### Scenario: 锁定节点不能编辑动画

- **WHEN** Entity 已锁定但保存了合法 Animation
- **THEN** Inspector 禁用资源、目标与播放参数编辑
- **AND** Preview 仍可按保存配置播放动画

### Requirement: 确定性视觉动画 Runtime

Animation Runtime MUST 使用可注入 clock/scheduler 计算位置偏移、旋转、缩放、透明度和纯色背景的
FrameSnapshot，并 MUST 支持 Linear、cubic-bezier、Spring 与 Hold。Runtime MUST NOT 动画 Yoga
尺寸、Flow/Hug、padding、gap 或其他布局字段，也 MUST NOT 直接访问 DOM。帧覆盖的提交 MUST NOT 依赖
逐帧 React 状态更新；只有轨道集合或资源身份变化 MAY 触发 React 渲染。

#### Scenario: 计算中间视觉帧

- **WHEN** 300ms Linear 轨道在 0ms 为白色且 300ms 为红色，受控时钟位于 150ms
- **THEN** FrameSnapshot 返回确定的中间 RGBA 颜色
- **AND** 输入 Entity、文档和布局快照保持引用与内容不变

#### Scenario: 执行播放模式

- **WHEN** 注入时钟分别驱动 once、loop 与 ping-pong 播放器越过周期边界
- **THEN** once 保持末帧、loop 回到周期起点、ping-pong 反向计算
- **AND** play=false 时三者都取消调度并清除覆盖

#### Scenario: 逐帧推进不触发 React 渲染

- **WHEN** 一个 loop 动画在受控时钟下连续推进多帧
- **THEN** 目标元素的视觉覆盖逐帧更新
- **AND** 消费该动画的 React 组件渲染次数不随帧数增长

#### Scenario: 资源或绑定失败时局部降级

- **WHEN** 动画资源缺失、解析失败、页面 export 非 boolean 或目标槽位失效
- **THEN** 对应动画保持 authored 基础视觉并发布可定位 diagnostic
- **AND** 其他节点动画继续播放

### Requirement: Animation Store 资源读写

Animation Store MUST 通过 ComposeAssetProvider 的稳定 assetKey 与 revision 创建、读取、保存、订阅和
失效动画资源，并 MUST 支持 Abort。保存 MUST 使用 expected revision，冲突时 MUST 拒绝写入并把冲突
报告给调用方，MUST NOT 自动覆盖远端内容。新建资源 MUST 先成功写入文件，再以一个文档事务附加节点
引用。

#### Scenario: 新建资源后绑定节点

- **WHEN** 用户为节点创建新的动画文件
- **THEN** 系统先成功创建资源，再以一个文档事务写入 Animation 引用和目标映射
- **AND** Undo 只撤销文档绑定而不删除资源文件

#### Scenario: 保存遇到资源冲突

- **WHEN** 保存时 Provider revision 已在外部变化
- **THEN** Store 拒绝写入并返回可识别的冲突结果
- **AND** 远端内容与节点引用都不被修改

#### Scenario: 订阅新 revision

- **WHEN** 一份被播放器消费的资源在 Provider 侧更新
- **THEN** 订阅者收到失效通知并在下一次解析时使用新 revision
- **AND** 卸载后不再收到通知且迟到的异步结果被丢弃
