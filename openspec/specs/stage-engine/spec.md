# stage-engine Specification

## Purpose
TBD - created by archiving change extract-stage-interaction-engine. Update Purpose after archive.
## Requirements
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

### Requirement: Headless 交互 Controller

系统 MUST 提供实例级 `StageInteractionController`，使用普通数据事件、不可变 snapshot 和 surface effect port
表达 pan、marquee、move、resize、rotate、guide、external drag 与 draw。一个 controller MUST 同时只允许一个
surface 连接。

Controller MUST 由交互内核与一组注册插件组合而成；`createStageInteractionController()`
MUST 保持既有公共签名，并 MUST 默认组合出与重构前逐项一致的行为。`StageInteractionSnapshot`、
`StageInteractionEffect`、`StageInteractionEvent` 与 surface port 协议 MUST NOT 因内核化而改变。

#### Scenario: 连接并驱动 surface

- **WHEN** 宿主连接一个 surface、更新受控 context 并发送 Pointer 事件
- **THEN** controller 发布对应 phase 与 preview snapshot
- **AND** viewport、selection、pointer capture、绘制提交和命令请求通过 effect port 返回

#### Scenario: 拒绝第二个同时连接的 surface

- **WHEN** 同一 controller 已连接 surface 且另一个 surface 尝试连接
- **THEN** connectSurface 明确抛错
- **AND** 原连接与活动交互保持不变

#### Scenario: 默认组合不改变公共协议

- **WHEN** 宿主按既有方式创建 controller 并驱动任意手势
- **THEN** 其 snapshot 字段、effect 序列与 surface port 调用与内核化之前一致
- **AND** 宿主无需感知内核或插件的存在

### Requirement: 手势预览与原子提交

StageInteractionController MUST 在 session 开始冻结 Layout Snapshot。Flow move preview MUST 使用
resolved box 应用位移且 MUST NOT 改变 preview 中的 positioning 语义；Fill resize preview MUST 把
活动 axis 视为 Fixed。Cancel MUST 丢弃全部布局意图 preview，pointerup MUST 请求最多一个命令或
batch。

并发的**外部**文档或布局变化 MUST 中止引用 Entity 的空间手势（移动、缩放、旋转、端点、Paint），
但 MUST NOT 中止绘制手势——绘制只由世界坐标定义，不引用任何 Entity。退出文字编辑时删除空文字
会在同一次指针按下里改动文档，若一并中止，紧接着开始的绘制会当场消失。工具切换仍然中止绘制。

手势自身触发的预览 Snapshot MUST NOT 中止手势：宿主 MUST NOT 把预览 Snapshot 作为 controller
context 的输入（预览只交给场景渲染层），controller context 始终持有提交态文档与 Snapshot，
手势的落点判定与提交几何因此始终以冻结 Snapshot 为准。外部并发文档变化的中止判定不变。

#### Scenario: 混合选择移动并取消
- **WHEN** Flow 与 Absolute 混合选择开始移动后收到 Escape
- **THEN** preview 中的 offset 全部清除并恢复原 Snapshot
- **AND** surface 不收到 dispatch effect

#### Scenario: 绘制中途的文档变化不打断手势

- **WHEN** 绘制手势进行中，文档因删除其他 Entity 而变化
- **THEN** 绘制手势保持进行，松手仍然请求一次 `drawing.commit`
- **AND** 同样情况下的移动手势仍然被中止

#### Scenario: 手势自身的预览 Snapshot 不中止手势

- **WHEN** resize 手势期间宿主经预览通道得到新的预览 Snapshot 并渲染
- **THEN** 手势保持进行，controller context 仍持有提交态 Snapshot，落点与提交几何以冻结
  Snapshot 为准
- **AND** 同一期间到达的外部文档事务仍按既有规则中止手势

### Requirement: 资源批量外部拖入会话

Stage Engine MUST 以纯数据 assets descriptor 支持 external begin/move/end/cancel，并用现有
SceneIndex 解析 drop 世界点和最深合法 Frame。

#### Scenario: 资源落到 Frame 或 Canvas

- **WHEN** 一批资源在嵌套 Frame 或空白 Canvas 松手
- **THEN** external.drop effect 包含同一批资源、世界点和合法 parentId
- **AND** Engine 不读取 Blob 或构造 Component props

#### Scenario: 取消资源拖入

- **WHEN** 拖拽取消或未落在已连接 surface
- **THEN** preview 被清理且没有 drop effect

### Requirement: ECS SceneIndex

Stage Engine MUST 从 ComposeDocument v6 与 ready ComposeLayoutSnapshot 建立 parent、世界矩阵、
可见性、锁定、容器、裁剪与 GeometryConstraints 索引。全部世界几何 MUST 使用 Snapshot box 加
Transform rotation，缓存 MUST 同时区分 document 与 snapshot revision。

`containerAtPoint` MUST 接受一个可选的排除 Entity ID 集合，返回结果 MUST NOT 包含集合中的 Entity
及其任何后代——供画布内拖拽 reparent 判定候选容器时排除被拖动的选区自身，避免把节点拖进它自己或它
的子孙。

#### Scenario: Snapshot 改变使空间索引失效
- **WHEN** 文档引用不变但 Layout Snapshot revision 与子项 box 改变
- **THEN** SceneIndex 返回新的世界矩阵、bounds、命中与裁剪结果
- **AND** 不读取旧 Transform position/size

#### Scenario: 容器命中排除自身与后代

- **WHEN** 以拖动中选区的 Entity ID 作为排除集合查询 `containerAtPoint`
- **THEN** 返回结果不是选区中任何 Entity，也不是它们任意一个的后代
- **AND** 排除集合为空时行为与此前一致

### Requirement: ECS 结构命令

Reparent 与 Duplicate MUST 接受开始 Layout Snapshot，并按目标 parent Layout 决定 positioning、offset
与 Fill 转换；Group/Ungroup MUST 为 Flow 目标返回稳定不可用原因。

子级进入 Auto Layout 容器时，若父级 `alignItems` 为 `stretch`、子级 `alignSelf` 为 `auto` 且子级交叉轴
尺寸模式为 `fixed`，命令 MUST 把该交叉轴改写为 `fill` 并保留原固定值作为回退。改写 MUST 只作用于交叉
轴，MUST NOT 作用于 `hug` 或 `fill`，也 MUST NOT 在父级 `alignItems` 后续变化时重新触发。

#### Scenario: Scene Tree 跨布局移动
- **WHEN** 节点从 free parent 移入 Layout、在 Layout 间移动或移出到 free parent
- **THEN** 分别得到 Flow、保持 Flow、或烘焙 Absolute 的确定 LayoutItem
- **AND** 一个 Undo 恢复 parent、index 与全部原 authoring 值

#### Scenario: 固定尺寸子级进入拉伸容器
- **WHEN** 交叉轴为 `fixed` 的子级进入 `alignItems: stretch` 且自身 `alignSelf` 为 `auto` 的容器
- **THEN** 该子级的交叉轴尺寸模式变为 `fill`，原固定值保留为回退值
- **AND** 主轴尺寸模式保持不变

#### Scenario: 子级显式对齐时不改写尺寸
- **WHEN** 子级 `alignSelf` 不是 `auto`，或父级 `alignItems` 不是 `stretch`
- **THEN** 子级的交叉轴尺寸模式保持原样
- **WHEN** 子级交叉轴是 `hug` 或 `fill`
- **THEN** 命令不改写该轴

#### Scenario: 父级此后改变对齐不回溯
- **WHEN** 子级已按上述规则改写为 `fill`，随后父级 `alignItems` 改为非 stretch
- **THEN** 已有子级的尺寸模式不被自动改回，用户可自行调整

### Requirement: ECS 外部拖入

External descriptor MUST 统一使用 Entity Preset ID。Engine MUST 只负责世界定位和最深合法
Hierarchy 命中，React adapter MUST 使用 Registry 创建 Entity seed。

#### Scenario: 拖入任意 Entity Preset

- **WHEN** 用户从 Palette 拖入 Container 或 Renderer Preset
- **THEN** drop effect 包含 presetId、世界点和合法 parentId
- **AND** Engine 不读取 Renderer props 或 React Definition

### Requirement: 受约束变换 System

Stage Engine MUST 提供受约束的移动与缩放：轴向手柄把位移约束到单轴，缩放手柄按约束求解新几何，
两者都只在拖拽期间发布预览、松手时至多提交一条命令。

轴向移动手柄 MUST 由独立交互插件承担，并与其他移动入口共用同一个会话工厂——各入口只在**何时
接管**与是否带轴向约束上不同，接管之后的推进与提交完全一致。

缩放 MUST 由独立交互插件承担，且只在 select 与 scale 工具下接管。选区中只要有一个目标要求
保持比例，整个选区 MUST 按等比求解，等价于用户一直按着 Shift——否则同一次拖拽会让一部分目标
变形、另一部分不变形。

命中变换手柄但接管条件不成立时（工具不对、选区没有可变换目标），插件 MUST 消费这次按下而不是
放行——手柄画在选区之上，放行会让它退化成一次移动或框选。

#### Scenario: 轴向手柄只改变一个轴

- **WHEN** move 工具下拖动 X 轴手柄并同时产生 Y 方向位移
- **THEN** 预览只沿 X 轴移动

#### Scenario: 工具已切换时手柄按下被消费

- **WHEN** 工具已不是 move，用户在残留的轴向手柄上按下
- **THEN** 本次按下被消费，不产生任何效果，也不开始自由拖动

#### Scenario: 缩放只在松手提交一次

- **WHEN** 用户拖动角手柄后松手
- **THEN** 拖拽期间只发布预览，松手请求一条命令

#### Scenario: 等比约束等价于按住 Shift

- **WHEN** 选区含要求保持比例的目标，用户只沿一个轴拖动手柄
- **THEN** 另一个轴同步变化

#### Scenario: 并发变化中止变换

- **WHEN** 轴向移动或缩放进行中 `document` 被别处的编辑替换
- **THEN** 会话被取消，松手不产生任何命令

### Requirement: 无 DOM Paint 编辑与图层采样会话

Engine MUST 在无 DOM 环境下维护 Paint 控制柄拖拽与图层采样会话，移动期间只发布 preview，
松手时至多请求一条 Appearance 命令。

Paint 控制柄拖拽 MUST 由独立交互插件承担。命中控制柄但接管条件不成立时（宿主未打开该 Entity
的 Paint 编辑、选区不止一个、选区不是该 Entity、目标被锁定），插件 MUST 消费这次按下而不是
放行——控制柄压在 Entity 自身之上，放行会让它退化成一次移动手势。

世界坐标到 Paint 归一化局部坐标的换算 MUST 只有一处实现，供控制柄拖拽与图层采样共用。

#### Scenario: 渐变控制柄只 preview

- **WHEN** 用户拖动线性渐变端点控制柄
- **THEN** Engine 以逆世界矩阵换算局部 Paint 坐标并发布 preview
- **AND** 松手时请求一条 setAppearance 命令

#### Scenario: 锁定目标上的控制柄按下不退化成移动

- **WHEN** Paint 编辑打开但目标已被锁定，用户在控制柄上按下
- **THEN** 本次按下被消费，不产生任何效果，也不开始移动手势

#### Scenario: 并发文档变化中止渐变拖拽

- **WHEN** 渐变拖拽进行中，`document` 被别处的编辑替换
- **THEN** 会话被取消，松手不产生任何命令

#### Scenario: 编辑目标或选区变化结束会话

- **WHEN** 渐变拖拽进行中，宿主关闭 Paint 编辑或选区不再恰好是该 Entity
- **THEN** 会话被取消，不产生命令

### Requirement: 基于图层的安全降级取色

Engine MUST 命中最深、最上层、可见且未被裁剪排除的 Entity。普通采样返回点击局部点的 Solid/Gradient 颜色；Alt/Option 采样返回完整 backgroundPaint。无可求值 Paint 的 Entity 不得产生文档命令。

取色 MUST 由独立交互插件承担，其接管条件是宿主已启动采样，**与命中类型无关**——采样期间画布上
任何位置按下都是一次采样。采样几何计算 MUST 是接收文档与场景索引的纯函数，不依赖会话闭包。
采样目标变化时会话 MUST 结束。

#### Scenario: 采样被裁剪层与完整 Paint

- **WHEN** 用户在 Stage sample mode 点击被裁剪排除的层，或 Alt 点击可见 Gradient layer
- **THEN** 前者不会被采样，后者返回完整结构化 Paint
- **AND** 选择、viewport 和普通移动手势不改变

#### Scenario: 采样期间任何命中都触发采样

- **WHEN** 采样进行中用户在画布 chrome 或任意实体上按下
- **THEN** 本次按下作为采样处理，不落到该命中原本的手势

#### Scenario: 采样目标变化结束会话

- **WHEN** 采样会话进行中宿主把采样目标换成另一个 Entity 或另一个字段
- **THEN** 会话结束且不产生指向原目标的命令

### Requirement: 无 DOM 文字编辑会话

StageInteractionController MUST 以普通数据 context、event、snapshot 和 effect 支持画布内文字编辑会话，
不得导入 React、DOM、Registry 或 Renderer。会话 MUST NOT 持有文本内容——编辑期间的中间文本是宿主
DOM 层的瞬时状态，Controller 只判定会话的进入、退出与提交时机。

Controller MUST 在以下情形判定进入编辑：`draw-text` 工具创建文字之后；select 工具双击一个可原地
编辑的 Entity；单选一个可原地编辑的 Entity 时按 `Enter`。Controller MUST 在
以下情形判定退出：`Esc`；在编辑目标之外按下指针；选区变化到其他 Entity；编辑目标从文档中消失。

编辑会话存在期间，Controller MUST 屏蔽该 Entity 的移动、缩放、旋转手势与框选，使指针拖拽不再产生
空间命令。会话的进入与退出 MUST 各自只发布一次 effect，宿主据此持有会话状态并作为 context 回传。

#### Scenario: 绘制提交后进入编辑

- **WHEN** 用户以 `draw-text` 工具在画布上按下松开，宿主随后回灌本次绘制创建的 Entity
- **THEN** Controller 发布进入编辑会话的 effect，指向该新建 Entity

### Requirement: 文字工具只按点创建

`draw-text` 的绘制终点 MUST 始终锁在按下点：文字不承载「拖出一个尺寸」的语义，拖多远都只在按下点
创建一个 Auto width（Hug）文字。该约束 MUST 同时作用于绘制预览与提交 bounds，否则会出现拖动时长出
一个框、松手又缩回去的跳变。其他绘制工具的拖拽尺寸语义 MUST NOT 受影响。

#### Scenario: 文字工具拖拽不改变尺寸

- **WHEN** 用户以 `draw-text` 工具按下后拖动一段距离再松手
- **THEN** 预览与提交 bounds 都停在按下点，尺寸为零
- **AND** 以 `draw-rectangle` 等工具做同样操作仍按拖拽尺寸创建

#### Scenario: 双击已有文字进入编辑

- **WHEN** 用户以 select 工具双击一个可原地编辑的 Entity
- **THEN** Controller 发布进入编辑会话的 effect 且不产生移动命令
- **AND** 双击不可原地编辑的 Entity 时不进入会话

#### Scenario: 编辑期间屏蔽空间手势

- **WHEN** 用户在编辑会话中于编辑目标上按下并拖拽指针
- **THEN** Controller 不产生移动、缩放、旋转或框选命令
- **AND** 在编辑目标之外按下时退出会话

#### Scenario: 目标消失时结束会话

- **WHEN** 编辑目标被撤销、删除或替换导致其不再存在于文档中
- **THEN** Controller 结束会话并发布退出 effect
- **AND** 不产生指向已消失 Entity 的命令

### Requirement: 文字编辑会话的输入协议

Controller 判定编辑会话需要三项它当前拿不到的事实。三者 MUST 全部以普通数据经既有 context/event
协议进入，Controller MUST NOT 为此导入 Registry、DOM 或物料类型。

**连击计数。** 指针按下事件 MUST 携带连击计数，使 Controller 能区分单击与双击。计数由宿主按平台
惯例归一化后传入，Controller MUST NOT 自行计时或持有 DOM 事件。

**可编辑判定。** context MUST 提供「某 Entity 是否可原地编辑」的判定入口，由宿主查询 Registry 后
提供。Controller MUST 只消费该判定结果，MUST NOT 感知 Renderer type 或 prop 名称——prop 名称属于
提交环节，由宿主在退出时向 Registry 查询。

**新建 Entity 回灌。** 宿主处理 `drawing.commit` 创建实体后 MUST 通过 context 回灌本次绘制实际创建的
Entity。Controller MUST 只对 `draw-text` 的绘制消费一次该事实并发布一次进入编辑 effect，MUST NOT 因
context 反复回灌同一事实而重复进入会话，也 MUST NOT 对其他绘制工具的创建进入编辑。

#### Scenario: 按连击计数区分单击与双击

- **WHEN** select 工具在可原地编辑的 Entity 上收到连击计数为 1 的按下
- **THEN** Controller 按普通选择/移动处理，不进入编辑会话
- **AND** 同一 Entity 上连击计数为 2 的按下进入编辑会话

#### Scenario: 可编辑判定只来自 context

- **WHEN** context 判定某 Entity 不可原地编辑
- **THEN** 双击与 `Enter` 都不进入编辑会话
- **AND** Controller 全程未读取 Renderer type、prop 名称或任何 Registry 接口

#### Scenario: 新建回灌只消费一次

- **WHEN** 宿主回灌一次 `draw-text` 绘制创建的 Entity，随后 context 因其他原因多次更新
- **THEN** Controller 只发布一次进入编辑 effect
- **AND** 以 `draw-rectangle` 等其他工具创建时不发布进入编辑 effect

### Requirement: Headless 绘制会话

Engine MUST 在无 DOM 环境下维护绘制会话：拖拽期间只发布绘制预览，松手时至多请求一次
`drawing.commit`，MUST NOT 自行创建实体或铸造 ID——真正创建的是宿主。

绘制 MUST 由独立交互插件承担，且绘制工具下在空白或节点上按下都起笔：画布上已有内容不该挡住
继续作图。

绘制会话 MUST NOT 因并发的文档或布局变化中止——它只由世界坐标定义，不引用任何 Entity。退出
文字编辑时删除空文字会在同一次指针按下里改动文档，一并中止会让紧接着开始的绘制当场消失。
工具切换 MUST 中止绘制。

绘制点的约束（文字只按点创建、Shift 锁定正方形）MUST 只有一处实现，预览与提交共用；否则会
出现拖动时长出一个框、松手又缩回去的跳变。

#### Scenario: 松手才请求绘制提交

- **WHEN** 用户用矩形工具拖出一个区域并松手
- **THEN** 拖拽期间只发布预览，松手请求一次 `drawing.commit`

#### Scenario: 绘制中途的文档变化不打断手势

- **WHEN** 绘制手势进行中，文档因删除其他 Entity 而变化
- **THEN** 绘制手势保持进行，松手仍然请求一次 `drawing.commit`

#### Scenario: 工具切换中止绘制

- **WHEN** 绘制手势进行中工具切换为 select
- **THEN** 会话被取消，松手不请求任何提交

#### Scenario: 零尺寸按下不创建

- **WHEN** 用户用矩形工具按下后未移动即松手
- **THEN** 不请求提交

#### Scenario: 文字工具按点即创建

- **WHEN** 用户用文字工具按下后未移动即松手
- **THEN** 请求一次零尺寸的 `drawing.commit`

### Requirement: Headless 两点端点会话

Engine MUST 支持两点图形的端点拖拽会话：移动期间只发布端点 preview 与吸附参考线，松手时
请求一次端点提交，MUST NOT 自行决定文档表示。

端点拖拽 MUST 由独立交互插件承担。插件 MUST 在接管当刻冻结端点与指针的世界坐标偏移，使拖动
从端点原位开始——端点命中区大于端点本身，直接采用指针位置会让首次移动把端点吸到指针上。

命中端点但接管条件不成立时（目标不存在或不可见、顶层选区不是该 Entity、目标被锁定、几何约束
禁止 resize、工具既非 select 也非 scale），插件 MUST 消费这次按下而不是放行——端点手柄画在
图形自身两端，放行会让它退化成一次移动手势。

#### Scenario: 端点预览只在松手请求一次提交

- **WHEN** 用户拖动线段端点后松手
- **THEN** 移动期间只发布 preview，松手请求一次端点提交
- **AND** 拖动期间不产生任何文档命令

#### Scenario: 抓取偏移避免首次移动跳点

- **WHEN** 用户按在端点命中区内但偏离端点本身的位置并开始拖动
- **THEN** 端点保持与指针的原始偏移，不跳到指针位置

#### Scenario: 锁定目标上的端点按下不退化成移动

- **WHEN** 目标已被锁定，用户在其端点手柄上按下
- **THEN** 本次按下被消费，不产生任何效果，也不开始移动手势

#### Scenario: 并发变化中止端点拖拽

- **WHEN** 端点拖拽进行中，`document` 被别处的编辑替换，或选区不再是该 Entity
- **THEN** 会话被取消，松手不产生端点提交

### Requirement: Group 动态编辑范围

Stage Engine MUST 使用 Group 的可见后代世界 bounds 并集作为命中、吸附和选择反馈范围，不得因后代
移动而改写 Group 持久化 LayoutItem；没有可见后代时 MUST 回退到持久化 frame。

#### Scenario: 后代移出初始范围

- **WHEN** Group 子项移动到初始持久化 frame 之外
- **THEN** Group 编辑范围扩展到新的可见后代并集
- **AND** Group 的 LayoutItem 与文档 revision 不因此改变

### Requirement: 可编辑路径会话与命中

`@compose-ui/stage-engine` MUST 支持宿主注入的可编辑路径会话与世界坐标路径几何，并在
Pointer 命中路径顶点或切线手柄时产出 `path-handle` 语义命中，携带手柄种类与顶点标识。
路径手柄的命中优先级 MUST 高于 Entity 本体；切线手柄的命中优先级 MUST 高于顶点。
引擎 MUST NOT 依赖关键帧、动画或任何文档动画协议，顶点标识对引擎 MUST 是不透明字符串。
未注入路径会话时，引擎行为 MUST 与现在完全一致。

#### Scenario: 顶点命中优先于对象本体

- **WHEN** 一个路径顶点位于某 Entity 的可见区域之上，用户在该点按下
- **THEN** 命中结果是该顶点的 `path-handle`，而不是这个 Entity

#### Scenario: 切线手柄命中优先于顶点

- **WHEN** 切线手柄与顶点的命中区重叠，用户在重叠处按下
- **THEN** 命中结果是切线手柄

#### Scenario: 未注入路径会话

- **WHEN** 宿主没有传入可编辑路径
- **THEN** 引擎不产出任何 `path-handle` 命中，选择、拖动与框选行为不变

### Requirement: 可编辑路径手势

拖动路径手柄 MUST 产生带阶段的世界坐标手势结果并交给宿主，引擎 MUST NOT 自行修改文档或
派发命令。手势 MUST 区分开始、移动与结束三个阶段，并携带修饰键状态，使宿主能实现
"移动中只更新预览、结束时才写入一条可撤销记录"。

路径手势 MUST 由独立交互插件承担。手势被中断时插件 MUST 显式发出 `cancel` 阶段并携带会话
推进到的最新世界坐标——路径几何住在宿主的本地预览里，引擎不缓存几何，不通知就收不回来。

未注入路径会话时的 `path-handle` 命中 MUST 被消费而不落到后续插件；顶点上的双击 MUST 只
请求一次 corner/smooth 切换，不开始拖拽手势。

#### Scenario: 一次拖拽产生三阶段

- **WHEN** 用户按下顶点、移动若干次、松开
- **THEN** 宿主依次收到一次开始、若干次移动与一次结束，每次都带当前世界坐标

#### Scenario: 拖拽期间文档不被引擎修改

- **WHEN** 用户拖动切线手柄
- **THEN** 引擎不产出任何文档 Patch

#### Scenario: 中断通知带最新世界坐标

- **WHEN** 路径拖拽移动若干次后被取消
- **THEN** 宿主收到一次 `cancel` 阶段，其世界坐标是最后一次移动的位置而不是按下点

#### Scenario: 并发变化中止路径手势

- **WHEN** 路径拖拽进行中，`document` 被别处的编辑替换，或 `layoutSnapshot.revision` 前进
- **THEN** 手势被取消并发出 `cancel` 阶段，快照回到空闲

#### Scenario: 宿主换掉编辑目标

- **WHEN** 路径拖拽进行中，宿主把 `pathEditing` 指向另一个 Entity
- **THEN** 手势被取消，不产生指向原目标的结束阶段

### Requirement: 同级节点层级命令规划

Stage Engine MUST 提供无 React/DOM 的前移、后移、置顶和置底命令规划。规划 MUST 只修改直接父级的
`rootIds` 或 `Hierarchy.childIds`，保持 Entity 数据、选择和选中项相对顺序；跨父级多选 MUST 合并为一个
可撤销事务。

#### Scenario: 稳定调整多选层级

- **WHEN** 用户选择同一父级内连续或非连续的多个节点并执行任一层级动作
- **THEN** 单步动作按连续选中块交换一个相邻未选中节点，置顶置底使用稳定分区
- **AND** 选中节点彼此的相对顺序保持不变

#### Scenario: 分父级原子重排

- **WHEN** 选择包含多个直接父级的可编辑节点
- **THEN** 每个父级独立计算新顺序并通过一个 batch 提交
- **AND** 一个 Undo 恢复所有父级的原始顺序

#### Scenario: 跳过不可移动与边界目标

- **WHEN** 选择包含锁定节点、锁定父级子项或已位于目标边界的节点
- **THEN** 不可移动或无变化分组不产生子命令，其他有效父级仍正常重排
- **AND** 全部无变化时 availability 明确不可用且不产生事务

#### Scenario: 重排 Flow 子项

- **WHEN** Auto Layout parent 的 Flow 子项执行层级动作
- **THEN** 系统只调整 `Hierarchy.childIds` 并允许布局顺序同步变化
- **AND** 全部 LayoutItem、Transform 与其他 authoring 数据保持不变

### Requirement: 框选判定模式协议

Stage Engine MUST 导出 `StageMarqueeMode`，取值为 `intersect`、`contain` 与 `directional`，并
MUST 提供不依赖 React、DOM 与 controller 实例的纯函数解析框选结果。判定几何 MUST 使用节点的
世界 AABB；`intersect` 表示框与 AABB 有交集，`contain` 表示 AABB 完全落在框内。`directional`
MUST 由拖拽方向决定：起点在终点左侧时等价 `contain`，起点在终点右侧时等价 `intersect`。
纯函数 MUST 显式接收拖拽方向，不得从已归一化的矩形反推。解析结果 MUST 排除 hidden 与 locked
节点，并 MUST 按确定性场景顺序返回稳定文档 ID。

#### Scenario: 相交模式选中部分重叠节点

- **WHEN** 以 `intersect` 模式解析一个只与节点 AABB 部分重叠的框
- **THEN** 该节点进入结果

#### Scenario: 包含模式排除部分重叠节点

- **WHEN** 以 `contain` 模式解析同一个只与节点 AABB 部分重叠的框
- **THEN** 该节点不进入结果
- **AND** AABB 完全落在框内的节点仍进入结果

#### Scenario: 方向决定模式按拖拽方向切换判定

- **WHEN** 以 `directional` 模式解析同一个框，方向为从左往右
- **THEN** 结果与 `contain` 模式一致
- **AND** 方向为从右往左时结果与 `intersect` 模式一致

#### Scenario: 排除 hidden 与 locked 节点

- **WHEN** 框覆盖了 hidden 节点与 locked 节点
- **THEN** 两者都不进入结果

### Requirement: 框选工具与选区布尔组合

Stage Engine MUST 提供独立的框选工具入口：该工具下在空白或节点上按下都起框，这是它与 select
的唯一行为差异。命中判定模式与选区布尔组合规则两个入口 MUST 完全一致。

框选 MUST 至多有一处会话实现。三个接管入口（工具、容器体收敛、默认兜底）MUST 共用同一个会话
工厂，只在接管条件与起框容器参数上不同——它们在优先级表中分处不同位次，逐个抽取期间尤其
MUST NOT 各自维护一份推进与提交逻辑。

框选提交 MUST 排除起框容器及其祖先：从非空容器体上起框时用户看的是「容器内的画布」，把该容器
一并选中等于没有解决当初的收敛冲突。该排除 MUST 与命中解析同属一处提交语义实现。

选区布尔组合 MUST 以**释放时**按住的修饰键为准，允许用户在拖拽途中改变意图。

#### Scenario: 框选工具压在节点上也起框

- **WHEN** 框选工具下用户在一个节点上按下
- **THEN** 开始框选，不选中该节点

#### Scenario: 组合意图以松手修饰键为准

- **WHEN** 用户不按修饰键起框、拖拽途中按住 Shift 并松手
- **THEN** 结果与既有选区做加选组合

#### Scenario: 并发文档变化中止框选

- **WHEN** 框选进行中 `document` 被别处的编辑替换
- **THEN** 会话被取消，松手不请求任何选区变更

### Requirement: 画布拖拽 reparent 会话

Stage Engine MUST 在拖拽移动期间求解落点并只发布预览，松手时至多提交一条命令。

移动的预览求解与提交规划 MUST 是不写文档、不发效果的纯函数，且 MUST 只有一处实现——移动有
多个接管入口（轴向手柄与实体拖动），各自维护一份吸附与落点规则会让两条路径悄悄分叉。

位移在屏幕上不足以视为「开始拖动」时 MUST NOT 产出预览变换、吸附参考线或落点。判定 MUST 按
屏幕像素而非世界像素——缩小视图下同样的世界位移在屏幕上更小。

落点仍然成立时，几何 MUST 与 reparent/reorder 写进同一条命令：一次手势产生两条事务会让撤销
需要按两下。提交前 MUST 复核落点——拖动期间目标容器可能已被锁定、删除或去掉 Hierarchy，此时
MUST 退回纯几何提交而不是发出指向失效目标的命令。

#### Scenario: 拖到容器上换父级

- **WHEN** 用户把节点拖到另一个容器体上并松手
- **THEN** 请求一条同时完成换父级与几何写入的命令

#### Scenario: 抖动不产生预览

- **WHEN** 用户按下后只移动了不足以激活的距离
- **THEN** 不发布预览变换、吸附参考线或落点

#### Scenario: 锁定原父级时不产生落点

- **WHEN** 拖动中按住 Space，或宿主传入 `lockGestureParent`
- **THEN** 经过其他容器不产生 reparent 落点

#### Scenario: 落点在提交前失效

- **WHEN** 拖动期间目标容器被别处的编辑锁定
- **THEN** 该并发文档变化按既有手势原子性取消整个手势，不产生任何命令

### Requirement: Auto Layout 容器内原地重排

Controller MUST 支持 Auto Layout 容器内的原地重排。`move` 手势拖动 Layout 容器的 Flow 子级时，
Controller MUST 判定插入位置：`flexWrap` 为 `nowrap` 的容器按指针在主轴上的位置与各兄弟中点比较；
`wrap`/`wrap-reverse` 容器 MUST 先按冻结 Snapshot 中兄弟 box 的交叉轴区间聚类成行（`wrap-reverse`
行序取反），指针交叉轴坐标先选行，再在行内做主轴中点比较。插入序号 MUST 映射回容器原始
`childIds` 下标并复用与 `entity.move` 一致的索引代数。

Pointer Up 时存在顺序变化的插入位置则 MUST 只提交一次改变 `Hierarchy.childIds` 顺序的命令，
MUST NOT 修改该 Entity 的 `LayoutItem`，MUST NOT 发布 Transform 命令。插入位置与拖动前顺序相同、
或整个手势未产生任何 reorder/reparent 落点时，Flow 目标 MUST 回弹：不提交任何命令，历史不增加
条目，MUST NOT 回落为烘焙 Absolute——拖拽 MUST NOT 隐式改变 `LayoutItem.positioning`，脱流只能
经由显式入口（几何 Inspector 的「忽略 Auto Layout」开关）发生。

拖动过程中 Controller MUST 通过 snapshot 发布当前插入位置，供宿主呈现落点预览；预览 MUST NOT 产生
文档事务。一次拖拽 MUST 只表达一种结构意图：当选区并非全部属于同一候选容器时 MUST NOT 进入重排，
改按 reparent 规则统一处理或回弹，MUST NOT 在同一次手势内混合提交重排与其他结构命令。

#### Scenario: 容器内拖拽只重排不烘焙

- **WHEN** 用户在 `nowrap` 容器内把一个 Flow 子级拖到另一个兄弟旁边并在容器内松手
- **THEN** 提交的命令只改变 `Hierarchy.childIds` 顺序
- **AND** 该 Entity 的 `LayoutItem.positioning` 保持 `flow` 且不产生 Transform 命令

#### Scenario: wrap 容器跨行重排

- **WHEN** 用户在 `wrap` 容器内把第二行的 Flow 子级拖到第一行两个兄弟之间并松手
- **THEN** 提交的命令只把该子级移动到第一行对应的 `childIds` 位置
- **AND** `LayoutItem.positioning` 保持 `flow` 且不产生 Transform 命令

#### Scenario: 顺序未变化回弹且不产生事务

- **WHEN** 用户在容器内拖动 Flow 子级后松手，计算出的插入位置与原顺序一致
- **THEN** 不提交任何命令，节点回到布局位置
- **AND** 历史不增加条目且 `LayoutItem` 不变

#### Scenario: 无有效落点时 Flow 目标回弹

- **WHEN** 用户把 Flow 子级拖出容器边界，松手时指针不在任何合法容器的落点判定区内
- **THEN** 不提交任何命令，节点回到原容器的布局位置
- **AND** `LayoutItem.positioning` 保持 `flow`

#### Scenario: 拖动中呈现落点预览

- **WHEN** 用户在 Layout 容器内拖动 Flow 子级并移动指针
- **THEN** Controller 随指针在 snapshot 中发布当前插入位置
- **AND** 预览期间不产生任何文档事务

#### Scenario: 选区跨容器时不进入重排

- **WHEN** 一次拖动的选区同时包含某容器内的 Flow 子级与该容器外的其他目标
- **THEN** 不产生重排落点，整次手势按 reparent 规则统一处理或回弹
- **AND** 不在同一次手势内混合提交重排与其他结构命令

### Requirement: 组件提取复用已有单根

提取器 MUST 在选区是单个未锁定顶层节点时直接复用该节点作为组件根，不追加 Group 包装；只有多选或
需要统一归零坐标时才创建 Group 根。两种路径 MUST 都保持后代世界几何、旋转与 sibling 顺序不变。

#### Scenario: 单选容器不产生冗余层级

- **WHEN** 用户对单个 Container 或 Group 创建组件
- **THEN** 组件文档以该节点为唯一根
- **AND** 场景树中不出现额外的同名包装层

#### Scenario: 多选仍生成 Group 根

- **WHEN** 用户对两个及以上同父级顶层节点创建组件
- **THEN** 提取器创建 Group 根并把选区作为其子项
- **AND** 所有后代的世界几何保持不变

### Requirement: Entity 会话剪贴板规划

Stage Engine MUST 提供与 React 无关的会话剪贴板规划：从选择规范化复制/剪切来源、解析建议粘贴
落点，以及把剪贴板转成既有 `entity.duplicate` 或移动/reparent 命令。规范化 MUST 按文档遍历顺序
保留顶层来源并去掉已被祖先覆盖的后代。剪切来源 MUST 排除锁定节点；粘贴到自身、后代或锁定父级
MUST 判定为不可用且不产生命令。

#### Scenario: 规范化多选复制来源

- **WHEN** 选择同时包含容器及其子项并请求复制
- **THEN** 剪贴板只保留该容器
- **AND** 锁定节点仍可进入复制剪贴板

#### Scenario: 建议落点

- **WHEN** 目标是未锁定容器、叶节点或空选区
- **THEN** 分别解析为容器末尾、该节点之后或根级末尾

#### Scenario: 复制到指定父级

- **WHEN** 规划器为复制剪贴板提供与来源不同的父级
- **THEN** 生成的 duplicate 命令写入该父级与索引
- **AND** Absolute 副本不再额外偏移 10

### Requirement: 新建落点解析

`@compose-ui/stage-engine` MUST 提供无 React、无 DOM 的落点解析原语：判定一个 Entity 是否是
容器类（拥有 `Hierarchy` 且不是 Group），以及把一个包围盒钳制进给定 Frame 尺寸的纯函数。
钳制 MUST 保持宽高不变、只平移左上角；Entity 在某一轴上大于 Frame 时该轴 MUST 钳到 0。
既有的落点建议解析 MUST 接受一个回退 Frame 参数，使无命中目标时的落点是宿主给出的激活
场景而不是 `rootIds` 中的第一块。

#### Scenario: 钳制完全在场景之外的包围盒

- **WHEN** 一个 100×50 的包围盒位于 `(2000, -300)`，目标 Frame 尺寸为 1280×720
- **THEN** 结果为 `(1180, 0)`，宽高不变

#### Scenario: 钳制大于场景的包围盒

- **WHEN** 一个 2000×1000 的包围盒需要钳进 1280×720 的 Frame
- **THEN** 结果左上角为 `(0, 0)`，宽高不变

#### Scenario: 无命中目标时落点解析为回退 Frame

- **WHEN** 宿主传入激活场景作为回退 Frame 并请求无命中目标的落点
- **THEN** 落点父级是该激活场景，而不是 `rootIds` 中的第一块场景

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

### Requirement: 旋转工具插件

旋转 MUST 由独立交互插件实现，并按 `STAGE_GESTURE_PRIORITY` 排在绘制、框选与实体选择之前——
那些分支在工具非 select 时会提前退出，若排在旋转之前，空白按下会落到框选。

插件 MUST 在实体命中时先请求选区变更再开始旋转；MUST 在标尺、辅助线、Paint 柄与路径柄命中时
不接管，把本次按下交给后续插件；其余命中 MUST 对当前选区开始旋转，没有可旋转目标时
MUST 消费本次按下而不落到框选。

#### Scenario: 实体命中改选区并开始旋转

- **WHEN** 旋转工具下在一个未选中的可旋转实体上按下
- **THEN** 请求把选区改为该实体并开始旋转

#### Scenario: 画布 chrome 命中不被接管

- **WHEN** 旋转工具下在标尺上按下
- **THEN** 旋转插件不接管，标尺保留拖出辅助线的原语义

#### Scenario: 无选区时不落到框选

- **WHEN** 旋转工具下没有选区且在空白处按下
- **THEN** 本次按下被消费，不开始框选也不开始旋转

### Requirement: 非空容器体的命中收敛

`StageInteractionHit` 的 entity 分支 MUST 携带命中来源 `source`，取值 `body` 与 `label`，
缺省 MUST 视为 `body`。在 `select` 与 `move` 工具下，来源为 `body` 的命中若同时满足
「目标是 `rootIds` 的直接成员」「目标含 Hierarchy」「其 childIds 非空」「该目标不是
first-class Group」「该目标不在当前选区内」，controller MUST NOT 选中
该目标，而是 MUST 起框选，判定几何、方向判定、修饰键布尔组合与「不产生文档事务」MUST 与在
空白 surface 上起框一致。起框所在的容器及其祖先 MUST NOT 出现在框选结果中：用户是在这个
容器「里面」框内容，把它自己选中等于没有收敛。

锁定的容器与 first-class Group MUST 完全退出画布选中：无论是否有子元素、是否顶层、命中
来源是 body 还是 label，controller MUST NOT 选中它们，MUST 起框选。它们的选中入口只剩场景树。
锁定的非容器 Entity MUST 保持既有行为，仍可被选中检查但不可变换。

来源为 `label` 的命中 MUST 始终按普通 entity 命中处理（锁定容器除外）。收敛 MUST 只作用于会渲染标题标签的
顶层容器：嵌套容器与 first-class Group 没有标签，收敛之后将没有任何选中入口，因此
MUST NOT 参与收敛。空容器、已在选区内的容器、非容器
Entity、Shift 加选、锁定判定、marquee 工具与绘制工具的既有分支 MUST NOT 受影响。收敛
MUST NOT 改变 SceneIndex 的 `containerAtPoint` 与外部拖入的落点解析。

收敛判定 MUST 是可独立求值的纯函数，与它触发的框选会话同处一个模块——两者是同一个手势的不同
入口，分开放会让「哪些命中会起框」散在多处。

#### Scenario: 在非空容器空白处起框

- **WHEN** 工具为 `select`，容器含至少一个子元素且不在当前选区内，用户在其空白处按下并拖动
- **THEN** controller 进入 marquee phase，选区在按下瞬间保持不变
- **AND** 松手后按框选判定模式与修饰键组合出结果，不产生该容器的 move 手势
- **AND** 结果只包含被框住的后代，起框容器与其祖先不在其中

#### Scenario: 空容器仍可点体选中

- **WHEN** 容器没有子元素且用户在其上按下
- **THEN** 该容器成为选区并进入 move 手势

#### Scenario: 已选中的容器可以拖体移动

- **WHEN** 容器已在当前选区内且用户在其空白处按下并拖动
- **THEN** controller 进入 move phase，容器随指针移动

#### Scenario: 锁定容器与 Group 不可在画布上选中

- **WHEN** 用户在锁定的容器或 first-class Group 上按下，无论来源是 body 还是 label
- **THEN** 选区不发生变化，controller 进入 marquee phase
- **AND** 锁定的非容器 Entity 仍可被选中检查

#### Scenario: 嵌套容器不参与收敛

- **WHEN** 用户在一个含子元素、但父级不是画布根的容器上按下
- **THEN** 该容器成为选区并进入 move 手势

#### Scenario: Group 不参与收敛

- **WHEN** 用户在含子项的 first-class Group 上按下
- **THEN** 该 Group 成为选区并进入 move 手势

#### Scenario: 标签来源不参与收敛

- **WHEN** 命中来源为 `label` 且目标是含子元素的容器
- **THEN** 该容器成为选区并进入 move 手势

### Requirement: 会话自报是否接管临时平移键

会话 MUST 能自行声明它把临时平移键（Space）重新解释为自己的修饰键——移动手势用它表达
「锁定原父级」而不是临时平移，两种意图不会同时出现，手势进行中也无法再按下第二个指针开始平移。

声明后内核 MUST 把
`temporary-pan.start` / `temporary-pan.end` 只转发给该会话，MUST NOT 再切换 `temporaryPan`
标志。内核 MUST NOT 按插件 id 列表做这个判断——那会把手势知识重新塞回内核，且每新增一个入口
都要改内核一次。

未声明的会话与空闲状态 MUST 保持既有行为：切换 `temporaryPan` 标志。

#### Scenario: 移动中按 Space 锁定原父级

- **WHEN** 移动手势进行中用户按下 Space
- **THEN** `temporaryPan` 标志不变，手势保持在移动阶段
- **AND** 落点立即重算，经过其他容器不再产生 reparent 落点

#### Scenario: 松开 Space 恢复落点

- **WHEN** 移动手势进行中松开 Space
- **THEN** 落点恢复，且会话不被当作平移取消

#### Scenario: 空闲时 Space 仍是临时平移

- **WHEN** 没有活动会话时用户按下 Space
- **THEN** `temporaryPan` 标志置位

### Requirement: 副按键不开启手势

副按键（右键及以上）的按下 MUST NOT 开启任何手势——它承载上下文菜单，一旦被手势接管，菜单就
再也打不开。

该判定 MUST 在询问插件**之前**完成，MUST NOT 交由各插件各自实现：插件排在单体实现之前被询问，
分散实现既会漏，也让每个新插件都要重复它。

#### Scenario: 右键点击实体

- **WHEN** 用户在实体上按下右键
- **THEN** 不改变选区、不开始移动、不产生任何效果

#### Scenario: 中键仍然临时平移

- **WHEN** 用户在画布上按下中键
- **THEN** 开始平移手势

### Requirement: 实体命中的选中与拖动

在实体上按下 MUST 先请求选区变更，再按工具与目标状态决定这次按下的后续语义：select 工具下对
可编辑目标的双击进入原地文字编辑且 MUST NOT 开始移动；select/move 工具下未锁定的目标开始移动；
其余情形只改选区。

选区变更 MUST 先于指针捕获发出——宿主据此更新选中态，顺序颠倒会让捕获落在旧选区上。

基准选区 MUST 滤掉已从文档中消失的 ID，否则 Shift 加选会把失效引用一路带进新选区。

无论是否开始移动，这次按下 MUST 被消费：选区已经改过了，再交给后续插件会让同一次按下既改
选区又起框。命中不存在的 Entity 时 MUST NOT 产生任何效果——命中判定与文档已经脱节。

#### Scenario: 按下即改选区并开始移动

- **WHEN** select 工具下在未锁定实体上按下
- **THEN** 先请求把选区改为该实体，再开始移动手势

#### Scenario: 双击进入编辑而不拖动

- **WHEN** select 工具下双击一个可原地编辑的实体
- **THEN** 请求进入文字编辑，且不开始移动手势

#### Scenario: 锁定目标只改选区

- **WHEN** 用户在锁定实体上按下
- **THEN** 选区变为该实体，不开始移动，也不落到框选

#### Scenario: Shift 组合忽略失效引用

- **WHEN** 既有选区含已被删除的 ID，用户 Shift 点击另一个实体
- **THEN** 新选区只含仍然存在的实体

#### Scenario: 命中不存在的实体

- **WHEN** 命中的 Entity 已不在文档中
- **THEN** 不产生任何效果，也不开始框选

### Requirement: 源码目录对应包的职责描述

`stage-engine` 的功能目录 MUST 与该包在架构边界中声明的职责一一对应——坐标与吸附、场景索引与
命中、手势规划、空间命令、手势状态机。目录 MUST NOT 按技术类型划分。

新增职责时 MUST 同步更新架构边界描述，两者 MUST NOT 各自演化。

#### Scenario: 读边界描述即可定位代码

- **WHEN** 需要修改吸附规则
- **THEN** 从「坐标、吸附」这一职责直接定位到 `geometry/`，无需全局搜索

### Requirement: 文件名不得与其目录同名

模块文件名 MUST 在目录之外携带信息，MUST NOT 与所在目录重名——`geometry/geometry.ts` 这样的
命名等于没有命名。

#### Scenario: 命令目录下的结构命令

- **WHEN** 层级顺序与编组命令住在 `commands/`
- **THEN** 文件名说明它是哪一类命令，而不是重复目录名

### Requirement: 功能目录经由自身入口对外

每个功能目录 MUST 有自己的 `index.ts`。目录之间以及包公共入口对目录的引用 MUST 走该入口，
MUST NOT 深层引用实现文件。

包公共入口 MUST 逐符号列出导出而非 `export *`，并按目录分块——它是对外契约，不能随内部文件
的增删自动变化。

#### Scenario: 新增内部模块不改变公共 API

- **WHEN** 某个功能目录内新增一个实现文件并从目录入口导出
- **THEN** 包的公共 API 不变，除非公共入口显式列出新符号

### Requirement: 文档无关的交互内核契约

交互内核的会话仲裁、插件注册与插件契约 MUST 对文档类型泛型，MUST NOT 在类型或实现中
引用任何具体文档协议。内核 MUST 通过单一类型级 profile 接收 context、场景索引、事件、
claim 触发事件、效果与快照六个类型，使消费者只声明一个类型参数。

承载这三项契约的模块 MUST NOT import Stage 专有类型；该约束 MUST 由依赖边界测试守住，
而不只是写在文档里。

claim 的触发事件 MUST 由 profile 声明，内核 MUST NOT 硬编码任何事件种类名——命令驱动的
文档类型由键盘而非指针按下发起交互。

Stage 自身的内核类型 MUST 保持既有公共名称，作为 Stage profile 上的别名对外暴露，使既有
插件与消费者无需改动。

#### Scenario: 内核不引用具体文档类型

- **WHEN** 检查仲裁器、插件注册表与插件契约三个模块的 import
- **THEN** 其中不存在对 Stage 专有 context、场景索引、事件、效果或快照类型的引用
- **AND** 依赖边界测试在出现此类引用时失败

#### Scenario: 单一类型参数

- **WHEN** 一个新文档类型要复用内核
- **THEN** 它只需声明一个 profile 绑定六个类型
- **AND** 无需在每个插件、会话与测试夹具的签名上重复这六个类型

#### Scenario: claim 触发事件由 profile 决定

- **WHEN** 某文档类型的交互由键盘命令而非指针按下发起
- **THEN** 该 profile 把 claim 触发事件声明为对应的事件变体
- **AND** 内核不因此需要修改

#### Scenario: Stage 既有名称与行为不变

- **WHEN** 泛型化完成后运行既有的 Stage 交互测试与端到端用例
- **THEN** 18 个插件、Controller 与全部测试的 import 与调用一行未改
- **AND** 手势行为、快照协议与 effect 协议逐项与泛型化之前一致

