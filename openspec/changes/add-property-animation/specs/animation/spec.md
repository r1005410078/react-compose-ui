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
- **AND** 既有合法映射和资源草稿保持不变

#### Scenario: 两个动画竞争同一属性
- **WHEN** 两个资源映射后会同时驱动同一 Entity 的背景颜色
- **THEN** 编辑器拒绝后创建的冲突映射
- **AND** 外部非法输入在运行时只使用稳定顺序中的第一条轨道并诊断其余轨道

### Requirement: 节点 Animation 能力与播放参数

每个 Entity MUST 最多附加一个 Animation 能力。能力 MUST 保存可空稳定资源引用、目标映射和 authored
的 play、playback、delayMs、speed；默认值 MUST 为 false、once、0、1。只有 play MUST 作为 boolean
Component Field Contract 暴露给页面 setup value 绑定。

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

### Requirement: 确定性视觉动画 Runtime

Animation Runtime MUST 使用可注入 clock/scheduler 计算位置偏移、旋转、缩放、透明度和纯色背景的
FrameSnapshot，并 MUST 支持 Linear、cubic-bezier、Spring 与 Hold。Runtime MUST NOT 动画 Yoga
尺寸、Flow/Hug、padding、gap 或其他布局字段，也 MUST NOT 直接访问 DOM。

#### Scenario: 计算中间视觉帧
- **WHEN** 300ms Linear 轨道在 0ms 为白色且 300ms 为红色，受控播放头位于 150ms
- **THEN** FrameSnapshot 返回确定的中间 RGBA 颜色
- **AND** 输入 Entity、文档和布局快照保持引用与内容不变

#### Scenario: 执行播放模式
- **WHEN** 注入时钟分别驱动 once、loop 与 ping-pong 播放器越过周期边界
- **THEN** once 保持末帧、loop 回到周期起点、ping-pong 反向计算
- **AND** play=false 时三者都取消调度并清除覆盖

#### Scenario: 资源或绑定失败时局部降级
- **WHEN** 动画资源缺失、解析失败、页面 export 非 boolean 或目标槽位失效
- **THEN** 对应动画保持 authored 基础视觉并发布可定位 diagnostic
- **AND** 其他节点动画继续播放

### Requirement: Animation Store 与显式保存会话

Animation Store MUST 通过 ComposeAssetProvider 的稳定 assetKey 与 revision 创建、读取、保存、订阅和
失效动画资源。React 编辑会话 MUST 使用独立草稿与 Undo/Redo，只有显式保存才写 Provider，并 MUST
处理 expected revision 冲突、Abort、重新加载与强制覆盖。

#### Scenario: 保存动画草稿
- **WHEN** 用户移动关键帧、修改 easing 后执行保存
- **THEN** Store 以读取时 revision 写入完整候选资源并清除 dirty
- **AND** 播放器订阅新 revision 后使用新资源

#### Scenario: 保存遇到资源冲突
- **WHEN** Provider revision 已在外部变化
- **THEN** 会话保留本地草稿并提供重新加载或显式覆盖
- **AND** 不自动覆盖远端内容或修改节点引用

#### Scenario: 新建资源后绑定节点
- **WHEN** 用户为节点创建新的动画文件
- **THEN** 系统先成功创建资源，再以一个文档事务写入 Animation 引用和目标映射
- **AND** Undo 只撤销文档绑定而不删除资源文件

### Requirement: Auto-keyframe 自动属性轨道

动画编辑会话 MUST 默认开启可关闭的 Auto-keyframe。开启时，系统 MUST 识别视觉安全属性修改并写入
动画草稿，不提交对应文档事务；关闭时 MUST 完整保留既有文档编辑语义。时间轴 MUST 只显示检测到的
属性轨道且 MUST NOT 提供手动添加属性入口。

#### Scenario: 首次修改自动建立轨道
- **WHEN** 播放头位于 300ms，用户把未动画的白色背景改为红色
- **THEN** 会话自动创建背景轨道、0ms 白色关键帧和 300ms 红色关键帧
- **AND** Entity authored 背景仍为白色且文档历史不增加

#### Scenario: 更新当前时间的既有帧
- **WHEN** 当前属性轨道在播放头时间已经存在关键帧且用户再次修改属性
- **THEN** 会话更新该关键帧而不创建重复时间
- **AND** 一次连续颜色或拖动交互只增加一个动画会话历史项

#### Scenario: 关闭自动刻帧
- **WHEN** 用户关闭 Auto-keyframe 后修改同一属性
- **THEN** 系统按原有命令更新 ComposeDocument
- **AND** 动画草稿和关键帧保持不变

### Requirement: 容器范围时间轴与上下文 Inspector

React 时间轴 MUST 聚合当前 Hierarchy 容器后代的 Animation；叶子选择 MUST 使用最近 Hierarchy 祖先，
顶层叶子 MUST 使用隐式 Canvas。时间轴 MUST 区分节点持续区间、属性轨道、关键帧和播放头，并同时只
编辑一个活动动画资源。关键帧或区间选择 MUST 切换右侧上下文 Inspector。

#### Scenario: 聚合容器后代动画
- **WHEN** 容器内的 Fault 与 Alarm 分别绑定动画资源
- **THEN** 时间轴显示两个节点区间及各自自动识别的属性轨道
- **AND** 点击任一轨道只切换活动资源，不改变 Scene Tree 层级或文档选择

#### Scenario: 选择四个关键帧中的第三帧
- **WHEN** 属性轨道在 0、100、200、300ms 各有一帧且用户选择 200ms
- **THEN** 播放头移动到 200ms，第三个菱形显示选中，右栏显示 3/4、时间、值和进入该帧的 easing
- **AND** Stage 显示同一 FrameSnapshot

#### Scenario: 选择区间编辑缓动
- **WHEN** 用户选择两个关键帧之间的连线
- **THEN** 右栏显示 Curve/Spring/Hold 设置并把修改写入后一个关键帧的 easing
- **AND** 清除时间轴选择后右栏恢复节点 Inspector

