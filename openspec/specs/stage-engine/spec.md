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

StageInteractionController MUST 通过普通数据 context、event、snapshot 与 effect 支持 draw preview 和
`drawing.commit`，不得读取 Registry、Renderer props、React 或 DOM。绘制 geometry MUST 在世界坐标中
规范化，pointermove MUST 不 dispatch，pointerup MUST 最多请求一个 commit effect，取消 MUST 丢弃 preview。

绘制的**起点与终点 MUST 各自吸附**，且 MUST 复用 resize 的同一套规则：智能候选优先、无候选时
回退网格、按住 Cmd 时整体禁用。只吸附终点 MUST NOT 视为满足本项——起点不吸附时宽高同样不是
网格倍数。吸附 MUST 发生在 Shift 等长宽约束之前，使约束后的正方形/正圆边长仍是网格倍数。吸附生效时绘制
终点角 MUST 落在吸附结果上而不是光标裸坐标上——这与 resize 的既有行为一致：光标只是引导，
被拖动的那条边落在网格线或智能候选上。

#### Scenario: 绘制 preview 与提交

- **WHEN** draw tool 从 surface 开始拖拽并正常松手
- **THEN** snapshot 在拖拽中发布预览 bounds，松手时发出包含 tool、bounds 与合法 parent 命中的 commit effect
- **AND** Engine 不创建 Entity 或读取 Preset 内容

#### Scenario: 绘制吸附到网格

- **WHEN** 网格吸附开启（步进 8），用户在缩放不是 100% 的视口里拖出一个矩形，
  起止世界坐标都不是 8 的倍数
- **THEN** preview 与 `drawing.commit` 的 bounds 四条边都落在 8 的倍数上，宽高因此也是 8 的倍数

#### Scenario: 绘制吸附到智能候选

- **WHEN** 绘制终点落在某个既有节点边线的吸附阈值内
- **THEN** 该轴吸附到这条边线而不是网格，并发布对应的吸附参考线

#### Scenario: Cmd 临时禁用绘制吸附

- **WHEN** 用户按住 Cmd 绘制
- **THEN** 起点与终点都不吸附，bounds 为原始世界坐标

#### Scenario: Shift 锁定正方形与正圆

- **WHEN** 用户使用 rectangle 或 circle 工具拖拽，并在 pointermove 与 pointerup 时按住 Shift
- **THEN** preview 与 `drawing.commit` MUST 使用相同的等宽高 bounds，**吸附后的落点** MUST 保持为
  绘制终点角（吸附生效时该角落在网格线上而不是光标裸坐标上，与 resize 一致），负向拖拽仍保持正确象限
- **AND** 约束只存在于 Headless Engine；松开 Shift 后恢复常规矩形或椭圆 bounds

#### Scenario: 绘制被取消

- **WHEN** draw gesture 收到 Escape、pointercancel、window blur 或失去有效 pointer capture
- **THEN** draw preview 被清理且不存在 commit 或 command dispatch effect

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

Stage Engine MUST 导出 `StageMarqueeHitTest`，取值为 `intersect` 与 `contain`，并 MUST 提供
不依赖 React、DOM 与 controller 实例的纯函数解析框选结果。

判定几何 MUST 按 Entity 类型分流，与 `StageSceneIndex.entityAtPoint` 已有的分流形状一致：

- 盒模型 Entity 用节点的世界 AABB；`intersect` 表示框与 AABB 有交集，`contain` 表示 AABB
  完全落在框内。
- 带 `Curve` 的 Entity MUST 按**几何**判定，MUST NOT 用 AABB。盒里绝大部分是空的——一个从不
  碰线身的框选中斜线，与「点击包围盒空角不选中曲线」是同一条判断被破坏。

曲线的世界几何 MUST 复用点选与特征点走的同一条链（投影到盒，再经世界矩阵送到世界空间），
MUST NOT 把框逆变换进几何空间：非等比缩放会把矩形变成平行四边形，四条边不再轴对齐。

**填充过的曲线是例外**：框落在可见填充区域内 MUST 算命中，判断 MUST 走与点选路径相同的读取
入口。空心时 MUST NOT 做这一步。

非曲线 Entity 的**旋转仍用 AABB**，这是一处明写的欠账：旋转节点的 AABB 大于其图形，因此
`contain` 对它们偏严格。规范 MUST 保留这句话，直到矩形对凸四边形的判定落地。

**判定 MUST 恒由拖拽方向决定**：起点在终点左侧时为 `contain`，起点在终点右侧时为
`intersect`。MUST NOT 提供第三个「可选模式」值，也 MUST NOT 接受一个覆盖方向的模式参数。

方向本身就是切换器：一次拖拽即可选定，比开一个菜单快，也不残留状态。一个能改变「同一个拖拽
手势意味着什么」的全局开关，与「模式必须是对象作用域且有明确的进出」直接冲突；而两种判定
各自都有真实用途（框住整根导线 / 抓一把穿过某片区域的线），方向是它们之间最快的切换。

类型名 MUST 反映它不是一个模式而是**方向的归约结果**：命中与覆盖层读的都是这个结果。

纯函数 MUST 显式接收拖拽方向，不得从已归一化的矩形反推。解析结果 MUST 排除 hidden 与 locked
节点，并 MUST 按确定性场景顺序返回稳定文档 ID。

解析结果 MUST 排除 `rootIds` 的直接成员：框选表达的是「选这些内容」，而场景是容器不是内容，
把它一并选中之后紧接着的移动会整体搬走场景，且子级是相对坐标因而画面上看不出发生了什么。
该排除 MUST 不依赖框与场景的相对位置——从场景外面框住它同样不选中。其余 Frame（嵌套 Frame）
MUST 保持「完全包住框选区时不进入结果」的既有规则：它们没有标题标签，点体仍是唯一的画布
选中入口，一并排除会让它们够不着而没有补偿。

#### Scenario: 相交模式选中部分重叠节点

- **WHEN** 以 `intersect` 判定解析一个只与盒模型节点 AABB 部分重叠的框
- **THEN** 该节点进入结果

#### Scenario: 包含模式排除部分重叠节点

- **WHEN** 以 `contain` 判定解析同一个只与节点 AABB 部分重叠的框
- **THEN** 该节点不进入结果
- **AND** AABB 完全落在框内的节点仍进入结果

#### Scenario: 窗交框不因碰到曲线包围盒而命中

- **WHEN** 从右往左在一条斜线包围盒的空角里拖一个从不与线身相交的框
- **THEN** 该曲线不进入结果

#### Scenario: 窗交框穿过线身仍然命中

- **WHEN** 从右往左拖一个与同一条斜线的线身相交的框
- **THEN** 该曲线进入结果

#### Scenario: 框落在填充区内命中

- **WHEN** 在一个有不透明填充的整圆曲线内部拖一个完全落在填充区内的窗交框
- **THEN** 该曲线进入结果

#### Scenario: 空心形状内部的框不命中

- **WHEN** 同一个整圆曲线没有填充，在其内部拖同一个框
- **THEN** 该曲线不进入结果

#### Scenario: 判定按拖拽方向切换

- **WHEN** 解析同一个框，方向为从左往右
- **THEN** 结果与 `contain` 判定一致
- **AND** 方向为从右往左时结果与 `intersect` 判定一致

#### Scenario: 没有可选模式可传

- **WHEN** 调用方解析一次框选
- **THEN** 它只能给出拖拽方向，没有任何参数可以覆盖由方向得出的判定

#### Scenario: 排除 hidden 与 locked 节点

- **WHEN** 框覆盖一个 hidden 节点与一个 locked 节点
- **THEN** 两者都不进入结果

#### Scenario: 窗交框蹭到场景边缘不选中场景

- **WHEN** 从工作区空白从右往左拖一个与某块场景边缘相交、但不包住它的框
- **THEN** 该场景不进入结果，只有被框到的场景内容进入结果

#### Scenario: 从外面框住整块场景也不选中它

- **WHEN** 拖一个从左往右、完全包住某块场景的框
- **THEN** 该场景不进入结果，其被框住的后代进入结果

#### Scenario: 嵌套 Frame 保持既有排除规则

- **WHEN** 在一个嵌套 Frame 内部拖一个被它完全包住的框
- **THEN** 该嵌套 Frame 不进入结果
- **WHEN** 改为拖一个完全包住该嵌套 Frame 的框
- **THEN** 该嵌套 Frame 进入结果

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

在实体上按下 MUST 先把命中过一遍 Group 门槛解算（见「Group 命中先选组，双击穿过一层」），
再对解算出来的对象请求选区变更，随后按工具与目标状态决定这次按下的后续语义：解算报告为
**下钻**时只改选区并消费这次按下，MUST NOT 开始移动，也 MUST NOT 进入文字或几何编辑——那一下
的含义是「进到这一层」；select 工具下对可编辑目标的双击进入原地文字编辑且 MUST NOT 开始移动；
select 工具下对可几何编辑目标的双击进入几何编辑且 MUST NOT 开始移动；select/move 工具下未锁定
的目标开始移动；其余情形只改选区。

两种双击目标 MUST 由宿主注入的判定给出，引擎 MUST NOT 自己去读文档判断谁可编辑——它不认识
文档协议。文字可编辑 MUST 优先于几何可编辑：一次双击只能进一个会话。

选区变更 MUST 先于指针捕获发出——宿主据此更新选中态，顺序颠倒会让捕获落在旧选区上。

基准选区 MUST 滤掉已从文档中消失的 ID，否则 Shift 加选会把失效引用一路带进新选区。

无论是否开始移动，这次按下 MUST 被消费：选区已经改过了，再交给后续插件会让同一次按下既改
选区又起框。命中不存在的 Entity 时 MUST NOT 产生任何效果——命中判定与文档已经脱节。

#### Scenario: 按下即改选区并开始移动

- **WHEN** select 工具下在未锁定实体上按下
- **THEN** 先请求把选区改为该实体，再开始移动手势

#### Scenario: 单击 Group 的子级选中 Group 并拖动它

- **WHEN** 选区为空，select 工具下在 Group 的子级上按下
- **THEN** 先请求把选区改为最外层 Group，再开始移动 Group 的手势

#### Scenario: 双击穿过 Group 只改选区

- **WHEN** 选区是那个 Group，select 工具下在它的子级上双击
- **THEN** 请求把选区改为该子级，不开始移动，也不进入文字或几何编辑

#### Scenario: Shift 点击没进入的 Group 的子级加进的是 Group

- **WHEN** 用户 Shift 点击一个还没进入的 Group 的子级
- **THEN** 加进选区的是那个 Group

#### Scenario: 双击进入编辑而不拖动

- **WHEN** select 工具下双击一个可原地编辑的实体
- **THEN** 请求进入文字编辑，且不开始移动手势

#### Scenario: 双击曲线进入几何编辑

- **WHEN** select 工具下双击一个可几何编辑的未锁定实体
- **THEN** 请求进入几何编辑，且不开始移动手势

#### Scenario: 宿主没有注入几何判定

- **WHEN** 宿主没有传入几何可编辑判定，用户双击一个实体
- **THEN** 行为与今天完全一致，不请求进入几何编辑

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

### Requirement: 手势几何写入的精度上限

`toComposeTransform` 是 Stage 几何写回文档的唯一转换入口，它 MUST 把 position、size 与 rotation
量化到统一的几何精度（2 位小数）。

该量化的目的是掐掉浮点残渣：世界坐标由 `(屏幕 - 视口) / zoom` 得到，非整数 zoom 会留下
`82.96874999999991` 这类 14 位尾数，它既不是用户的输入也不是有意义的精度。对于父级缩放传导到
子级、旋转后的 AABB 这类**真正无法避免小数**的路径，量化 MUST 保证结果是一个确定的 2 位小数。

量化 MUST NOT 作用于布局求解结果：Yoga 解出的 box 与 Hug 的文字测量宽度本就是真实小数，
且不进入文档。

#### Scenario: 掐掉浮点残渣

- **WHEN** 一次手势得到的世界坐标为 `82.96874999999991`
- **THEN** 写进文档的值为 `82.97`

#### Scenario: 已经是整数的值不变

- **WHEN** 一次吸附后的手势得到的世界坐标为 `80`
- **THEN** 写进文档的值仍为 `80`，MUST NOT 变成 `80.00` 之类的字符串或引入误差

### Requirement: 曲线点选按距离而不是包围盒

带 `Curve` 的 Entity 在 `entityAtPoint` 中 MUST 按点到线段的距离与容差判定命中，MUST NOT
按盒包含判定——一条对角线的盒里绝大部分是空的。距离判定 MUST 在 Entity 局部坐标进行，
使旋转后的命中自动正确。容差 MUST 从屏幕像素按 zoom 换算成世界单位。

该 Entity 有**可见填充**（`Appearance.backgroundPaint` 为不透明纯色）时，距离判定不中的点
MUST 再按「点是否落在几何内部」判定一次：填色区域是用户看见的墨，与 DOM 路径 MUST 给出同一
结论。没有填充时 MUST NOT 做这一步——空心图形的内部正是「盒里绝大部分是空的」覆盖的情形。

填充判定 MUST 读 `Appearance` 而不是 Renderer props：命中路径读的字段必须是文档级契约。

宽相位（bounds 映射、框选候选、裁剪判定）MUST 保持按盒不变。

#### Scenario: 点击线附近选中

- **WHEN** 在容差范围内点击一条对角线的线身
- **THEN** 该曲线 Entity 被命中

#### Scenario: 盒内空角不选中

- **WHEN** 点击对角线包围盒内远离线身的空角
- **THEN** 该曲线 Entity 不被命中

#### Scenario: 非 100% 缩放下容差正确

- **WHEN** 在 zoom ≠ 1 下以同样的屏幕距离点击线附近
- **THEN** 命中结果与 100% 缩放一致

#### Scenario: 旋转后命中跟随几何

- **WHEN** Entity 带非零 `Transform.rotation` 时点击旋转后的线身
- **THEN** 命中正确，点击旋转前的原位置不命中

#### Scenario: 填充过的闭合几何内部命中

- **WHEN** 一个带不透明填充的闭合多段线，点击它内部远离任何边的位置
- **THEN** 该 Entity 被命中

#### Scenario: 未填充的同一几何内部不命中

- **WHEN** 同一条闭合多段线没有填充，点击同一位置
- **THEN** 该 Entity 不被命中

### Requirement: 特征点捕捉是独立于对齐吸附的查询

系统 MUST 提供在世界点附近求解**几何特征点**的查询，MUST NOT 把它并入既有的对齐吸附
候选查询——后者返回的是 `{ axis, value }` 的参考**线**，服务「与那个盒对齐」；特征点捕捉
返回的是一个二维**点**，服务「正好落在那条线的端点上」。

候选 MUST 只来自带 `Curve` 或带 `Ports` 的 Entity，MUST NOT 包含盒的角点与中心——盒角点正是
既有对齐吸附覆盖的语义，两套同时生效会在同一次取点里给出互相拉扯的答案。端口不在此列：它是
作者**显式写下**的点，而那条规则挡的是从盒**推**出来的点。

带 `Ports` 的 Entity MUST 把每个端口按该 Entity 的世界矩阵换算成一个 `port` 候选，与曲线
特征点共用同一个矩阵，MUST NOT 另算一遍。

曲线按 `kind` 分派：

- `line`：两端点与中点。
- `arc`：两端点、中点、**圆心**与落在扫掠范围内的**象限点**。圆心不是任何线段的端点，
  却是画同心圆、把符号钉在轴上时用户真正要对齐的点。
- `polyline`：各顶点即各段端点，各段中点即中点。MUST NOT 引入新的候选语义——多段线本来就是
  一串线段，展开是恒等变换。

**导线** MUST 额外产出一个 `nearest` 候选：查询点到该导线几何的**最近点**。它 MUST 只来自
导线，MUST NOT 对普通曲线产出——接到线身中间是接线特有的手势，而给每一条曲线都配一个「永远
命中」的候选会让端点在密集图上难以对准。最近点 MUST 与命中、框选走同一条投影链
（`projectComposeCurveToBox` → 世界矩阵），MUST NOT 另算一遍；弧按既有规则处理（等比精确、
非等比拍扁成多段线）。

**「是不是导线」MUST 由宿主注入谓词**，MUST NOT 只判 `Wire`。`Wire` 只记录「这一端绑到了哪个
端口」，两端都还没接上时根本不写这个 Component——而那正是一张图上最常见的状态（先画线、后接
符号）。这类导线在文档里唯一的身份是 `Composition.presetId`，而引擎不认识 Preset id，因此这条
判断与「一个 Entity 能不能几何编辑」走同一条既有边界。只判 `Wire` 的症状是「新画的导线接不上，
接过一次之后就能接了」，用户完全无从解释。

优先级 MUST 是 `port > endpoint > midpoint > center > quadrant > nearest`。**端口排在端点之前**
的理由是：端口几乎总是画在符号线段的端点上，端点若在同等距离下胜出，用户会画出一条像素级正确
但**没有绑定**的导线，而这个错误在屏幕上完全不可见。

**`nearest` MUST 排在最后。**它够得着整条线、因此只要指针在容差内就永远有答案；排在任何点状
候选之前会把端点、中点与圆心整个吞掉，而「把这个角对到那个端子上」正是画图时最常做的事。

**优先级 MUST 严格先于距离**：容差内同时存在高优先级与低优先级候选时结果是高优先级的那个，
即使低优先级的更近；同一优先级之内才按距离取最近。

容差 MUST 从屏幕像素按 zoom 换算成世界单位。**开着网格吸附时容差 MUST 再加上网格自己的够及
范围**（半条对角步长）。理由不是「靶区调大一点更好用」，而是：网格已经在把落点搬走，最远
就是这么远，因此把特征点的靶区扩大**同样的量**不引入任何用户尚未接受的位移。这条同时让靶区
与网格粗细联动——网格越粗、它的拽动越大、靶区也越大。**关掉网格吸附时 MUST 退回基数**，
一个像素都不多给；没有这一条，它就退化成「把靶区一律调大了」。

查询 MUST 支持**点级排除**：调用方给出一个世界点，落在它上面的候选 MUST NOT 参与。这是为
「正在被拖的那个顶点不能把自己吸回原处」准备的——排除的理由只对**那一个点**成立，做成
Entity 级会把同一个对象的其他顶点与中点一起收走，而那些正是用户最常要对齐的目标。

#### Scenario: 端口优先于端点

- **WHEN** 一个端口与一条曲线的端点都在容差内，且端点更近
- **THEN** 结果是端口

#### Scenario: 端点优先于中点

- **WHEN** 端点与中点都在容差内且中点更近
- **THEN** 结果仍是端点

#### Scenario: 同一优先级内取最近

- **WHEN** 两个端点都在容差内
- **THEN** 结果是较近的那个

#### Scenario: 容差随缩放换算

- **WHEN** 在不同 zoom 下以相同的屏幕距离靠近同一个端点
- **THEN** 命中与否的结果一致

#### Scenario: 容差随网格步长放大

- **WHEN** 开着网格吸附，指针离某个端点的距离超出基础靶区但在网格的够及范围之内
- **THEN** 结果仍是该端点，而不是被网格拽到最近的格点
- **AND** 关掉网格吸附后同一距离不再命中

#### Scenario: 点级排除只收走那一个点

- **WHEN** 以某条多段线的一个顶点作为排除点求解，指针靠近该顶点
- **THEN** 该顶点不作为候选返回
- **AND** 同一条多段线的其他顶点与各段中点仍然可以命中

#### Scenario: 不返回盒的角点

- **WHEN** 在一个矩形 Entity 的角点附近求解特征点
- **THEN** 该角点不作为候选返回

#### Scenario: 弧提供圆心与象限点

- **WHEN** 在一段弧的圆心或某个落在扫掠范围内的象限点附近求解
- **THEN** 该点作为候选返回

#### Scenario: 线身中间返回最近点

- **WHEN** 在一条导线两个顶点之间的线身附近求解，且不靠近任何顶点或中点
- **THEN** 返回 `nearest` 候选，落点是该导线上离查询点最近的那个点

#### Scenario: 端点压过最近点

- **WHEN** 一条导线的端点与它线身上的最近点都在容差内，且最近点更近
- **THEN** 结果是端点

#### Scenario: 普通曲线不产出最近点

- **WHEN** 在一条不带 `Wire` 的曲线线身附近求解，且不靠近任何顶点或中点
- **THEN** 没有候选返回

#### Scenario: 两端都没接过的导线同样产出最近点

- **WHEN** 一条刚画完、两端都还没接上（因此没有 `Wire`）的导线，宿主的谓词判定它是导线
- **THEN** 它的线身照常产出 `nearest` 候选

### Requirement: 绘图命令复用泛型命令引擎

绘图命令 MUST 复用 `@compose-ui/commands` 的命令定义、别名解析与四态推进
（`prompt` / `commit` / `cancelled` / `rejected`），MUST NOT 另实现一套命令会话。
Stage 侧只声明自己的上下文与效果类型。

`LINE`（别名 `L`）MUST 连续画线：每取到一个新点即产出一段已落地的线，会话继续等待下一点，
直到用户显式结束。非法输入 MUST 以 `rejected` 表达且 MUST NOT 结束会话——点错、打错关键字
在这类工具里是常态，结束命令会让用户从头再来。

**连续取点的命令（`LINE` 与 `PLINE`）的「下一点」提示 MUST 说明回车结束。**AutoCAD 的提示
不写这一句，因为它的用户知道；本产品的用户不知道，而命令行是这条能力唯一的说明书。结束
MUST NOT 做成关键字：那会与「空 Enter 即 accept」形成同一件事的第二个入口。

取够点自己就提交的命令（`RECTANGLE` / `CIRCLE` / `ARC` / `ARROW`）MUST NOT 带这句提示——
它们没有「怎么结束」这个问题。

**产出几何的命令 MUST 实现 `preview(point)`**，返回「这一步如果落在那里」的效果，其中含**到
目前为止加上这个候选点**的完整几何。`PLINE` 取过三点时 MUST 返回四个顶点而不是最后那一段，
`RECTANGLE` MUST 返回闭合四顶点而不是对角线，`CIRCLE` MUST 返回整圆而不是半径线。

形状 MUST 由会话给出而 MUST NOT 由宿主推导：两个对角点怎么变四个顶点、圆心加半径点怎么变整圆
只有命令知道，让宿主算等于让它认识每一条命令。

不产出几何的命令（`MOVE` / `COPY` / `ERASE` / `VERTEX`）MUST NOT 实现它——它们那一步没有形状
可言，位移由橡皮筋表达。

命令集 MUST 另含 `ARC`、`CIRCLE`、`REC`、`PLINE` 与 `ARROW`：

- `ARC` 取起点、途经点与终点；三点共线时 MUST 以 `rejected` 表达且 MUST NOT 结束会话。
- `CIRCLE` 取圆心与半径点，产出扫掠为 360 的弧。
- `REC` 取两个对角点，产出四顶点的闭合多段线。
- `PLINE` 连续取点，但 MUST 攒成**一个** Entity 在结束时提交——这正是它与 `LINE` 存在差别的
  理由。因此 `PLINE` MUST 提供「放弃上一点」关键字而 `LINE` MUST NOT：`LINE` 的放弃等于一次
  文档撤销，`PLINE` 的还在会话里。
- `ARROW`（别名 `AR`）取两个点，产出一条带终点箭头的曲线。它 MUST 取两点就结束而 MUST NOT
  像 `LINE` 那样连着画：**一支箭头只有一个头**，连着画会得到一串各自带头的箭头，而那不是
  任何人启动这条命令时想要的东西。

两点会话工厂 MUST 只剩 `ARROW` 一个消费者，其上的 `wire` 标记 MUST 删除：合并之后没有第二种
线可分，恒为真的标记会让读代码的人以为还存在另一种情形。工厂本身 MUST 保留——「只有一个
消费者」在本仓库不是把抽象折回去的理由。

引擎 MUST NOT 认识 Renderer props 或 Preset id：`ARROW` 只在效果上给出「这是一支箭头」的
标记，由持有 Registry 的宿主挑那个带终点箭头的 Preset。

`PLINE` 被取消时 MUST 什么都不提交。这一条 MUST NOT 因为「代价太大」而改成提交：`Escape` 的
含义是放弃这条命令，而画错一半想扔掉比画完更常见；代价可接受的前提是**结束容易**，那由回车、
右键与提示里的那句话共同承担。

#### Scenario: 连续画线逐段落地

- **WHEN** 启动 `LINE` 后依次取三个点
- **THEN** 产出两段线，且会话在第三点之后仍在等待下一点

#### Scenario: 非法输入不结束会话

- **WHEN** 命令进行中键入既不是坐标也不是关键字的文本
- **THEN** 会话给出被拒绝的说明并停在原提示

#### Scenario: 显式结束

- **WHEN** 用户在命令进行中中止
- **THEN** 会话结束，已落地的线段保留

#### Scenario: 多段线攒成一个 Entity

- **WHEN** 启动 `PLINE` 后依次取四个点并结束
- **THEN** 只产出一个 Entity，其几何含四个顶点

#### Scenario: 多段线可放弃上一点

- **WHEN** `PLINE` 取到第三点后键入放弃关键字
- **THEN** 顶点回到两个，会话继续等待下一点，且此时尚未产生任何文档事务

#### Scenario: 三点共线的弧被拒绝

- **WHEN** `ARC` 的三个点共线
- **THEN** 会话给出被拒绝的说明并停在原提示

#### Scenario: 矩形产出闭合多段线

- **WHEN** `RECTANGLE` 取够两个对角点
- **THEN** 提交效果里有一条 `curves` 项，它是 `closed` 为 true 的四顶点多段线

#### Scenario: 矩形不产出盒

- **WHEN** 查阅任何一条绘图命令的提交效果
- **THEN** 效果类型上没有盒这一路——`StageDraftingEffect` 不再有 `boxes` 字段

#### Scenario: 退化矩形被拒绝

- **WHEN** `RECTANGLE` 的第二个角点与第一个角点在某一个轴上重合
- **THEN** 会话给出被拒绝的说明并停在原提示，MUST NOT 提交一条退化多段线

#### Scenario: 箭头取两点即结束

- **WHEN** 启动 `ARROW` 后取两个点
- **THEN** 产出一条带终点箭头的曲线，且会话结束

#### Scenario: 连续取点的提示说出怎么结束

- **WHEN** `PLINE` 取到第一个点
- **THEN** 提示在「指定下一点」之外说明回车结束

#### Scenario: 预览含已取的全部点

- **WHEN** `PLINE` 取过三个点后以第四个候选点查询 `preview`
- **THEN** 返回的几何有四个顶点

#### Scenario: 预览是形状而不是橡皮筋

- **WHEN** `RECTANGLE` 取过一个角点后以对角候选点查询 `preview`
- **THEN** 返回的几何是闭合的四顶点多段线

#### Scenario: 查询不推进会话

- **WHEN** 对同一条会话连续查询 `preview` 若干次
- **THEN** 会话的提示与随后 `advance` 的结果与从未查询过时完全一致

### Requirement: 取点接管排在画布平移之下

绘图命令进行中，取点 MUST 接管指针按下，且 MUST 在任何命中类型上接管——命令进行中点到一个
已有 Entity，用户的意图是「在那里取一个点」而不是「选中它」。

取点的优先级 MUST 低于画布平移：命令进行中仍然要能平移画布去看远处的目标点。

#### Scenario: 取点接管落在已有对象上的点击

- **WHEN** 命令进行中点击一个已有 Entity
- **THEN** 该点被命令消费，选择集不变

#### Scenario: 平移仍然可用

- **WHEN** 命令进行中触发画布平移
- **THEN** 平移生效，命令停在原提示

### Requirement: 绘图模式提供对象编辑命令

绘图命令集 MUST 包含 `MOVE`（别名 `M`）、`COPY`（别名 `CO`）、`ERASE`（别名 `E`）与
`TRIM`（别名 `TR`），四条命令 MUST 复用 `@compose-ui/commands` 的四态推进，MUST NOT 另实现
一套命令会话。

`MOVE` 与 `COPY` MUST 共用同一条「取对象 → 取基点 → 取位移点」状态机，唯一差别是放下一个
落点之后 `MOVE` 收束、`COPY` 以 `prompt` 携带 `commit` 继续等下一个落点。`COPY` 连续放置时
位移 MUST 始终以**最初的基点**为起点，MUST NOT 改用上一个副本的落点。

`MOVE` / `COPY` / `ERASE` MUST 支持「先选后执行」：启动上下文里已有选择集时跳过选择步骤；
`ERASE` 在这种情形下 MUST 以 `null` 提示表达「没有要等的输入」，由宿主立刻推进。`TRIM` 不在
其列：它不消费选择集（见「TRIM 命令去掉光标底下的一截」）。

#### Scenario: MOVE 取三步之后产出位移

- **WHEN** 启动 `MOVE`，依次给出一批对象、一个基点与一个位移点
- **THEN** 产出一次针对这批对象的位移，且会话结束

#### Scenario: COPY 连续放置

- **WHEN** 启动 `COPY` 取基点后连续给出两个落点
- **THEN** 产出两份副本，两份的位移都相对最初的基点，且会话在第二个落点之后仍在等待

#### Scenario: 先选后执行的 ERASE 无需等待输入

- **WHEN** 启动上下文里已有选择集时启动 `ERASE`
- **THEN** 会话的提示为 `null`

#### Scenario: 没有对象时取消

- **WHEN** 在选择步骤直接确认且一个对象都没有
- **THEN** 会话取消，不产出任何变更

#### Scenario: TRIM 不消费选择集

- **WHEN** 启动上下文里已有选择集时启动 `TRIM`
- **THEN** 会话的第一步提示仍然等待 `pick`，选择集不变

### Requirement: 绘图命令的选择集输入是替换而不是并入

绘图命令会话收到 `selection` 输入时 MUST 用它**替换**自己记住的目标集合，MUST NOT 并入。

选择集在 Stage 中已经存在且归宿主所有（选中框、属性面板、场景树联动、Esc 清空都读它）。
会话再攒一份会在移出操作上分叉：宿主那份少了两个，会话那份仍是三个，用户看着两个对象
被移出而命令仍然作用在三个上。

#### Scenario: 后一次选择覆盖前一次

- **WHEN** 会话先后收到两批不同的对象标识
- **THEN** 命令作用的目标是后一批

#### Scenario: 收到空选择后确认即取消

- **WHEN** 会话收到空的选择集后确认
- **THEN** 会话取消，不产出任何变更

### Requirement: 选择语义按上下文标记分流

`StageInteractionContext` MUST 提供 `selectionMode`，取值 `'replace'`（默认）与 `'accumulate'`。
点选与框选两条路径 MUST 读同一个标记，MUST NOT 各自判断模式。

- `'replace'`：无修饰键点击换成命中的那一个，Shift 点击切换；无修饰键框选换成框内，Shift 框选并入。
- `'accumulate'`：无修饰键点击**加入**，Shift 点击**移出**；无修饰键框选**并入**，Shift 框选**移出**。

`'accumulate'` 下的顺序 MUST 按首次加入的先后保持稳定——选择集会喂给命令，而命令把它当作
一个序列。

#### Scenario: 累加模式下点击第二个对象不丢掉第一个

- **WHEN** `selectionMode` 为 `'accumulate'` 时依次点击两个 Entity
- **THEN** 两个都在选择集里

#### Scenario: 累加模式下 Shift 点击移出

- **WHEN** `selectionMode` 为 `'accumulate'` 时 Shift 点击一个已在选择集中的 Entity
- **THEN** 该 Entity 被移出，其余不变

#### Scenario: 默认仍是页面语义

- **WHEN** 未指定 `selectionMode` 时依次点击两个 Entity
- **THEN** 只有后点的那个在选择集里

#### Scenario: 框选读同一个标记

- **WHEN** `selectionMode` 为 `'accumulate'` 时在已有选择集之上无修饰键框选
- **THEN** 框中的对象并入原选择集

### Requirement: 编辑命令与拖动手势共用提交漏斗

`MOVE` 提交 MUST 走与拖动、resize、rotate 相同的几何提交漏斗，产出**一条**变换命令，
因此多选移动 MUST 只占一步撤销。

`MOVE` MUST NOT 复用拖动预览的激活阈值、平移吸附与落点解析：基点与位移点已经各自经过点输入
管线，再吸附一次会改写键入的坐标；落点解析会把纯平移变成跨父级重挂载。

#### Scenario: 多选移动只占一步撤销

- **WHEN** 用 `MOVE` 同时移动三个对象后撤销一次
- **THEN** 三个对象全部回到原位

#### Scenario: 键入位移不被吸附改写

- **WHEN** 网格吸附开启时用键入的相对坐标给出位移
- **THEN** 对象正好位移这个量

#### Scenario: 小位移仍然生效

- **WHEN** 给出的位移小于拖动手势的激活阈值
- **THEN** 位移照样提交

### Requirement: 复制命令的落点偏移可配置

`createDuplicateCommand` 对同父级绝对定位根节点施加的固定偏移 MUST 可由调用方覆盖，
默认值 MUST 保持不变。

固定偏移的语义是「复制一份别正好盖住原件」；`COPY` 有真实位移，叠加固定偏移会让每一个副本
都错开一个常量。

#### Scenario: 调用方给出偏移

- **WHEN** 以显式偏移复制一个绝对定位 Entity
- **THEN** 副本落在原位置加该偏移处

#### Scenario: 缺省行为不变

- **WHEN** 不给偏移复制一个绝对定位 Entity
- **THEN** 副本落在原来的默认错开位置

### Requirement: 局部矩阵与分解按 Entity 自身的旋转基点

把 (盒, 旋转) 合成为局部矩阵、以及把矩阵分解回 (盒, 旋转) 的这**一对互逆函数** MUST 都按
Entity 自身的旋转基点计算，MUST NOT 写死盒中心。

两者 MUST 保持互逆：对任意基点，分解合成出的矩阵 MUST 还原出原始的盒与旋转。手势的每一次
预览与提交都要走一个来回，只改其中一个或某个调用点漏传基点，症状是**提交后对象跳一下**，
位移量等于基点偏移，且只在非中心基点的对象上出现。

未设基点的 Entity MUST 与本变更之前产出完全相同的矩阵。

#### Scenario: 非中心基点下合成与分解互逆

- **WHEN** 对一个基点不在中心的盒合成局部矩阵后再分解
- **THEN** 还原出的位置、尺寸与旋转与原值一致

#### Scenario: 基点决定旋转中心

- **WHEN** 一个盒的基点位于左边中点且旋转 90 度
- **THEN** 该左边中点在旋转前后的位置不变

#### Scenario: 未设基点的结果不变

- **WHEN** 对没有基点的盒合成局部矩阵
- **THEN** 结果与绕盒中心旋转一致

### Requirement: 组件提取搬运动画清单

`createComponentExtractionPlan` MUST 把源文档中**至少有一条轨道落在被提取实体上**的动画清单
条目复制到新组件根的 `Animations.items` 上。清单条目的 `id` MUST 逐字保留——轨道按动画 id
分组（`Animation.clips[animationId]`），换 id 会让刚提取出来的轨道全部变成悬空分组，而这不会
被任何校验拒绝，只表现为时间线上什么都不动。

提取器 MUST 复制而不是搬运：源文档的清单条目 MUST 原样留下，源文档 MUST NOT 被修改。
与被提取实体无关的动画 MUST NOT 出现在组件文档里。

复制的条目 MUST 丢弃 `bindings`；组件根的 `Animations.source` MUST 缺席。

提取器 MUST NOT 通过修改 `promoteComposeEntityToFrame` 实现本要求——升格只做一件事，
它还有别的调用方，那些调用方没有源清单可搬。

#### Scenario: 动画 id 与轨道分组键一致

- **WHEN** 用户把一个带旋转关键帧的容器创建为组件
- **THEN** 组件根 `Animations.items` 中该条目的 id 等于其子级 `Animation.clips` 的键
- **AND** 关键帧的时间、值、插值与空间切线逐字段不变

#### Scenario: 部分选区不破坏留下的轨道

- **WHEN** 一条动画同时给 A 与 B 打了关键帧，用户只把 A 创建为组件
- **THEN** 组件里的这条动画只含 A 的轨道
- **AND** 源文档的清单条目仍在，B 的轨道未被修改

#### Scenario: 无关动画不进组件

- **WHEN** 页面上另有一条只给未被提取的实体打点的动画
- **THEN** 该动画不出现在组件文档的清单里

#### Scenario: 不携带文件引用与页面绑定

- **WHEN** 源 Frame 的 `Animations` 带有 `source`，且被复制的动画带有 `bindings`
- **THEN** 组件根的 `Animations` 不含 `source`，被复制的条目不含 `bindings`

### Requirement: 工具集只保留没有别的入口的动作

`StageInteractionTool` MUST 只包含 `select`、`scale`、`rotate` 与各 `draw-*` 绘制工具。
`marquee`、`move`、`pan` 与 `draw-line` 四个值 MUST NOT 存在——它们各自都有严格不弱的既有
入口，留着会让同一个动作有两个不同手感的触发方式。

`pan` 手势插件 MUST 保留，认领条件收缩为「临时平移覆盖或中键」，优先级不变；它是随时可用的
临时覆盖而不是一个要先选中的工具。

`marquee` 与 `move-axis` 两条依赖对应工具值的插件 MUST 随工具值一起退场；空白处拖拽的框选
由 `select` 承担。

#### Scenario: 工具联合不含四个已删值

- **WHEN** 消费方穷举 `StageInteractionTool`
- **THEN** 其中没有 `marquee`、`move`、`pan` 与 `draw-line`

#### Scenario: 中键仍然平移

- **WHEN** 用户按下中键并拖动
- **THEN** 视口平移

#### Scenario: select 空白拖拽仍然框选

- **WHEN** 当前工具是 `select`，用户从空白处按下并拖动
- **THEN** 起一次框选手势

### Requirement: 命中与捕捉应用同一个盒到几何的变换

曲线的距离命中与特征点捕捉 MUST 应用盒 → 几何的同一个变换，MUST NOT 直接拿文档里的几何数值
与世界坐标比较：盒一旦不等于紧包围盒，两者就不在同一个坐标系里，症状是「画出来的和点得中的
不在一处」。

判定 MUST 在世界空间完成——把**几何**变换到世界，容差保持 `屏幕像素 / 缩放`。MUST NOT 反过来
把光标点变换进几何空间：非等比缩放会把圆形容差变成椭圆，距离比较不再是标量，而这个错误只在
扁盒上现形。

弧 MUST 按缩放是否**等比**分流：等比（含镜像）仍用闭式解，非等比拍扁成线段。MUST NOT 按某一
轴的比例硬算成圆——那会得到一个用户从未画过的形状；也 MUST NOT 一律拍扁——圆心与象限点不是
任何线段的特征点，拍扁会让它们消失。

#### Scenario: 拉宽后的曲线按新形状命中

- **WHEN** 把一条斜线的盒拉宽到两倍，再点在新形状的线身上
- **THEN** 命中该曲线

#### Scenario: 旧几何的位置不再命中

- **WHEN** 点在拉宽前那条线经过、拉宽后已不经过的位置
- **THEN** 不命中该曲线

#### Scenario: 特征点跟着几何走

- **WHEN** 把一条直线的盒拉宽到两倍后向它的端点取点
- **THEN** 捕捉到的是新形状的端点

#### Scenario: 非等比盒里的弧仍可命中

- **WHEN** 把一段弧的盒拉成宽扁形状，再点在弧上
- **THEN** 命中该曲线，且圆心仍是可捕捉的特征点

### Requirement: 曲线夹点派生与顶点编辑求解

`@compose-ui/stage-engine` MUST 提供两个纯函数：由 Entity 派生**世界坐标夹点**，以及把一个
落点应用到某个夹点上得到新的 `ComposeCurve`。两者 MUST NOT 修改文档，也 MUST NOT 派发命令。

夹点 MUST 按 `Curve.kind` 派生：`line` 出两个端点与一个**中点**；`polyline` 出全部顶点**加上
每一段的中点**；`arc` 出圆心、起点、终点与中点。**`|sweep|` 为 360 的整圆 MUST 只出圆心与中点**——它的起点
与终点落在同一位置，两个含义不同的夹点叠在一起时用户拖到哪个全凭渲染顺序，而「改整圆的起始
角」在屏幕上看不见。

**段中点夹点 MUST 平移它所在的那一段**：该段的两个端点同时移动同一位移。位移 MUST 按
**中点到落点**算，因此落点被捕捉纠正之后段中点精确落在那个特征点上；按指针裸坐标算会让段
中点停在离目标几个像素的地方，而用户瞄的正是那个点。

这一条对两种 kind 是**同一句话**：两点直线只有一段，因此「平移那一段」就是「平移整条线」，
长度与方向不变；多段线的相邻段共用端点，因此它们自动跟着伸缩，而顶点数 MUST 不变。直线那条
规则是这条的**退化情形**，MUST NOT 被写成两条。

它 MUST 与端点夹点走同一条落点解算，因此被捕捉的是**中点本身**。这正是它相对「拖线身」的
独有能力，而且两者作用的对象也不同：拖线身移动的是**整个 Entity**，走对齐吸附
（`{axis, value}` 参考线，两轴各自独立）；拖段中点移动的是**一段**，走特征点捕捉（二维点，
带优先级与捕捉标记）。

平移夹点的 id MUST NOT 与弧的半径夹点同名：同一个字符串在两种 kind 上含义相反会让读代码的人
绊一下，而 id 本来就是 per-kind 解释的，自解释不花钱。

闭合多段线的段 MUST 包含收尾那一段（最后一个顶点连回第一个）：它在屏幕上与其他段没有任何
区别，漏掉它会让一条闭合折线上恰好少一个可抓的位置，而用户看不出为什么。

段中点夹点的 id MUST 与顶点 id 用不同前缀：求解要按 id 分派到两种完全不同的操作（移动一个
既有顶点 / 平移一整段），而它手上只有 id。

**在段中点插入一个新顶点 MUST NOT 做成默认拖动动作。**它的正当位置是夹点的悬停多功能菜单
（AutoCAD 就在那里）；塞进默认拖动会占掉段平移的位置，而段平移在本产品里**没有任何别的
入口**——拖线身移动的是整个 Entity。加错顶点还能撤销，段平移做不到就是做不到。

夹点 MUST 与命中、捕捉应用**同一个盒到几何的变换**，否则拉宽之后夹点会停在旧位置。

夹点 MUST NOT 与特征点捕捉的候选合并：特征点是捕捉目标（含弧的象限点与各段中点），夹点是
可拖的把手。象限点不是弧的自由度，合并会让它变成能拖的东西。

弧的每个夹点 MUST 只改一个自由度，另一端 MUST 一动不动：圆心平移整条弧；起点改起始角并同步
调整扫掠角使终止角不变；终点只改扫掠角；中点只改半径。扫掠角的符号 MUST 保持不变，差角
MUST 归一化到同号的 `(0, 360]`；恰好归一化到 0 时 MUST 取 360——用户把终点拖回起点，看得见的
结果是整圆，而空弧什么都画不出来。

#### Scenario: 逐 kind 的夹点集

- **WHEN** 派生一条两点直线、一条三顶点开放多段线与一段 90 度弧的夹点
- **THEN** 分别得到 3 个、5 个与 4 个夹点
- **AND** 直线的三个夹点是起点、终点与中点
- **AND** 多段线的五个是三个顶点加两段的中点
- **AND** 弧的四个夹点是圆心、起点、终点与中点

#### Scenario: 闭合多段线的收尾段也有中点

- **WHEN** 派生一条四顶点闭合多段线的夹点
- **THEN** 得到 4 个顶点夹点与 4 个段中点夹点

#### Scenario: 拖直线的中点整条线搬走

- **WHEN** 把一条直线的中点夹点拖到别处
- **THEN** 两个端点各自移动同一位移，线的长度与方向都不变
- **AND** 新的中点落在拖到的那个点上

#### Scenario: 拖多段线的段中点只搬那一段

- **WHEN** 把一条三顶点多段线第一段的中点夹点拖到别处
- **THEN** 顶点数不变，该段的两个端点各自移动同一位移
- **AND** 不属于该段的顶点一动不动

#### Scenario: 整圆只出两个夹点

- **WHEN** 派生一条 `sweep` 为 360 的弧的夹点
- **THEN** 只得到圆心与中点两个

#### Scenario: 拖弧的终点另一端不动

- **WHEN** 把一段弧的终点夹点拖到别处
- **THEN** 新弧的圆心、半径与起始角都不变，只有扫掠角变了

#### Scenario: 终点拖回起点得到整圆

- **WHEN** 把一段弧的终点夹点拖到与起点重合
- **THEN** 新弧的 `|sweep|` 是 360 而不是 0

#### Scenario: 夹点跟着盒的缩放走

- **WHEN** 一条曲线的盒被非等比拉宽后再派生夹点
- **THEN** 夹点落在画出来的那条线上，与命中、捕捉读到的位置一致

夹点 MUST 带上**呈现角色**（移动一个点 / 平移一整段）与可选的**方向角**，由派生这一侧
给出。**段中点 MUST 画成沿段方向的条形**，包括两点直线的那一个——它做的事与两个端点完全不同，
形状一样就等于没有说出这件事。AutoCAD 的 LINE 三个夹点都是方块，这里是**有意偏离**：它的
用户有悬停提示与状态栏，我们没有，形状是我们唯一能说这句话的地方。

弧的圆心 MUST 仍是方块：它平移的是整条弧，但它不是任何段的中点，也没有方向可言——条形要一个
角度才立得住。方向角 MUST NOT 由渲染层从邻居推算：渲染层拿到的是一串扁平顶点，它不知道谁和谁相邻，
更不知道闭合多段线的收尾段接的是第一个顶点，让它猜等于把多段线的结构知识复制进渲染层。

角度是**世界角度**，而 Stage 的视口只有平移与缩放、没有旋转，因此它等于屏幕角度。这一条写
下来是因为将来若给视口加了旋转，这里会静默错位。

### Requirement: 双击进入几何编辑不被盒手柄挡住

引擎 MUST 让双击进入几何编辑不被盒手柄挡住：命中 Resize 手柄或边缘命中区时，若这次按下是
双击、工具是 select、且选区恰好是一个可几何编辑的 Entity，MUST 请求进入几何编辑而不是开始
缩放手势。

这不是顺手加的分支：一条水平线的包围盒高度接近零，上下两条边缘命中区把整条线盖住，双击
**永远**打不到实体本身——而轴对齐的线正是最需要几何编辑的那一类。双击手柄本来也没有别的语义。

#### Scenario: 双击盖住线身的边缘命中区

- **WHEN** 一条水平曲线已被选中，用户在盖住线身的边缘命中区上双击
- **THEN** 请求进入几何编辑，不开始缩放手势

#### Scenario: 单击手柄仍然缩放

- **WHEN** 用户单击同一个命中区并拖动
- **THEN** 照常开始缩放手势

### Requirement: 夹点取点会话

`@compose-ui/stage-engine` MUST 提供一条**一点**的夹点取点会话，由目标 Entity、夹点 id 与
该夹点的原位置启动，取到一个点即提交一条曲线几何变更。它 MUST 复用
`@compose-ui/commands` 的命令定义与四态推进（`prompt` / `commit` / `cancelled` / `rejected`），
MUST NOT 另实现一套命令会话——这与绘图命令那条约束是同一条。

会话产出的效果 MUST 经既有的编辑规划入口落成普通文档命令，MUST NOT 由会话自己派发：
拖夹点、点亮后取点与点亮后键入坐标三条路径 MUST 汇到**同一条** `entity.curve.set`，
撤销粒度因此对三者相同。

落点应用到几何 MUST 复用既有的「把一个落点应用到某个夹点」纯函数，MUST NOT 为键盘那条路径
另写一份曲线数学。

该会话 MUST NOT 注册进命令词汇表：它由手势启动而不由词启动，注册一个只有在夹点点亮时才活
的词，只会让命令面板多出一条用户敲不动的项。这不与「命令行只认一份词汇表」冲突——那条约束
的对象是**动作**，而本会话是一个手势的中间态。

#### Scenario: 取到一个点即提交

- **WHEN** 以某条直线的端点夹点启动会话，并推进一个点
- **THEN** 会话以提交结束，效果描述该端点移动到该点后的新几何

#### Scenario: 取消不产出任何效果

- **WHEN** 会话进行中被取消
- **THEN** 会话以取消结束，不产出任何文档变更

#### Scenario: 与拖动共用同一条几何求解

- **WHEN** 对同一个夹点分别用拖动与会话取点给出同一个落点
- **THEN** 两条路径算出的新 `ComposeCurve` 逐字相同

### Requirement: VERTEX 命令进入几何编辑

绘图命令集 MUST 包含 `VERTEX`（别名 `VE`），产出「让某个 Entity 进入几何编辑」的效果。
命令 MUST 复用与 `ERASE` 同一条**两次序共用**的状态机：启动上下文里已经选好目标就当场提交，
没选好就提示选择对象并消费宿主喂进来的选择集。

几何编辑是**单对象作用域**，因此候选不是恰好一个时 MUST 以 `rejected` 表达并停在原提示，
MUST NOT 什么都不做。命令行的三种拒绝必须互相可分，而「敲了没反应」与敲错字在屏幕上无法
区分。

引擎 MUST NOT 自己判断一个 Entity 能不能几何编辑：那要读文档，而本包的命令层不认识文档。
判据 MUST 由启动上下文以**谓词**注入，缺席时视为全部可编辑。

`VERTEX` MUST NOT 取代双击：两个入口 MUST 产出同一个会话，MUST NOT 各自维护一份状态。

#### Scenario: 已选好一个曲线时当场进入

- **WHEN** 选中一条曲线后启动 `VERTEX`
- **THEN** 命令立即提交，效果指向该 Entity 进入几何编辑

#### Scenario: 没选对象时提示选择

- **WHEN** 选择集为空时启动 `VERTEX`
- **THEN** 会话提示选择对象，并在宿主喂入选择集后可以确认

#### Scenario: 选中多个时被拒绝而不是静默

- **WHEN** 选中两条曲线并确认
- **THEN** 会话给出被拒绝的说明并停在原提示

#### Scenario: 不可几何编辑的对象被谓词挡掉

- **WHEN** 启动上下文注入的谓词判定选中项不可几何编辑
- **THEN** 会话不提交，而是提示选择对象

### Requirement: 连续取点命令的闭合关键字

`LINE` 与 `PLINE` MUST 各提供一个 `C` 闭合关键字，语义都是「回到第一个点并结束」，
但机制随各自的落地方式不同：

- `LINE` 逐段落地，因此 `C` MUST 再产出**一段**从当前点回到第一个点的线，然后结束会话。
- `PLINE` 攒到结束才提交，因此 `C` MUST 把 `closed` 置为 `true` 并提交那一个 Entity。

**闭合本身就是结束信号**，两条命令在 `C` 之后 MUST NOT 再等下一个点。

关键字 MUST 只在**够得着闭合**时出现在提示里：`LINE` 至少取过两个点、`PLINE` 至少取过三个
顶点。不够时列出它等于让用户看见一个按下去只会被拒绝的选项。

顶点全部重合这类退化情形 MUST 与既有的结束路径同样处理（什么都不提交），MUST NOT 因为走了
`C` 而绕过退化判定。

#### Scenario: LINE 闭合补上收尾那一段

- **WHEN** `LINE` 依次取三个点后键入 `C`
- **THEN** 产出的线段共四段，最后一段从第三点回到第一点
- **AND** 会话结束

#### Scenario: PLINE 闭合置位并提交

- **WHEN** `PLINE` 依次取三个点后键入 `C`
- **THEN** 只产出一个 Entity，其 `Curve` 的 `closed` 为 true，顶点仍是三个
- **AND** 会话结束

#### Scenario: 顶点不够时没有闭合关键字

- **WHEN** `PLINE` 只取过两个点
- **THEN** 提示里没有闭合关键字
- **WHEN** 此时仍然键入 `C`
- **THEN** 会话给出被拒绝的说明并停在原提示

### Requirement: 单键快捷键同时是命令别名

绑给一条绘图命令的单键快捷键 MUST 同时出现在该命令的 `aliases` 里：用户只记一套词，
按 `P` 与敲 `P↵` MUST 指向同一条命令。

因此 `PLINE` MUST 含别名 `P`、`RECTANGLE` MUST 含 `R`、`WIRE` MUST 含 `W`、
`ARROW` MUST 含 `X`；`LINE` 的 `L`、`CIRCLE` 的 `C`、`ARC` 的 `A` 已经成立。

反向不成立：多字母别名（`WI`、`AR`、`REC`、`PL`）MUST NOT 因此被要求有对应的快捷键。

#### Scenario: 单字母别名解析到命令

- **WHEN** 以 `P`、`R`、`W`、`X` 逐一查询命令注册表
- **THEN** 分别解析出 `PLINE`、`RECTANGLE`、`WIRE`、`ARROW`

#### Scenario: 多字母别名仍然可用

- **WHEN** 以 `REC` 查询命令注册表
- **THEN** 解析出 `RECTANGLE`

### Requirement: LINE 的放弃上一段

`LINE` MUST 提供 `U` 关键字：回退一个已取的点，并让宿主删掉由那一段产生的 Entity。

关键字 MUST 只在**有段可退**时出现在提示里（至少取过两个点）。回退到只剩一个点时提示 MUST
回到「指定下一点」但不再列出 `U`；回退到一个点都不剩 MUST 不发生——第一个点没有对应的段。

会话 MUST 只回退**自己的点序列**，文档由宿主删。这与 `PLINE` 的 `U` 机制不同而同名：
`PLINE` 逐点攒着，此刻文档上什么都还没有，因此它的 `U` 只动会话。两处的注释 MUST 各自写明
这一点，否则下一个人会试图合并它们。

#### Scenario: 放弃上一段并回退参考点

- **WHEN** `LINE` 依次取三个点后键入 `U`
- **THEN** 会话回到第二个点，效果里带上「删掉上一个建出来的 Entity」
- **AND** 会话继续等待下一点

#### Scenario: 只取过一个点时没有 U

- **WHEN** `LINE` 只取过一个点
- **THEN** 提示里没有 `U`，键入它被拒绝

### Requirement: CIRCLE 在半径与直径之间切换

`CIRCLE` 取过圆心之后 MUST 提供 `D`（直径）与 `R`（半径）两个关键字，在两种量之间切换。
处于半径档时 MUST 只列出 `D`，处于直径档时 MUST 只列出 `R`——列一个按下去只会把当前状态
再确认一遍的关键字，等于给用户一个没有效果的选项。

切换 MUST 一次改三样：提示文本、这一步的 `fields`（`radius` ↔ `diameter`）与列出的关键字。
少改任何一样，屏幕上都会出现两句互相矛盾的话。

切换 MUST 只作用于**本次会话**，MUST NOT 跨命令记忆。AutoCAD 记住上一次的选择，代价是这条
命令有了一份看不见的状态：用户过两天回来，同一条命令问的问题变了，而屏幕上没有任何东西解释
为什么。每次从半径起步、要直径就打一下 `D`。

直径档下键入的裸数字 MUST 按直径解释：落点在指针方向、距圆心为该值的一半处。

半径为 0 时 MUST 仍以 `rejected` 表达且 MUST NOT 结束会话——两档共用同一条退化判定。

#### Scenario: 切成直径

- **WHEN** `CIRCLE` 取过圆心后键入 `D`
- **THEN** 提示变成「指定直径」，该步的 `fields` 是 `diameter`，列出的关键字变成 `R`

#### Scenario: 切回半径

- **WHEN** 处于直径档时键入 `R`
- **THEN** 提示、`fields` 与关键字都回到半径档

#### Scenario: 直径档下的裸数字按直径解释

- **WHEN** 处于直径档，指针在圆心的某个方向上，用户键入 `300` 并确认
- **THEN** 落地的圆半径是 150

#### Scenario: 下一次 CIRCLE 从半径起步

- **WHEN** 上一次 `CIRCLE` 用过直径档，再次启动 `CIRCLE` 并取过圆心
- **THEN** 提示是半径档

### Requirement: 圆与弧各步声明自己的参数化

`CIRCLE` 与 `ARC` 各步 MUST 按下表声明 `fields` 与 `measured`：

| 命令 | 步 | `fields` | `measured` |
| --- | --- | --- | --- |
| `CIRCLE` | 圆心 | `absolute` | — |
| `CIRCLE` | 半径 / 直径 | `radius` / `diameter` | 画 |
| `ARC` | 起点 | `absolute` | — |
| `ARC` | 途经点 | `polar` | 不画 |
| `ARC` | 端点 | `polar` | 画 |

`ARC` 的两个 `polar` 步 MUST 从**上一个点**起算——第二点从起点，第三点从途经点，与 `LINE`
的「上一个点」是同一条规则。

`ARC` 的途经点步 MUST NOT 打开 `measured`：那一步的预览**就是**那条直线，画两遍就是同一条
线加粗。端点步 MUST 打开：那时预览换成了弧，途经点到落点那一段不在弧上。

`ARC` 取过一个点时的预览 MUST 是一条直线而 MUST NOT 是一段弧。两个点定不出弧，画一段弧要
替用户猜一个半径——用户会以为形状已经定了，而第三个点会把它整个换掉。

`ARC` 的第三步 MUST NOT 显示只读的半径：那一步已经有两个数在跟着光标动，第三个没有输入语义
的数只是噪音。

#### Scenario: 圆的半径步是单字段

- **WHEN** `CIRCLE` 取过圆心
- **THEN** 该步的 `fields` 是 `radius`，且 `measured` 为真

#### Scenario: 弧的两个点只画直线

- **WHEN** `ARC` 取过起点后以候选点查询 `preview`
- **THEN** 返回的几何是一条直线段，不是弧

#### Scenario: 弧的端点步从途经点起算

- **WHEN** `ARC` 取过起点与途经点
- **THEN** 该步的 `fields` 是 `polar`、`measured` 为真，且上报的原点是途经点

### Requirement: 顶层容器体的命中收敛

`StageInteractionHit` 的 entity 分支 MUST 携带命中来源 `source`，取值 `body` 与 `label`，
缺省 MUST 视为 `body`。收敛判定 MUST 作用于**过了 Group 门槛之后**的命中（见「Group 命中先
选组，双击穿过一层」）：命中一个锁定 Group 的子级，看到的必须是那个锁定的 Group。在 `select`
工具下，来源为 `body` 的命中若同时满足「目标是 `rootIds` 的直接成员」「目标含 Hierarchy」
「该目标不是 first-class Group」，controller MUST NOT 选中该目标，而是 MUST 起框选，判定几何、
方向判定、修饰键布尔组合与「不产生文档事务」MUST 与在空白 surface 上起框一致。起框所在的容器
及其祖先 MUST NOT 出现在框选结果中：用户是在这个容器「里面」框内容，把它自己选中等于没有收敛。

收敛 MUST NOT 因为目标为空（`childIds` 为空）而放弃，也 MUST NOT 因为目标已在当前选区内而
放弃。这两条曾经的例外各自制造了一条搬走整块场景的路径：空场景整块都是拖动把手，而用户
几乎总是先选中场景再去框选它的内容，此时保护恰好失效。两者都有标题标签这个不受影响的
选中入口，因此没有「收敛之后就选不中了」的补偿问题。

按住 `command` 修饰键在收敛目标的体上按下 MUST 直接选中该目标并进入 move 手势，作为标题
标签之外的第二个入口。该修饰键 MUST NOT 改变收敛在其余情形下的判定，也 MUST NOT 影响
`shift` 的加选语义。

锁定的容器与 first-class Group MUST 完全退出画布选中：无论是否有子元素、是否顶层、命中
来源是 body 还是 label，controller MUST NOT 选中它们，MUST 起框选。它们的选中入口只剩场景树。
锁定 Group 的子级 MUST 同样收敛（门槛把命中抬到那个 Group 上）。锁定的非容器 Entity MUST
保持既有行为，仍可被选中检查但不可变换。

来源为 `label` 的命中 MUST 始终按普通 entity 命中处理（锁定容器除外）。收敛 MUST 只作用于会
渲染标题标签的顶层容器：嵌套容器与 first-class Group 没有标签，收敛之后将没有任何选中入口，
因此 MUST NOT 参与收敛。非容器 Entity、Shift 加选、锁定判定与绘制工具的既有分支 MUST NOT
受影响。收敛 MUST NOT 改变 SceneIndex 的 `containerAtPoint` 与外部拖入的落点解析。

收敛判定 MUST 是可独立求值的纯函数，与它触发的框选会话同处一个模块——两者是同一个手势的不同
入口，分开放会让「哪些命中会起框」散在多处。

#### Scenario: 在非空容器空白处起框

- **WHEN** 工具为 `select`，容器含至少一个子元素且不在当前选区内，用户在其空白处按下并拖动
- **THEN** controller 进入 marquee phase，选区在按下瞬间保持不变
- **AND** 松手后按框选判定模式与修饰键组合出结果，不产生该容器的 move 手势
- **AND** 结果只包含被框住的后代，起框容器与其祖先不在其中

#### Scenario: 空的顶层容器同样收敛

- **WHEN** 顶层容器没有子元素且用户在其体上按下并拖动
- **THEN** controller 进入 marquee phase，该容器不成为选区也不进入 move 手势

#### Scenario: 已选中的顶层容器同样收敛

- **WHEN** 顶层容器已在当前选区内且用户在其空白处按下并拖动
- **THEN** controller 进入 marquee phase，该容器不随指针移动

#### Scenario: 收敛目标上单击清空选区

- **WHEN** 用户在收敛的顶层容器体上按下并原地松手
- **THEN** 框退化为零面积，选区被清空，不产生任何文档事务

#### Scenario: command 点体直选并拖动

- **WHEN** 用户按住 `command` 在收敛的顶层容器体上按下并拖动
- **THEN** 该容器成为选区并进入 move 手势

#### Scenario: 锁定容器与 Group 不可在画布上选中

- **WHEN** 用户在锁定的容器或 first-class Group 上按下，无论来源是 body 还是 label
- **THEN** 选区不发生变化，controller 进入 marquee phase
- **AND** 锁定的非容器 Entity 仍可被选中检查

#### Scenario: 锁定 Group 的子级同样收敛

- **WHEN** 用户在锁定 Group 的子级上按下或双击
- **THEN** 选区不发生变化，controller 进入 marquee phase

#### Scenario: 嵌套容器不参与收敛

- **WHEN** 用户在一个含子元素、但父级不是画布根的容器上按下
- **THEN** 该容器成为选区并进入 move 手势

#### Scenario: Group 不参与收敛

- **WHEN** 用户在含子项的 first-class Group 上按下
- **THEN** 该 Group 成为选区并进入 move 手势

#### Scenario: 标签来源不参与收敛

- **WHEN** 命中来源为 `label` 且目标是含子元素的容器
- **THEN** 该容器成为选区并进入 move 手势

### Requirement: 成批作业的命令提交后接着画

`ARROW` MUST 声明 `repeat`；`LINE` / `PLINE` / `RECTANGLE` / `CIRCLE` / `ARC` MUST NOT 声明。

判据是既有那条——**用户画完之后想对它做什么**：

- 箭头画完，九成是接着标下一个。标注是**成批**的活儿。
- 矩形、圆、弧画完，九成是接着调它自己：拖某个顶点、挪某条边、改半径。

这个不对称是**设计**。反证：给所有命令都重开，画完一个矩形想调它得先按一次 `Escape`，而那一下
按键不携带任何信息——正是这套交互从一开始就在删的东西。

`LINE` 与 `PLINE` 本来就连续取点，重开对它们没有意义。

#### Scenario: 箭头声明重开

- **WHEN** 查阅 `ARROW` 的命令定义
- **THEN** 它的 `repeat` 为真

#### Scenario: 取够即结束的形状命令不声明

- **WHEN** 查阅 `RECTANGLE` / `CIRCLE` / `ARC` 的命令定义
- **THEN** 三者都不声明 `repeat`

### Requirement: LINE 取点落在端口上即绑定

`LINE` 取点的落点来自某个端口时，产出曲线的该端 MUST 绑到那个端口；来自别处时 MUST 是自由端。
两端都自由时 MUST NOT 写 `Wire`——不带任何绑定的 `Wire` 读不出意图。

绑定 MUST 来自**取点时记下的来源**，MUST NOT 事后按坐标反查已有端口。按坐标反查会让一条恰好
路过端口的普通线莫名其妙地绑上——用户没有表达过那个意图，而这个绑定在屏幕上不可见，要等到
符号移动时才现形。特征点捕捉的结果 MUST 因此携带端口 id。

**「吸附到端口」本身就是显式意图**：用户把光标挪进端口的容差、看见捕捉标记亮起、然后落笔。
因此 MUST NOT 再要求他先选对一条命令——那是让同一个意图说两遍，而说错的代价不对称：用不绑定
的命令画出来的接线像素级正确却从未接上，这个错误在屏幕上完全不可见；反过来的错误在 Inspector
里读得出来。

`LINE` 连续画线时每一段是各自的 Entity，第 `i` 段的起点与第 `i-1` 段的终点是**同一次取点**，
因此两段 MUST 都绑到该端口：两段都真的碰到了那个端子，符号移动时两段都该跟上。

**绑定端与被绑实体不在同一父级时，该端 MUST NOT 绑定**，并 MUST 在命令行说明原因。
`wire.parent-mismatch` 是文档非法而不是警告，而落地父级按线段紧包围盒中心判定，因此「从帧内
符号的端口拉一条线到帧外」是一次平常手势却会产出非法文档。不绑是**可见的降级**（Inspector
显示该端自由），非法文档是不可见的，还会阻断与画线毫无关系的保存。

`WIRE` 命令 MUST 存在：一次接线图上接线是**独立的活儿**，它的产物有自己的规范（红色粗实线、
只走横平竖直、可以有拐点），而这些是 `LINE` 不该有的。两者因此不是同一件事的两个名字。

**「用 LINE 画的接线像素级正确却从未接上」这个屏幕上看不见的错误由本条要求挡住**，而不是由
删掉 `WIRE` 挡住：`LINE` 顺手吸上端口时同样绑定，因此没有「选错命令就永远接不上」这一档。
两条路都通，而用户想清楚要接线时有一条说得出名字的路。

导线的每一次落地（建出来的那一次与之后每一次替换）MUST 按**当前几何**重算两端的绑定：末端
吸上端口就绑、下一下走开就解绑。绑定是**自我纠正**的，因此不受「这一条还没画完」约束——任何
一刻文档里的绑定都与屏幕上看到的一致。接入节点相反：它改的是别人的文档，因此只在结束那一步做。

几何编辑会话里拖动导线的端点 MUST 同时改接线：落点来自端口时绑到该端口，来自别处时解绑并留在
落点。`Wire` 与 `Curve` MUST 写在**同一个事务**里——分两条会产生一个可观察的不一致中间态
（几何已经动了、绑定还指着旧端口），撤销也会变成两步。

#### Scenario: 从端口起笔即绑定

- **WHEN** `LINE` 的第一个点捕捉到某个端口，第二个点落在空白处
- **THEN** 新曲线的起点绑到该端口，终点是自由端

#### Scenario: 没碰过端口的线不带 Wire

- **WHEN** `LINE` 的两个点都落在空白处
- **THEN** 产出的曲线没有 `Wire`

#### Scenario: 连续画线时共享的那个点两段都绑

- **WHEN** `LINE` 依次取三个点，其中第二个点捕捉到某个端口
- **THEN** 第一段的终点与第二段的起点都绑到该端口

#### Scenario: 跨父级不绑并说明

- **WHEN** 取点捕捉到的端口所属实体与该线段的落地父级不一致
- **THEN** 该端不绑定，命令行说明原因，且产出的文档不含 `wire.parent-mismatch`

#### Scenario: WIRE 在词汇表里

- **WHEN** 在命令行键入 `WIRE` 或 `WI`
- **THEN** 启动一条导线会话，而不是得到「未知命令」

#### Scenario: 画到一半的导线末端离开端口即解绑

- **WHEN** `WIRE` 的第二个点吸附到某个端口，第三个点落在空白处
- **THEN** 这条导线的末端变成自由端，起点的绑定不受影响

#### Scenario: 拖端点改接线

- **WHEN** 在几何编辑里把一条导线的绑定端拖到另一个端口上
- **THEN** 该端改绑到新端口，且只产生一条可撤销记录

#### Scenario: 拖到空白处即解绑

- **WHEN** 把绑定端拖到不在任何端口上的位置
- **THEN** 该端变成自由端并停在落点，不被下一次解算拉回原端口

### Requirement: 缩放会话上报本次的尺寸参考

缩放会话 MUST 在每一次预览发布里带上本次缩放的原点与落点（世界坐标），与 `rotationPreview`
同构；非 `resize` phase MUST 为 null，提交与取消 MUST 一并清掉。

原点是**与手柄对角的那个角**，落点是**手柄那一侧的角**，两者 MUST 都取自**新**包围盒，并
MUST 由一个纯函数从 `(手柄, 新包围盒)` 求出、可独立求值。

两点 MUST NOT 取自冻结包围盒：`alt`（从中心缩放）下冻结盒的对角**会动**——那一档固定不动的
是中心而不是任何一个角。取新盒的对角在两种情形下都给出宽高，且没有 `alt` 时它本来就等于冻结
盒的对角。

渲染层 MUST NOT 自己反推手柄：手柄是插件内部状态，而预览期间选区框上八个手柄的位置**都在
动**，从包围盒的变化反推「拖的是哪一个」在等比约束下无解——等比时角手柄与边手柄可以改出完全
相同的新盒。

落点 MUST 由吸附解算之后的新包围盒求出，MUST NOT 读裸指针。

#### Scenario: 拖角手柄时上报对角与新角

- **WHEN** 拖动左上角手柄
- **THEN** 快照的原点是新包围盒的右下角，落点是新包围盒的左上角
- **AND** 没有按 `alt` 时该原点在整个拖动期间不变

#### Scenario: 拖边手柄时原点仍是对角

- **WHEN** 拖动右边手柄
- **THEN** 快照的原点是新包围盒的左上角，落点是新包围盒的右下角

#### Scenario: 从中心缩放时两点仍给出宽高

- **WHEN** 按住 `alt` 拖动角手柄
- **THEN** 两点之差仍等于新包围盒的宽高

#### Scenario: 非缩放 phase 没有尺寸参考

- **WHEN** 手势结束或处于移动、旋转、框选 phase
- **THEN** 快照的尺寸参考为 null

### Requirement: 取点落在导线上即接入节点

取点的落点**落在另一条导线上**时，系统 MUST 规划出一次**接入**（落点来自那条导线的
`endpoint`、`midpoint` 或 `nearest` 候选——三者都是导线上的点）：在
**同一个事务**里建一个节点 Entity、把被接入的那条导线在该点断成两段、并让三条支路各绑到节点的
端口。拆成多条事务 MUST NOT 被接受——它会产生一个可观察的不一致中间态（节点已经在了、导线还没
断），撤销也会变成多步。

接入 MUST 来自**取点时记下的来源**，MUST NOT 事后按坐标反查已有导线。这与「`LINE` 取点落在端口
上即绑定」是同一条判据：吸附到线上本身就是显式意图（用户把光标挪进容差、看见标记亮起、然后
落笔），而按坐标反查会让一条恰好交叉而过的线莫名其妙地接上——那个连接在屏幕上不可见，要等到
符号移动时才现形。**键入坐标产生的落点 MUST NOT 接入**：它没有来源。

三种模式 MUST 一视同仁，MUST NOT 只认其中一两种。中点的优先级高于 `nearest`，因此瞄准一段线的
正中间落笔时命中的是 `midpoint`；只认 `nearest` 的症状是「接线图上最容易瞄的那个位置反而接不上」，
而它在屏幕上与接上了逐像素相同。

被接入的导线断成的两段 MUST 保留原线的全部呈现（描边、虚线、marker 与 Preset）与原线两端的绑定：
**靠近哪一端的那一半继承哪一端的绑定**，两段各自的另一端绑到节点。中间的拐点 MUST 按落点所在的
段分配给两段，MUST NOT 丢失。

落点恰好落在被接入导线的**首顶点或末顶点**上时 MUST NOT 断线——那里没有需要断开的线身。

那一端**自由**（没有绑定）时 MUST NOT 建节点，而 MUST 规划出一次**合并**（见「两条导线合并成
一条」）：两条线在一点相接、而那一点上再没有第三样东西，它们在电气上**就是**一条线。这一条与
「节点降到两条支路时合并」是同一条规则的两个触发点——一个在画的时候，一个在删的时候。

那一端**已经绑着端口**时仍 MUST 建节点并把它改绑过去：那一点上有第三样东西。这一档 MUST 用
`entity.component.update` 而不是 `entity.component.add`——判据读的就是那个已经存在的 `Wire`。

**节点与被接入的导线 MUST 同父级**，落点跨父级时 MUST NOT 接入，并 MUST 在命令行说明原因。这与
「绑定端与被绑实体不在同一父级时不绑定」是同一条既有判据：不接是**可见的降级**，非法文档是不
可见的。

**建节点那一条 MUST 排在事务的最后。**子级顺序就是绘制顺序，先建的在底下；节点排在新画的那条
导线之前时，接头正中央按下去抓到的是那条线而不是节点——而接头是三条支路唯一的公共入口，挪接头
是接线图上的常规操作。图上也一样：一个被线盖住的接头读作「这里有一条线经过」。绑定指向一个此刻
还不存在的 Entity 不成问题——批次是原子的，而「指向不存在的实体」本来就只是解算失败、不是文档
非法。

交叉 MUST NOT 产生任何连接：两条导线只是几何上相交、没有任何一次取点落在对方身上时，文档里
MUST NOT 出现节点，图上 MUST NOT 出现任何记号。

#### Scenario: 接到线身中间

- **WHEN** `WIRE` 的最后一个点吸附到另一条导线的线身上并提交
- **THEN** 文档里多出一个节点 Entity
- **AND** 被接入的导线变成两段，两段各有一端绑到该节点
- **AND** 新导线的该端也绑到该节点

#### Scenario: 节点画在三条支路之上

- **WHEN** 完成一次接入
- **THEN** 节点在事务里排在新画的那条导线之后
- **AND** 在接头正中央按下并拖动，挪走的是节点，三条支路的端点都跟着它走

#### Scenario: 一次接入只撤销一步

- **WHEN** 完成一次接入后按撤销
- **THEN** 节点消失、被断开的两段合回原来那一条、绑定回到接入之前

#### Scenario: 断开的两段继承原来的绑定

- **WHEN** 被接入的导线两端各绑着一个符号端口
- **THEN** 断开后靠近各自端口的那一半仍绑着原来的端口

#### Scenario: 接到一个绑着端口的端点上不断线

- **WHEN** 取点吸附到另一条导线的末顶点，而那一端绑着一个端口
- **THEN** 只建节点，被接入的导线仍是一条，它的末端改绑到该节点

#### Scenario: 接到自由端上不建节点

- **WHEN** 取点吸附到另一条导线的**自由**末顶点
- **THEN** 不建节点，规划出一次合并
- **AND** 两条线合成一条，图上没有实心点

#### Scenario: 键入坐标不接入

- **WHEN** 在命令行键入的坐标恰好落在另一条导线的线身上
- **THEN** 不建节点，产出的导线该端是自由端

#### Scenario: 跨父级不接入并说明

- **WHEN** 取点吸附到的导线与本次落地父级不一致
- **THEN** 不接入，命令行说明原因，产出的文档不含 `wire.parent-mismatch`

#### Scenario: 交叉不产生连接

- **WHEN** 两条导线在几何上相交，但没有任何一次取点落在对方身上
- **THEN** 文档里没有节点，两条导线之间没有任何绑定

### Requirement: 节点在支路不足时自删

系统 MUST 在支路数降到 1 时把节点连同它的 `Ports` 一起删掉：一个只连着一条线的节点已经不表达
任何连接，留着它等于在图上放一个含义为空的实心点。删除 MUST 与造成这次减少的那一步在同一个事务
里，撤销 MUST 一步回到有节点的状态。

支路数降到 2 时 MUST 把那两条支路**合并成一条**并把节点一并删掉（合并的规则见「两条导线合并成
一条」）。两条线在一点相接、而那一点上再没有第三样东西时，它们在电气上**就是**一条线，而同一张
图不该有两种文档形态。这条规则同时收掉两个现象：搭接之后把搭上去的那条删掉，被断开的两半合回
原来那一条、节点消失，图形回到搭接之前；先画 A→B 再从 B 画到 C 时取点落在第一条的末顶点上，
按既有规则建出来的正是一个两支路节点，因此它当场被合并——两种画法产出逐字相同的文档。

合并不成立时（两条支路是同一条导线的两端、两者跨父级）MUST 保留节点并照常画点。

这条**取代**了此前「支路为 2 时保留节点并照常画点」那条对 KiCad「只连接两个东西时不画点」的
有意偏离。那条偏离的理由是「节点在这里是一个真实的对象，一个存在但不画的对象点得中却看不见」，
而合并把那个对象**一起消掉了**——不再存在「存在但不画」的东西，因此那条理由不再适用。
GB/T 4728.3 禁止在**交叉**上加点这一条不受影响：交叉本来就不产生节点。

既有文档里已经存在的两支路节点 MUST NOT 被批量清理——那会在用户没有动手的时候改他的文档；
它们在下一次任何一条支路发生增删时按本规则收掉。

#### Scenario: 删到只剩一条支路时节点消失

- **WHEN** 一个三支路节点被删掉两条支路
- **THEN** 节点自己也被删掉，剩下那条导线的该端变成自由端

#### Scenario: 降到两条支路时两条合回一条

- **WHEN** 一个三支路节点被删掉一条支路
- **THEN** 节点被删掉，剩下的两条支路合并成一条导线
- **AND** 图上没有实心点，合并后那条的两个远端绑定都还在

#### Scenario: 删掉搭上去的那条之后两半合回一条

- **WHEN** 在一条导线上搭一条，再把搭上去的那条删掉
- **THEN** 被断开的两半合回**一个** Entity，节点消失，图上没有实心点
- **AND** 形状与搭接之前逐像素相同；搭接的那一点作为一个共线顶点留下

#### Scenario: 分两次画出的线合成一条

- **WHEN** 先画 A→B 结束，再从 B 画到 C
- **THEN** 文档里只有一条三顶点导线，没有节点
- **AND** 它与一次画出 A→B→C 得到的文档逐字相同

#### Scenario: 同一条导线的两端接在同一个节点上时不合并

- **WHEN** 一个节点的两条支路是同一条导线的首尾两端
- **THEN** 节点仍在，并照常画出实心点

#### Scenario: 自删与造成它的那一步同一次撤销

- **WHEN** 删掉倒数第二条支路后按撤销
- **THEN** 该支路与节点同时回来

### Requirement: 网格容器内的拖动与缩放规划

Stage Engine MUST 为父级是网格容器的 Entity 提供独立的移动与缩放规划路径：落点解算成
**格坐标**而不是像素 offset，提交写 `GridItem` 而不是 `LayoutItem.offset` 或求解尺寸。

落点 MUST 取被拖盒左上角所在的格，并 MUST 钳制到 `[0, columns - w]`——允许越界会产出一个
永远解算不出来的坐标。缩放 MUST 把被拖的那条边吸到最近的格线，并 MUST 尊重 `GridItem` 的
`minW` / `minH`。

一次手势 MUST 规划成**一条**事务：目标的新格坐标与被它推挤的全部兄弟的新格坐标写在同一条
batch 里。拆成两条会让用户按两次撤销，而他只做了一个动作。

推挤结果 MUST 来自 core 的同一个网格求解器，MUST NOT 在本包另算一遍——各算一遍的症状是
"拖动时看到的让位与松手后的结果不一样"，而那种偏差只在特定布局下出现。

目标被拖出网格容器时 MUST 删除其 `GridItem` 并按既有的"移出 Layout 时烘焙 Absolute 几何"
规则处理；拖入网格容器时 MUST 按落点写入 `GridItem` 并把 `positioning` 置为 `flow`。

#### Scenario: 拖动写格坐标而不是像素

- **WHEN** 用户把网格里一张 4×2 的卡从 `(8, 0)` 拖到左下方
- **THEN** 提交的命令写的是新的 `GridItem.x` / `y`
- **AND** 该 Entity 的 `LayoutItem.offset` 不变

#### Scenario: 推挤与目标写在同一条事务

- **WHEN** 落点压住了另外两张卡，松手提交
- **THEN** 目标与两张被推卡片的新格坐标在同一条 batch 里
- **AND** 一次撤销让三者同时回到拖动前的位置

#### Scenario: 落点钳制在列范围内

- **WHEN** 用户把一张 4 格宽的卡拖到 12 列网格的最右侧之外
- **THEN** 落点钳制为 `x = 8`
- **AND** 不产生越界的格坐标

#### Scenario: 缩放吸到格线并尊重最小跨度

- **WHEN** 用户拖东侧手柄，指针落在第 8 格与第 9 格之间，且该卡 `minW` 为 2
- **THEN** 宽度吸到整数格
- **AND** 继续向内拖不会让跨度小于 2

#### Scenario: 拖出网格容器时删除 GridItem

- **WHEN** 用户把网格里的一张卡拖到容器之外
- **THEN** 提交的命令删除该 Entity 的 `GridItem` 并把 `positioning` 切为 `absolute`
- **AND** 几何按既有烘焙规则保持视觉位置不变

### Requirement: 变换指示器把手的命中与仲裁

变换指示器的把手 MUST 是一个独立的命中类型（携带 `x` / `y` / `rotate` 三者之一），并由一个
独立插件接管，MUST NOT 混进实体选择或缩放分支。

指示器的开关 MUST 只影响把手的存在，MUST NOT 改变别处任何一次拖动的含义——它是 chrome 的
可见性而不是模式。

插件优先级 MUST 高于 `entity-select-move` 与 `resize`：圆环会横穿盒手柄与圆角把手，排在它们
之下等于环在四个角上按不动，而那正是环最容易被抓到的地方。同时 MUST 低于 `path` 与 `paint`
把手——那些是**别的编辑会话**的把手，指示器不该把它们偷走。

轴把手 MUST 产出一次**受该轴约束**的平移，并复用移动手势既有的提交漏斗；MUST NOT 写
`Transform.rotation`。

圆环 MUST 复用既有的旋转会话（其中心已经是该 Entity 的旋转基点），MUST NOT 另写一份旋转数学
——另写的那份必然在 Shift 角度吸附、`baseRotation` 与并发中止三处里漏掉一两处。圆环 MUST NOT
写 `LayoutItem.offset`。

把手几何 MUST 是可独立求值的纯函数，输入是基点世界坐标、该 Entity 的 `rotation` 与当前缩放。

#### Scenario: 环压过盒手柄

- **WHEN** 圆环与某个缩放手柄在屏幕上重叠处被按下
- **THEN** 开始的是旋转会话，不是缩放

#### Scenario: 别的编辑会话的把手不被偷走

- **WHEN** 指示器显示着，同时按下一个路径顶点或 Paint 控制柄
- **THEN** 接管的仍是那条既有会话

#### Scenario: 拖轴不改角度

- **WHEN** 拖动 X 轴的方块把手
- **THEN** 该 Entity 的 `Transform.rotation` 不变

#### Scenario: 拖环不改位置

- **WHEN** 拖动圆环
- **THEN** 该 Entity 的 `LayoutItem.offset` 不变

#### Scenario: 轴方向跟随对象旋转

- **WHEN** 目标已经转过 30°
- **THEN** 求出的两条轴方向同样是 30° 与 120°

### Requirement: POLYGON 命令画正多边形

`POLYGON`（别名 `POL`）MUST 按三步取得输入——**边数**、**中心点**、**内接/外切圆的半径点**
——并产出一条闭合多段线（`kind: 'polyline'`、`closed: true`）。

MUST NOT 为正多边形另立 `Curve` kind：「各边等长」在用户拖动任一顶点之后就不再成立，与
「矩形是四顶点的闭合多段线」是同一条判断。效果 MUST NOT 携带任何新的意图标记——
`rectangle` / `arrow` / `wire` 存在是为了让宿主挑一个特定 Preset，而多边形落在 `curve` 上，
与 `PLINE` 一致。

**第一步同时问边数与档位。**它 MUST 声明 `accepts: ['text', 'keyword', 'point']`，MUST NOT
声明 `fields`：`fields` 说的是「这一步的**点**怎么参数化」，而这一步要的是一个数加一个二选一。
提示 MUST 把默认值印在尖括号里（`输入边数或指定中心点 <6>`），直接确认 MUST 取该默认值——
默认值能省掉一次键入的前提是用户看得见自己按下去会得到什么。

这一步 MUST 声明 `cursorInput`，把当前边数与当前档位交给宿主印在光标旁。命令行在图面底部，
而用户的眼睛此刻在光标上——「敲一个数」这句话说在他没有在看的地方等于没说。

**这一步 MUST 收点**：收到点即取用当前边数与当前档位，**并把该点当作中心点**，直接进到半径步。
十字光标在这一步是画着的（`accepts` 含 `point`），而「屏幕上不该出现一个鼠标动了也没反应的
状态」——让十字线真的能落点，比把它画成装饰要好。

键盘与指针因此是两条通道，且 MUST NOT 撞车：这一步**没有参考点**，直接距离输入无从谈起，
所以裸数字只可能是边数。

默认边数 MUST 记在**本次编辑会话**，MUST NOT 写进文档，也 MUST NOT 持久化。这与「`CIRCLE`
的档位不跨命令记忆」不冲突：那一条的理由是「屏幕上没有任何东西解释为什么」，而这里屏幕上
就写着 `<6>`。首个默认 MUST 是 6 而不是 AutoCAD 的 4——四边形有 `RECTANGLE` 这个更快的入口。

边数不是 3 到 1024 之间的整数时 MUST 以 `rejected` 表达且 MUST NOT 结束会话。上界 MUST 照抄
AutoCAD，MUST NOT 因为夹点数量另设一个更小的值：1024 顶点的多段线 `PLINE` 今天就画得出来，
多边形不是这个问题的来源。

**档位只在第一步可换。**第一步 MUST 提供 `I`（内接）与 `C`（外切）两个关键字，形状与
`CIRCLE` 的 `D`/`R` 同构：处于内接档时 MUST 只列出 `C`、处于外切档时 MUST 只列出 `I`；
切换 MUST 同时改 `cursorInput.toggle` 与列出的关键字。

**中心步与半径步 MUST 收干净**：MUST NOT 列出 `I` / `C`，也 MUST NOT 受理它们（收到即
`rejected`），`cursorInput` MUST 缺席。半个残留比全留或全删都糟——一个还印着却按不动的读数，
用户按一下没反应会以为这条能力根本不存在；而列不出来却仍然受理，等于留一条只有读过源码的人
才知道的暗门，与「命令行是这条能力唯一的说明书」直接冲突。

代价 MUST 写在明处：**拿主意的时候屏幕上还没有形状**，这正是 AutoCAD 那个做法被诟病的地方。
补偿有两条——它不是一道拦路的问题（已经有值，直接确认就走），而且档位跨命令记住，选错重来
一次只需按一下 `Tab`。

档位 MUST 记在**本次编辑会话**（`polygonFit` / `onPolygonFitChange`），与边数同一条理由：
「不跨命令记忆」的判据是**那份状态看不见**，而档位挪到第一步、印成光标旁的胶囊之后，那条理由
不再成立。同一档再按一次 MUST NOT 回调——没有真的变化时宿主那份值不该被写一遍。

**边数 MUST 另有 `+` 与 `-` 两个关键字**，各增减一条边，并 MUST 在**每一步都**可用：第一步上
它改的是尖括号与光标旁那个框里的值（`6` → `7`），另两步上它当场改变形状或提示里的边数。每一步都
生效让这条规则没有例外——只在其中一步生效的话，用户在别的步上试一下没反应，会以为这条能力
不存在，而「屏幕上不该出现一个鼠标动了也没反应的状态」。

它们 MUST 出现在**每一步**的 `keywords` 里。滚轮是这两个关键字的第二个入口，而**入口不可发现等于
没有**：命令行是这条能力唯一的说明书。列出来之后可点、可敲、可滚轮，三条路一个语义、一份
实现。

增减 MUST 钳制在 3 到 1024，到边界 MUST 停住且 MUST NOT 回绕：回绕会让一次连续滚动从 3 跳到
1024，而用户此刻正盯着形状看，不会去读那个数。

中心步与半径步的提示 MUST 把当前边数显示出来（例如「指定内接圆半径 [6 边]」）。滚轮改的是
一个用户没有键入过的数，屏幕上必须有一处说出它现在是多少——形状本身在边数大时读不出来，
十二边与十三边看着一样，而中心步上连形状都还没有。

内接与外切 MUST NOT 单独占一步：AutoCAD 把它做成一道拦路的问题，而它在这里是第一步上一个
**已经有值**的字段，直接确认就走。

各步 MUST 按下表声明 `fields`、`cursorInput` 与 `measured`：

| 步 | `fields` | `cursorInput` | `measured` |
| --- | --- | --- | --- |
| 边数 · 档位 | —（要的不是点） | 边数 + 档位 | — |
| 中心点 | `absolute` | — | — |
| 半径 | `radius` | — | 画 |

半径步 MUST 是单字段：多边形绕中心的相位由落点的角度决定，但那个角度不是一个用户会去键入
的量，而 `Tab` 在只有一个框时没有去处——与圆同判。`measured` MUST 打开：预览是整个多边形，
被量的那一段（中心 → 落点）不在里面，不画出来标注的两条延伸线就从空处伸出来。

几何 MUST 从落点求出**大小与相位**两样。角度的**正负约定在这里不可观测**，因此求解可以沿用
它所在模块的那一套：内接的首顶点无论如何都落在落点上，而外切差的那 `±180/n` 因为
`−180/n ≡ 180/n − 360/n`、顶点又按 `360/n` 整周排布而抵消，两种约定给出的顶点集合逐点相同。

- `R = hypot(P − C)`、`θ₀ = atan2(−(P.y − C.y), P.x − C.x)`
- **内接**：外接圆半径 `R`，首顶点角 `θ₀`——全部顶点落在这个圆上
- **外切**：外接圆半径 `R / cos(π/n)`，首顶点角 `θ₀ + 180/n`——落点是某条边的中点

AutoCAD 为「键入半径」发明的固定朝向（底边按当前捕捉旋转角画）MUST NOT 实现。它在那里存在
是因为键入的数值不携带方向；而本仓库的裸数字走 `applyComposeFieldOverride`——它从当前落点
出发只替换活动字段，另一个分量（角度）保持不变，因此相位自然保留。

`R` 为 0 时 MUST 以 `rejected` 表达且 MUST NOT 结束会话，与 `CIRCLE` 共用同一条退化判定。

`preview(point)` MUST 返回**完整的多边形**，MUST NOT 返回半径线或橡皮筋——预览几何与橡皮筋
互斥，两者回答同一个问题。

命令 MUST NOT 声明 `repeat`：画完一个多边形九成是填色、接线、改它的顶点，与 `RECTANGLE`、
`CIRCLE` 同判。

命令 MUST NOT 绑定单键快捷键。七个绘图键已经占满了与命令名有认读关系的字母（`P` 归
`PLINE`），剩下的字母与「多边形」没有任何认读关系，给一个记不住的键比不给更差；
「单键 MUST 同时是命令别名」这条规则的反向本来就不成立。

#### Scenario: 直接确认取用默认边数

- **WHEN** 启动 `POLYGON` 后在第一步直接确认
- **THEN** 会话按 6 条边继续，并进入中心点步

#### Scenario: 默认边数跟着上一次走

- **WHEN** 上一次 `POLYGON` 用了 8 条边，再次启动 `POLYGON`
- **THEN** 边数步的提示写着 `<8>`，直接确认即按 8 条边继续

#### Scenario: 边数越界被拒绝

- **WHEN** 第一步收到 `2` 或 `2000`
- **THEN** 会话给出被拒绝的说明并停在第一步

#### Scenario: 边数不是整数被拒绝

- **WHEN** 第一步收到 `5.5`
- **THEN** 会话给出被拒绝的说明并停在第一步

#### Scenario: 内接与外切在同一落点下不同

- **WHEN** 以同一个中心点与同一个半径落点分别在内接档与外切档提交
- **THEN** 两次产出的顶点坐标不同，且外切那次的外接圆半径是内接那次的 `1 / cos(π/n)` 倍

#### Scenario: 第一步只列出能切过去的那一档

- **WHEN** 启动 `POLYGON`
- **THEN** 提示是内接档，列出的关键字只有 `C`，`cursorInput.toggle` 是内接
- **AND** 键入 `C` 后变成外切档，列出的关键字只有 `I`

#### Scenario: 后两步既不列出档位也不受理它

- **WHEN** `POLYGON` 走到中心步或半径步
- **THEN** 列出的关键字里没有 `I` 也没有 `C`，`cursorInput` 缺席
- **AND** 在半径步键入 `C` 得到 `rejected`，预览的形状一点没变

#### Scenario: 档位跨命令记住

- **WHEN** 上一次 `POLYGON` 用过外切档，再次启动 `POLYGON`
- **THEN** 第一步的 `cursorInput.toggle` 是外切，取过中心点后提示写着外切圆半径

#### Scenario: 第一步点一下即以那一下为中心

- **WHEN** 启动 `POLYGON` 后直接在图面上取一个点
- **THEN** 会话按当前边数与当前档位进到半径步，且该点就是中心点

#### Scenario: 键入半径保留相位

- **WHEN** 半径步的指针停在中心点的某个非轴向方向上，用户键入一个半径并确认
- **THEN** 多边形的相位与键入之前的预览一致，MUST NOT 被改写成底边水平的固定朝向

#### Scenario: 半径为零被拒绝

- **WHEN** 半径步的落点与中心点重合
- **THEN** 会话给出被拒绝的说明并停在半径步

#### Scenario: 预览是完整多边形

- **WHEN** `POLYGON` 取过中心点后以候选落点查询 `preview`
- **THEN** 返回的几何是 `closed` 为 true、顶点数等于边数的多段线，而不是一条半径线

#### Scenario: 产出闭合多段线且没有意图标记

- **WHEN** `POLYGON` 取够三步
- **THEN** 提交效果里有一条 `curves` 项，它是 `closed` 为 true 的多段线
- **AND** 效果上没有 `rectangle`、`arrow` 或 `wire` 标记

#### Scenario: 半径步增减边数即时改变预览

- **WHEN** `POLYGON` 的半径步收到 `+`
- **THEN** 边数加一，会话停在半径步，`preview` 返回的顶点数随之加一

#### Scenario: 第一步增减改变默认值

- **WHEN** `POLYGON` 的第一步收到 `+`
- **THEN** 提示里的默认值从 `<6>` 变成 `<7>`，会话仍停在边数步

#### Scenario: 增减到边界停住

- **WHEN** 边数已经是 3 时收到 `-`
- **THEN** 边数仍是 3，MUST NOT 回绕到 1024

### Requirement: path 曲线的顶点与控制手柄

`path` 曲线 MUST 参与既有的几何编辑会话，MUST NOT 另起一套顶点机制——`StageEditablePath`
与 `path` 插件的「顶点优先级排在点选之上」「并发中止」「覆盖层压在手柄之上」三条因此白拿。

夹点 MUST 每个顶点一个，角色为 `vertex`（方块）。两侧的控制点 MUST 走**既有可编辑路径的切线
通道**（顶点上的 `inTangent` / `outTangent`），MUST NOT 为它们新造一种夹点角色：那条通道本来
就画「一个小圆加一根连到顶点的杆」，并且只在活动顶点上显形，与本能力需要的呈现逐字是同一件
事。杆是控制点唯一能表达「它属于哪个顶点」的画法，也是它与孤立的圆角手柄（同样是圆，只在
矩形上出现）之间的区分；MUST NOT 只靠颜色区分。

顶点方块与控制点 MUST 在会话进行期间**全部画出**，MUST NOT 只画某一个顶点的。

这一条曾经反过来（只画正在被会话作用着的那个顶点的，理由是密度），**那样行不通**：点亮的语义
是「下一次按下就是取点」，于是按向手柄的那一下会先被点亮的会话吃掉、提交成一次顶点移动——
手柄永远按不到。悬停显形有同一个毛病（指针从顶点移向手柄的路上就已经离开了顶点），两条是同一个
**可达性**问题的两种说法。密度是真的代价，但一个按不到的手柄等于没有这项能力。

运动路径那一头 MUST 不受影响：它的顶点两侧没有控制点，仍然按既有规则只在活动顶点上出切线。

拖动一个控制点 MUST 默认保持另一侧**共线且等长**（关于顶点作镜像），按住 `Alt` MUST 只动被拖
的那一个。修饰键 MUST 逐帧重读：用户可以拖到一半才按下它。

平滑与尖角 MUST NOT 存成标志位：共线与否从控制点本身读得出来，存一位就是给同一份事实造第二个
来源，而它在用户拖出共线的那一刻就失真了。

控制点的夹点 id MUST 是顶点 id 加一个侧别后缀，因此从 id 单独就能反查出它挂在哪个顶点上、
是哪一侧。id 语法 MUST 只有一处实现（引擎侧），呈现与求解两处读同一份。

拖顶点时它两侧的控制点 MUST 跟着同一个位移走：控制点表达的是这个点两侧的切向，顶点搬家而
切向留在原地会让曲线在松手的瞬间扭一下。

在段上插入顶点与删除顶点 MUST NOT 在本能力内出现：它对既有 `polyline` 同样不存在，是一条
独立能力。只给 `path` 开这个口子会让同一个动作在两种 kind 上一个有一个没有，而用户看不出
为什么。

#### Scenario: 会话里顶点与手柄都画

- **WHEN** 进入一条含多个顶点的 `path` 的几何编辑会话
- **THEN** 每个顶点画一个方块，每个有控制点的一侧画出手柄与连到顶点的杆
- **AND** 不必先点亮某个顶点就能按住手柄拖动

#### Scenario: 拖控制点默认保持对称

- **WHEN** 拖动一个控制点
- **THEN** 另一侧关于顶点作镜像，保持共线且等长

#### Scenario: Alt 断开对称

- **WHEN** 按住 `Alt` 拖动一个控制点
- **THEN** 只有被拖的那一个移动，另一侧一动不动
- **AND** 文档里没有任何记录平滑或尖角的字段

#### Scenario: 拖顶点带着两侧控制点走

- **WHEN** 拖动一个中间顶点
- **THEN** 该顶点两侧的控制点加上同一个位移，切向原样保留

#### Scenario: 开放路径的首尾各只有一侧

- **WHEN** 进入开放 `path` 的几何编辑会话
- **THEN** 首顶点只画出向那一侧的手柄，末顶点只画入向那一侧的

#### Scenario: 几何写入走同一条漏斗

- **WHEN** 拖动顶点或控制点后松手
- **THEN** 派发 `entity.curve.set`，撤销一步回到原几何

#### Scenario: path 的点选与框选照旧走几何

- **WHEN** 在非 100% 缩放下点选一条 `path` 的空白包围盒角落
- **THEN** 不命中；点在描边容差内时命中

### Requirement: 几何编辑会话内插入与删除顶点

几何编辑会话内**双击一条段** MUST 在落点插入一个顶点，落点 MUST 走与拖夹点**同一条**解算——
吸附、特征点捕捉与动态输入因此全部照旧，MUST NOT 为插入另开一条落点通道。

会话内**有夹点被会话作用着**时，`Delete` 与 `Backspace` MUST 删除该顶点。这一档 MUST 分级：
不在会话里、或没有夹点被作用着时，两个键 MUST 仍然删除整个 Entity。与 `Escape` 在点亮态先熄灭
再退出是同一条判断——同一个键在一个有明确进出的会话里换含义是允许的，无条件改写不是。

在 `line` 上插点 MUST 在同一条 `entity.curve.set` 事务里把 `kind` 换成 `polyline`：一条直线
加一个中间点就是三顶点折线，MUST NOT 另立类型，也 MUST NOT 拆成两条命令——拆开会产生一个可
观察的不一致中间态，撤销也变两步。

`arc` MUST NOT 受理插入与删除，MUST 以 `rejected` 说明：弧没有顶点，而「敲了没反应」与敲错
在屏幕上无法区分。

`polyline` 与 `path` 的每条轮廓 MUST 保留至少两个顶点，删到只剩一个时 MUST 拒绝并说明——
一个顶点的轮廓什么都画不出来。

导线的**绑定端顶点** MUST 拒绝删除并说明。删得掉的话 `Wire` 的绑定不会跟着动，下一帧的求解把
**新的**首顶点写回端口位置——用户按下的是「删掉一个点」，看到的却是这一段当场变斜。三种补偿各自
更糟：让绑定跟着挪到新的首顶点，等于在用户没有要求的时候改了接线，而那个改动在屏幕上不可见；
顺手解绑不行，画布上没有只解绑不动几何的手势（那个入口在 Inspector 上，而且它是一次显式选择）；
静默不动则让「按了没反应」与「按错了地方」无法区分。「这一端绑着什么」MUST 由宿主注入——引擎
不认识导线。

**`polyline` 的段夹点**上，`Delete` MUST 剪断那一段（见「剪断导线的一段」），MUST NOT 以
`unsupported` 拒绝——用户此刻抓着的正是「这一段」，而那条拒绝回答不了它。这条 MUST 对导线与
普通折线**一视同仁**：闭合折线去掉一段即变开放，开放折线的中间段分两条，端段与唯一一段以
`cut-edge` 拒绝。直线的平移夹点与 `path` 的控制手柄仍然以 `unsupported` 说出来。

`path` 上的插入 MUST 用 de Casteljau 分割那一段，插入后形状 MUST **逐像素不变**：插点是为了
之后能改它，当场把曲线改成另一个样子会让用户以为自己弄坏了什么。

闭合子路径的**收尾直段**上 MUST NOT 插入顶点，并 MUST 说出原因：那一段是展开时补出来的、
并不存在于数据里，落成真实的段会让子路径的末点与起点重合、凭空多出一个重合的顶点——那正是
`closed` 用布尔而不是重复首尾顶点表达的理由。静默插到**别的**段上是更坏的答案：用户双击了
这里，顶点出现在那里。

「落点是不是真的落在一条段上」MUST 由命中容差判定，MUST NOT 只看命中了哪个 Entity：填过色的
曲线内部同样命中，而它的中间没有段。

#### Scenario: 矩形边上加点

- **WHEN** 在一个矩形的几何编辑会话里双击某条边
- **THEN** 该边上出现一个新顶点，曲线变成五顶点闭合多段线，撤销一步回到四顶点

#### Scenario: 直线插点变折线

- **WHEN** 在一条 `line` 的段上双击
- **THEN** 曲线的 `kind` 变成 `polyline` 且有三个顶点，一次事务、一步撤销

#### Scenario: 贝塞尔插点不改变形状

- **WHEN** 在一条 `path` 的曲线段上双击插入顶点
- **THEN** 顶点数加一，渲染出的形状与插入前逐像素相同

#### Scenario: Delete 分两级

- **WHEN** 在几何编辑会话里点亮一个顶点后按 `Delete`
- **THEN** 只删除该顶点；没有夹点被作用着时按 `Delete` 删除整个 Entity

#### Scenario: 绑定端的顶点删不掉

- **WHEN** 点亮一条导线绑在端口上的那个端点顶点并按 `Delete`
- **THEN** 拒绝并说明那一端绑着端口，几何与绑定都不变
- **AND** 同一条导线的自由端顶点按 `Delete` 正常删除

#### Scenario: 导线的段夹点剪断那一段

- **WHEN** 点亮一条四顶点导线中间那一段的段夹点并按 `Delete`
- **THEN** 那一段被去掉，导线断成两条，一步撤销回到一条

#### Scenario: 普通折线的段夹点剪断那一段

- **WHEN** 点亮一条普通四顶点折线中间那一段的段夹点并按 `Delete`
- **THEN** 那一段被去掉，折线断成两条，两条都不带 `Wire`

#### Scenario: 矩形的段夹点去掉一条边

- **WHEN** 点亮一个矩形任一边的段夹点并按 `Delete`
- **THEN** 矩形变成三段开放折线，仍是同一个 Entity

#### Scenario: 直线的平移夹点仍然拒绝

- **WHEN** 点亮一条两点直线的中点平移夹点并按 `Delete`
- **THEN** 以「这个夹点不是顶点」拒绝，几何不变

#### Scenario: 闭合路径的收尾直段

- **WHEN** 在一条闭合 `path` 的收尾直段上双击
- **THEN** 不插入任何顶点，并说明那一段插不了点

#### Scenario: 弧不受理

- **WHEN** 在一条弧的几何编辑会话里双击它的段
- **THEN** 不插入任何顶点，并给出弧没有顶点的说明

#### Scenario: 顶点数下限

- **WHEN** 一条两顶点的多段线上删除一个顶点
- **THEN** 操作被拒绝并说明，几何不变

### Requirement: MIRROR 命令

`MIRROR`（别名 `MI`）MUST 取两个点定出镜像轴，把选中对象按该轴反射。它 MUST 复用既有的两点
会话与取点管线，因此吸附、捕捉、极轴与动态输入全部照旧。

曲线与容器子树的反射 MUST **烘进几何**：几何点按轴反射后重新归一化，容器递归到每个子级的
`LayoutItem.offset` 与 `Curve`，全部写在**同一步撤销**里——拆开会产生可观察的不一致中间态。
`Transform` 里没有 scale，反射在文档里没有别的地方可放。

一次反射的行列式是负的，因此它 MUST 被拆成「刚体运动 × 盒内翻转」两半：前一半落进位置与
`rotation`（对刚体运动，矩阵分解是精确的），后一半由**能表达它的那一方**承担——曲线烘进几何，
组件实例走 `flip`。推论是一次竖直轴镜像会把未旋转对象的 `rotation` 写成 180°，那不是缺陷：
它与盒内翻转合起来才是那次反射。

子级的落位 MUST 算在**父级的新世界矩阵**里：父级也动了，拿旧矩阵算子级的症状是「容器镜像
之后里面的东西全跑到外面去」。

文字与图片这类既不是曲线也不是实例的叶子，MUST 只反射位置与朝向，内容本身不镜像——文档里
没有承载「左右反过来」的字段，而给它们各加一个是另一件事。

组件实例 MUST NOT 烘进几何（定义是共享的）：它走呈现层的 `flip` 加既有的 `rotation` 补偿——
绕角 θ 的反射等于 `flipX` 之后旋转 `2θ`，数学封闭，因此 MUST NOT 为它新增协议字段。

MUST NOT 提供「镜像后保留原件」的变体：那是 `COPY` 加 `MIRROR` 两步，而两步都已经存在。

#### Scenario: 曲线按任意轴反射

- **WHEN** 选中一条曲线并用 `MIRROR` 指定一条斜轴
- **THEN** 几何按该轴反射，盒重新等于紧包围盒，撤销一步回到原状

#### Scenario: 容器整棵子树一起反射

- **WHEN** 对一个含多个子级的容器执行 `MIRROR`
- **THEN** 子级的位置与几何在同一条事务里一起反射，撤销一步全部回来

#### Scenario: 组件实例走呈现层

- **WHEN** 对一个组件实例执行 `MIRROR`
- **THEN** 实例的 `flip` 与 `rotation` 被写入，组件定义一个字节没变

### Requirement: 对齐与分布

系统 MUST 提供六项对齐（左、水平居中、右、上、垂直居中、下）与两项分布（水平等距、垂直等距），
作用于多选。

对齐的基准 MUST 是**选区整体包围盒**，MUST NOT 取「最先选中的那一个」——选择顺序在屏幕上看不
见，用户无法预测结果落在哪里。

分布 MUST 保持首尾两个对象不动，只调整中间的间距：两端是用户已经摆好的位置。

八项动作 MUST 注册进命令词汇表（`prompt` 为 `null` 的退化会话），否则会出现「面板里有、命令行
敲不出来」的动作。选区不足时 MUST **说出来**而不是静默——对齐至少两个对象、分布至少三个。

说明走会话的 `rejected` 而不是描述符上的 `disabledReason`：后者是定义上的**静态**字段，让它
跟着选区变要在每次选区变化时重建整张注册表，而 `VERTEX` 的「候选不是恰好一个」早已用
`rejected` 回答了同一个问题。

分布按**边到边的间隙**等距而不是按中心等距：后者在尺寸不一时看起来仍然疏密不均，而用户说的
「排匀」指的是空隙。

锁定的对象 MUST NOT 被移动，且 MUST 计入基准的求解：它在屏幕上占着那块位置。

#### Scenario: 左对齐取选区包围盒

- **WHEN** 按不同顺序选中同一组对象并左对齐
- **THEN** 结果相同，全部贴到选区包围盒的左边

#### Scenario: 水平分布保持两端

- **WHEN** 对四个对象执行水平等距分布
- **THEN** 最左与最右不动，中间两个等距排开

#### Scenario: 选区不足时说明

- **WHEN** 只选中一个对象并执行对齐
- **THEN** 命令以 `rejected` 说明至少需要两个对象

### Requirement: 导线每取一个点就落地

`WIRE` MUST 在取到**第二个点**时就把这条导线交给宿主建出来，此后每取一个点 MUST 产出一次
**替换**：同一个 Entity 的几何多一个顶点。产出 MUST 仍然是**一个** Entity——中间的拐点若
落成两条线的两个自由端，符号一挪接头就裂开，而那正是导线不照抄 `LINE` 逐段落地的理由。
本条改的是**什么时候写进文档**，不是**产出几个 Entity**。

攒到结束才提交的症状是：用户点了两下、三下，画布上只有一条预览，场景树里什么都没有，属性
面板也没有可看的东西——而他已经确定了那几个点。

效果 MUST 能说出这两件事，且 MUST 是两个字段：

- **替换而不是新建**：这一步的曲线替换本次会话上一个建出来的 Entity 的几何。引擎建不了
  Entity 也记不住 id，因此它只说意图，是哪一个由记着那份栈的宿主决定——与既有的
  `undoLastCreated` 是同一条边界。
- **这一条还没画完**：宿主据此跳过**接入节点**。中途路过另一条导线不是接线意图，先建节点、
  把对方劈成两段，下一下又走开，留下的是一个谁也没接的孤儿节点，而对方的线已经被切开了。

两个标记 MUST NOT 合并：最后一步同时是「替换」与「画完了」，而中间每一步两者都成立。

`U` MUST 对称地把已落地的几何收回一个顶点；收到只剩一个点时 MUST 产出「删掉我建的那一个」
而不是留下一条一个顶点的线。

`WIRE` 的取消 MUST 带上「删掉我建的那一个」——`Escape` 在会重开的命令里的第一级是「放弃
这一条」，而这一条已经在文档里了，不删掉的话屏幕上留下的是半条线。

预览 MUST 只画**待定的那一段**（与 `LINE` 同一条规则），MUST NOT 画到目前为止的完整几何：
已落地的部分是真的 Entity、由渲染器画，预览再画一遍就是同一条线画两遍，而两条的墨色与线宽
不同，叠出来读不出哪一条是结果。「预览含已取的全部点」那一条 MUST 继续只约束攒到结束才提交
的命令（`PLINE`）。

#### Scenario: 第二个点就产出一条可落地的曲线

- **WHEN** `WIRE` 取到第二个点
- **THEN** 这一步的提示里带着一次提交，其中含一条两顶点的曲线与导线标记
- **AND** 该提交没有「替换」标记（此刻还没有可替换的对象），但有「还没画完」标记

#### Scenario: 第三个点起是替换而不是新建

- **WHEN** `WIRE` 取到第三个点
- **THEN** 这一步的提交含一条三顶点的曲线，并同时带着「替换」与「还没画完」两个标记

#### Scenario: 结束那一步不再是「还没画完」

- **WHEN** `WIRE` 取过三个点后确认结束
- **THEN** 提交效果含三顶点的曲线与「替换」标记，且 MUST NOT 带「还没画完」标记

#### Scenario: 放弃上一点把几何收回去

- **WHEN** `WIRE` 取到第三点后键入放弃关键字
- **THEN** 这一步的提交含一条两顶点的曲线与「替换」标记，会话继续等待下一点

#### Scenario: 放弃到只剩一个点时删掉那条线

- **WHEN** `WIRE` 取到第二点后键入放弃关键字
- **THEN** 这一步的提交是「删掉我建的那一个」，且不含任何曲线

#### Scenario: 取消时说出要删掉哪一条

- **WHEN** `WIRE` 已经取过两个点，会话收到取消
- **THEN** 取消结果带着「删掉我建的那一个」

#### Scenario: 一个点都没取过的取消不带效果

- **WHEN** `WIRE` 只取过第一个点，会话收到取消
- **THEN** 取消结果不带任何效果

#### Scenario: 预览只有待定的那一段

- **WHEN** `WIRE` 取过三个点后以第四个候选点查询 `preview`
- **THEN** 返回的几何是从第三个点到候选点的那**一段**，而不是四个顶点

### Requirement: 轴对齐曲线的夹点求解

夹点求解 MUST 接受一个「这条曲线的每一段都必须保持轴对齐」的选项。**引擎不认识导线**——
「是不是导线」由宿主注入，与「一个 Entity 能不能几何编辑」走同一条既有边界；引擎只按这个
选项约束自由度。

开着时，**段夹点的位移 MUST 只取垂直于该段的分量**，平行分量 MUST 丢掉。平行平移会让两头
的相邻段各自变斜（它们与这一段垂直，共用的那个端点一沿段方向走就不再对齐）；垂直平移只让
相邻段伸缩，两个自由端一动不动。

垂直分量 MUST 由该段自己的方向求出，MUST NOT 写成「横段只改 y、竖段只改 x」的二选一：那份
写法在一条已经斜了的段上没有答案，而几何编辑的入口不保证曲线一定是正交的（导入、旧文档、
别的路径都可能留下斜段）。按方向投影在轴对齐那一档恰好退化成同一个结果。

投影 MUST 只作用在**有相邻段**的段上。一段都没有邻居时（单段折线、两点直线）平移不可能让
任何东西变斜，那一档就是「平移整条线」——一律投影会让一条两顶点的导线再也沿不了自己的方向
走，而那个限制没有任何理由。

关着时（默认）求解 MUST 一个字节不变：普通多段线的段照常两个方向都能平移。

引擎 MUST 另提供一个纯谓词：某个夹点是不是**开放折线的内部顶点**。宿主据此对导线不画那些
夹点——正交折线上的内部拐点一个自由度都没有，而夹点 id 的语法住在引擎里，宿主按前缀自己解析
等于把语法复制出去，下一次改 id 的人只会改到其中一处。

#### Scenario: 段夹点只取垂直分量

- **WHEN** 开着该选项，把一条三顶点直角折线中间那一段（水平）的夹点拖到一个既偏上又偏右的点
- **THEN** 该段的两个端点只在竖直方向上移动了，水平坐标一个都没变
- **AND** 相邻两段仍然竖直

#### Scenario: 关着时平行分量照常生效

- **WHEN** 不开该选项做同一次拖动
- **THEN** 该段的两个端点在两个方向上都移动了

#### Scenario: 端段同样只取垂直分量

- **WHEN** 开着该选项拖第一段（它的一端是自由端）的夹点
- **THEN** 该段仍与原来同向，自由端只跟着垂直方向走

#### Scenario: 没有相邻段时不投影

- **WHEN** 开着该选项拖一条**两顶点**折线唯一那一段的夹点
- **THEN** 两个顶点在两个方向上都跟着走，与「平移整条线」逐字相同

#### Scenario: 斜段按它自己的方向投影

- **WHEN** 开着该选项拖一条斜段的夹点
- **THEN** 位移里被保留的是垂直于该段方向的那个分量，而不是某一根坐标轴

#### Scenario: 内部顶点谓词按 kind 分派

- **WHEN** 询问一条三顶点开放折线的各个夹点
- **THEN** 中间那个顶点为真，两个端点顶点与两个段夹点都为假
- **AND** 一条两点直线的起点、终点与中点夹点都为假

### Requirement: 两条导线合并成一条

系统 MUST 提供一次把两条在同一点相接的导线合并成**一条**的规划：两条的顶点在相接点接起来、
两条各自的**远端绑定** MUST 原样保留、被并掉的那条 Entity MUST 在同一个事务里删除。

它有**两个触发点**，两个都 MUST 实现——同一条规则的两半，缺任一半那张图就还是有两种形态：

1. **画的时候**：取点落在另一条导线的**自由端**上（见「取点落在导线上即接入节点」）。
2. **删的时候**：节点的支路数降到 2（见「节点在支路不足时自删」）。

留下来的那一个 MUST 是**图上先有的**那一条：它的 id、名称与全部呈现（描边、虚线、marker 与
Preset）保持不变，挂在它身上的动画轨道与数据绑定也跟着留下。触发点决定这句话落到谁头上——
画的时候被删掉的是**本次刚画出来**的那条（它还没有任何东西可失去），节点清理时两条都是既有的，
因此取场景树里**更靠前**的那一个。需要一条确定的规则，是因为两条的呈现可能各是各的，而「合并
之后这条线是什么颜色」必须能从图上读出来；取顶点数更多的那一条会要求用户在脑子里比一个他看不见
的量。

两端各碰到一条时 MUST 留下 `start` 那一侧碰到的，另一条与本次画的那条一起删掉。

相接点 MUST 作为一个顶点留下，MUST NOT 因为两侧共线就消解掉：一次画出的 A→B→C 是三个顶点，
分两次画出的 A→B、B→C 合并之后也 MUST 是三个顶点——这条规则的**全部目的**就是让两种画法产出
逐字相同的文档，顺手消解共线点只是把这两种画法重新分家、分在了另一处。

推论写在明处：搭接再删掉搭上去的那条之后，被断开的两半合回**一个** Entity，但那一点作为一个
**共线顶点**留着，`kind` 也从 `line` 变成了两段的 `polyline`。图上逐像素相同、Entity 数目回到
搭接之前，而文档不是逐字回滚——真正的逐字回滚是撤销，那条路一直都在。

被并掉的那条 MUST 按需要**反转顶点序**：相接点可能是它的首顶点，也可能是末顶点。

以下三种情形 MUST NOT 合并：

- 两条支路其实是**同一条导线**的两端——合并会把它接成一个环；
- 两者**跨父级**——导线与它绑定的实体 MUST 同父级，合并会把远端绑定带到另一个父级下；
- 相接点上还有**第三样东西**（第三条支路、一个端口）——那一点是一个真实的连接点。

合并 MUST 与触发它的那一步在同一个事务里，撤销 MUST 一步回到合并之前。事务标签 MUST 说明这是
一次合并：合并删掉了一个 Entity，操作日志读不出这件事时，用户只会看到场景树里少了一行。

合并后两端都自由、而留下来那条**本来就没有** `Wire` 时，MUST NOT 在 `entity.curve.set` 上写
`wire: null`——那条命令上的 `null` 是「把这个 Component 去掉」，而去掉一个不存在的 Component 会
让**整条批次**被拒（`patch.invalid-path`）。批次是原子的，因此症状是整次合并静默地什么都没发生，
而两端都自由正是一张图上最常见的状态（先画线、后接符号）。缺席时 MUST 不写这个字段，与新建路径
「缺席即不动 `Wire`」一致。这条对剪断同样成立。

#### Scenario: 两条合成一条，两端的绑定都在

- **WHEN** 两条导线在一点相接，一条的远端绑着符号 A 的端口、另一条的远端绑着符号 B 的端口，
  这一点被合并
- **THEN** 文档里只剩一条导线，它的一端绑着 A、另一端绑着 B
- **AND** 另一条 Entity 已被删除

#### Scenario: 相接点留下来

- **WHEN** 合并 A→B 与 B→C 两条导线
- **THEN** 产出的导线有三个顶点 A、B、C
- **AND** 它与一次画出 A→B→C 得到的几何逐字相同

#### Scenario: 顶点序按需反转

- **WHEN** 被并掉的那条导线的**首**顶点就是相接点
- **THEN** 它的顶点在接进去之前被反转，产出的折线不自交、不折返

#### Scenario: 同一条导线的两端不合并

- **WHEN** 一条导线的首尾两端都接在同一点上
- **THEN** 不合并，文档不变

#### Scenario: 本来没有 Wire 时不写 wire 字段

- **WHEN** 合并两条两端都自由、都不带 `Wire` 的导线
- **THEN** 写出的 `entity.curve.set` 不含 `wire` 字段
- **AND** 合并真的发生了，而不是被整条批次的拒绝静默吞掉

#### Scenario: 合并一步撤销

- **WHEN** 一次合并完成后按撤销
- **THEN** 两条导线与它们各自的绑定回到合并之前

### Requirement: 剪断导线的一段

系统 MUST 提供一次「去掉曲线的某一段」的规划：那一段的两个顶点之间的**整段**从图上消失，左半
留在原 Entity 上（id 不变，选中与撤销都还认得它），右半是一个新 Entity。两半 MUST 各自继承
**全部呈现**；目标是导线时还 MUST 各自继承靠近自己那一端的绑定，并在剪口那一端各是一个自由端。

**去掉的 MUST 是整整一段，MUST NOT 在一个点上断开。**在一点上断开产出的是两个**重合**的自由端
——屏幕上与没剪之前逐像素相同，而那正是假接头的样子：用户按了一个键，图上什么都没有变化，他无从
判断这次操作成没成功。去掉整段留下一个看得见的缺口，那是这次操作唯一的反馈。

开放折线上剪断 MUST 只在**中间段**上成立。端段与只有一段的曲线 MUST 拒绝并说明：端段去掉就是把
外侧那个端点删掉，而那已经有入口（点亮外侧的端点方块按 `Delete`）；只有一段的曲线去掉那一段
就是删掉整条线，而那也已经有入口（不点亮任何夹点直接按 `Delete`）。给同一件事造第二个入口，
代价是用户读不出这两个键位有什么区别。

**闭合折线去掉任何一段 MUST 变成开放折线**：仍是同一个 Entity，`closed` 置 `false`，顶点从缺口处
重排；矩形去掉一条边就是三段折线。

剪断 MUST 对**所有 `line` / `polyline` 曲线**成立，MUST NOT 只对导线成立。此前「普通曲线是一个
形状，剪成两个是分割」那条被推翻：矩形的一条边要让给符号、六边形要开一个口，正是抓着一段时想做
的事。「这是不是导线」仍 MUST 由宿主注入，但它只决定**绑定怎么继承**与剪到节点时要不要触发
支路清理——引擎不认识导线，与夹点求解的轴对齐选项是同一条既有边界。

剪断 MUST 是一个事务、一步撤销。两端都自由、而 `Wire` 本来就不在时 MUST NOT 写 `wire: null`。

#### Scenario: 中间段剪断成两条

- **WHEN** 剪断一条四顶点导线的中间那一段
- **THEN** 文档里多出一条导线，两条各有两个顶点
- **AND** 两条各自保留原来那一端的绑定，剪口两端都是自由端
- **AND** 两条的描边、虚线、marker 与 Preset 与原来那条相同

#### Scenario: 剪口留下看得见的缺口

- **WHEN** 剪断一条导线的中间段
- **THEN** 左半的末顶点与右半的首顶点不重合，两者相距原来那一段的长度

#### Scenario: 端段拒绝

- **WHEN** 在一条三顶点导线的第一段上要求剪断
- **THEN** 拒绝并说明只有中间的段可以剪断，几何不变

#### Scenario: 只有一段的导线拒绝

- **WHEN** 在一条两顶点导线的唯一一段上要求剪断
- **THEN** 拒绝并说明，几何不变

#### Scenario: 普通折线也能剪

- **WHEN** 宿主没有声明目标是导线，在一条四顶点折线的中间段上要求剪断
- **THEN** 折线断成两条，两条都不带 `Wire`

#### Scenario: 矩形去掉一条边

- **WHEN** 在一个矩形（四顶点闭合折线）的任一段上要求剪断
- **THEN** 它变成三段开放折线，仍是同一个 Entity，一步撤销回到矩形

### Requirement: TRIM 命令去掉光标底下的一截

绘图命令集 MUST 包含 `TRIM`（别名 `TR`，编辑分组），MUST 复用 `@compose-ui/commands` 的四态
推进。它 MUST NOT 有单键快捷键：`T` 已归文字工具，给一个记不住的键比不给更差，与 `POLYGON`
同一条。

它每一步 MUST 只接受 `pick`；每次收到 `pick` MUST 交出一个 `commit`（`trim: targets`）且提示
不变、继续等下一截——与 `COPY` 连续放置同形。`accept` 与 `cancel` 结束会话。它 MUST NOT 读启动
上下文里的选择集：没有「先选切割边」这一档，图上所有曲线都是切割边。

**截的解算 MUST 是一个纯函数**（`resolveStageTrimPiece`），悬停预览与落地 MUST 读同一份——
否则「看见的那一截」与「掉的那一截」不是同一截。规则：从落点在该曲线上的位置向两边走，先遇到
**交点**就停在交点，其次**顶点**，其次**端头**；两侧都是端头即整条。弧上按扫掠方向走，整圆首尾
相接——整圆上只有一个交点时 MUST 拒绝并说明：一个点剪不开一个圈。

交点 MUST 按**世界坐标**求：各曲线投影到盒、再乘世界矩阵，与命中、框选、特征点同一条链。
切割边 MUST 是任何带 `Curve` 的可见 Entity，含导线、含**自己**（折线自交时另一段也是边界）；
`path` 作为切割边 MUST 拍扁。T 形相接（一条线的端头落在另一条线身上）MUST 算交点。
「这个 Entity 是不是切割边」MUST 由宿主注入——引擎不认识接线点。

落地 MUST 走 `planStageWireCut` 同一条路径：左半留原 Entity、右半新建、呈现整份复制；导线的
绑定跟着被去掉的那一截走（含端口那一截去掉即那一端解绑），剪到节点时既有的支路清理与合并
MUST 在同一个事务里发生。一次 `pick` 的全部目标 MUST 是一个事务、一步撤销。

MUST 拒绝并说明的四档互不相同：锁定、`GeometryConstraints.resize: 'none'` 的曲线、不带 `Curve`
的 Entity、`path`。

#### Scenario: 两线相交去掉交点一侧

- **WHEN** 一条横线被一条竖线穿过，`pick` 落在横线交点右侧
- **THEN** 横线的终点挪到交点，竖线不变，仍是一个 Entity

#### Scenario: 线穿过矩形挖掉中间

- **WHEN** 一条线穿过一个矩形，`pick` 落在矩形内的那一截
- **THEN** 那一截消失，线变成两个 Entity，矩形不变

#### Scenario: 圆变成弧

- **WHEN** 一条线穿过整圆，`pick` 落在圆的一侧
- **THEN** 该 Entity 的 `Curve` 仍是 `arc`，扫掠角变成 180

#### Scenario: 矩形的一条边

- **WHEN** `pick` 落在一个没有任何交点的矩形的一条边上
- **THEN** 那条边消失，矩形变成三段开放折线，仍是同一个 Entity

#### Scenario: 一段上多个交点只掉最近一格

- **WHEN** 一条横线被三条竖线穿过，`pick` 落在第一与第二条竖线之间
- **THEN** 只有那一格消失，横线变成两个 Entity

#### Scenario: 孤线整条删除

- **WHEN** `pick` 落在一条与任何东西都不相交的单段直线上
- **THEN** 该 Entity 被删除

#### Scenario: 剪到节点触发合并

- **WHEN** T 形接线的支路被 `pick`，支路的一端绑着节点、另一端绑着符号端口
- **THEN** 支路消失，节点只剩两条支路，两条在同一个事务里合并成一条

#### Scenario: 一笔多截一个事务

- **WHEN** 一次 `pick` 带四个目标
- **THEN** 四截在同一个事务里消失，撤销一步全部回来

#### Scenario: 接线点不是切割边

- **WHEN** 一条导线的末端绑着节点，`pick` 落在该导线上
- **THEN** 解算出的截以导线自己的顶点为界，MUST NOT 在节点圆周处多出一截

#### Scenario: 四种拒绝互不相同

- **WHEN** 依次对锁定的曲线、接线点、文字与 `path` 曲线 `pick`
- **THEN** 得到四种互不相同的拒绝原因，文档不变

### Requirement: HATCH 命令填满光标底下那块面

`stage-engine` MUST 提供命令 `HATCH`（别名 `H`，绘图分组）。它的唯一一步 MUST 接受 `pick`
并读它的**落点**，提示 MUST 声明 `badge: 'bucket'`。

图上**所有可见曲线**自动是边界，MUST NOT 要求用户先选。候选 MUST 排除：接线点（复用既有的
`isJunction` 谓词——它是坐在导线端点上的一个记号，当边界会在每条支路末端啃出一个记号大小的缺口）、
以及**其他填充**（填充自己没有描边，拿一个用户看不见边的东西当边界是最难自己发现的一类缺陷）。

命令 MUST NOT 在提交后结束：与 `TRIM` 同一条，会话留着继续填下一块，`accept` 与 `cancel` 结束它。

不给单键快捷键：七个绘图裸字母已经占满，与 `TRIM` 同一条判断。

#### Scenario: 点在一块封闭的面内

- **WHEN** `HATCH` 进行中，用户在一块由若干可见曲线围出的封闭区域内点一下
- **THEN** 该区域被填上当前颜色，命令留在原提示等待下一次取用

#### Scenario: 接线点不当边界

- **WHEN** 候选曲线里含接线点
- **THEN** 求面时忽略它们

#### Scenario: 已有的填充不当边界

- **WHEN** 候选曲线里含带 `Hatch` 的 Entity
- **THEN** 求面时忽略它们

### Requirement: 世界形状换算是修剪与填充的共享入口

「盒局部几何 → 世界空间的线段与弧」这一段换算 MUST 只有一处实现，`TRIM` 与 `HATCH` MUST 共用它
（今天它是 `curve-trim.ts` 的内部函数）。各写一份必然漂移，而漂移的症状是两条命令对同一张图
求出不同的交点。

#### Scenario: 两条命令求出同一组交点

- **WHEN** 同一张图上，修剪与填充都需要某两条曲线的交点
- **THEN** 两者得到相同的交点

### Requirement: 填充解算有三支，由边界与图上那块墨决定

`stage-engine` MUST 提供一个解算入口，悬停预览与落地 MUST **共用**它——否则「看见的那块面」与
「填出来的那块面」不是同一块。

解算结果 MUST 是三支之一，按下列**次序**判定：

- **改一块已有填充的颜色**：当这块面重求出来的几何，与某个带 `Hatch` 的 Entity 的几何
  **逐位相同**时。此时 MUST 写那个 Entity 的 `Appearance.backgroundPaint`，
  MUST NOT 新建任何东西——否则对同一块面再点一次会在原来那块上面**叠一块**，两块几何逐像素
  重合、下面那块再也点不到，而屏幕上看起来只是换了个颜色。
- **改某个 Entity 的填充**：当这块面的边界恰好是**某一个 Entity 的完整几何**时（它自己闭合，
  且没有被任何交点切开）。此时 MUST 写那个 Entity 的 `Appearance.backgroundPaint`，
  MUST NOT 新建任何东西——否则拿桶点一个没有任何东西穿过的矩形，会得到一个与它逐像素重合的新
  对象压在下面。
- **新建一个填充 Entity**：其余情形。它 MUST 带 `Curve` 与 `Hatch`，MUST 插在**最靠后的那条
  边界之下**——否则填充会盖住区域内的符号。层序 MUST 由 `entity.create` 载荷上的 `index` 表达，
  MUST NOT 用第二条命令，这样层序与创建在同一个事务里。

**次序 MUST 是上面这个**：两者可能同时成立（一块填充盖着一个本身就闭合的矩形）。
此时用户看见的那块色**就是**那块填充，而先走「改某个 Entity 的填充」会去写矩形自己的
`backgroundPaint`，结果是两块墨叠在一起、上面那块还是旧颜色——屏幕上看起来什么都没发生。

「逐位相同」MUST 在**落地写入用的那个空间**里比较（父级局部、归一化之后）：存着的 `Curve`
就是那么写进去的。求解是**确定性的**，同一份输入给出逐位相同的结果，因此这不是一次浮点比较，
而是在问「这一次求出来的，是不是上一次求出来的那一个」。

判据 MUST NOT 是「落点落在某块填充的墨里」：一块填好的面被一条新线劈成两半之后，老填充的锚点
落在其中一半里，按「墨里」判会让点那一半改**整块**老填充的颜色、点另一半却新建——同一个手势
在左右两边给出两种行为，而屏幕上没有任何东西解释为什么。

判据 MUST 是「**完整**几何」而不是「都来自同一个 Entity」：自交的折线两个环都出自它自己，
而写它的 `backgroundPaint` 会把**两个**环一起填上，不是用户点的那一个。

目标 Entity 锁定时 MUST 拒绝并说明，MUST NOT 退回去新建一个——「你锁了它」和「我给你造了个新的」
是两件事，后者会让锁形同虚设。这对前两支都成立。

一次取用 MUST 产出一个事务。

#### Scenario: 对已经填过色的那块面再点一次

- **WHEN** 落点落在一块已有填充所覆盖的那块面里，且这块面重求出来的几何与它逐位相同
- **THEN** 只写那块填充的 `Appearance.backgroundPaint`，文档里不新增任何 Entity

#### Scenario: 填充盖着一个完整的矩形时，改的是填充

- **WHEN** 一块填充的几何与它下面那个闭合矩形逐像素重合，用户对它再点一次
- **THEN** 改的是那块填充的颜色，而不是矩形自己的 `backgroundPaint`

#### Scenario: 面被劈开之后不再是同一块

- **WHEN** 一块已填好的面被一条新画的线劈成两半，用户点其中任意一半
- **THEN** 两半都走新建那一支——重求出来的几何与那块老填充不再相同

#### Scenario: 边界恰好是一个矩形

- **WHEN** 落点落在一个没有任何曲线穿过的闭合矩形内部
- **THEN** 该矩形自己的 `backgroundPaint` 被写入，文档里不新增任何 Entity

#### Scenario: 边界是拼出来的

- **WHEN** 落点落在由一个矩形与一条穿过它的直线共同围出的半边里
- **THEN** 新建一个带 `Curve` 与 `Hatch` 的 Entity，矩形与直线一个字节不动

#### Scenario: 新建的填充压在边界之下

- **WHEN** 一次取用产出了新的填充 Entity
- **THEN** 它在父级子列表里的位置排在最靠后的那条边界之前

#### Scenario: 自交折线走新建那一支

- **WHEN** 落点所在的面，其边界全部来自同一条**自交**的折线
- **THEN** 走新建那一支，而不是写那条折线的填充

#### Scenario: 目标锁定时拒绝

- **WHEN** 边界恰好是一个 Entity 的完整几何，而该 Entity 已锁定
- **THEN** 解算返回拒绝并说明原因，不新建任何东西

#### Scenario: 已有填充锁定时拒绝

- **WHEN** 落点所在的那块面上压着一块**已锁定**的填充
- **THEN** 解算返回拒绝并说明原因，MUST NOT 退回去新建一块

#### Scenario: 不封闭时拒绝并给出断口

- **WHEN** 落点所在的区域没有封闭
- **THEN** 解算返回拒绝，并带上走不下去的那个节点的位置

### Requirement: Group 命中先选组，双击穿过一层

`stage-engine` MUST 提供一个纯函数解算（`resolveStageGroupHit`），把指针命中的最深 Entity 按
Group 门槛解算成这次按下真正作用的对象。规则 MUST 只有三条：

- **单击选中最外层还没进入的 Group**：命中项的祖先链上，所有「是 first-class Group 且不是当前
  选区任何一项的严格祖先」的那些是门槛，取最外层的一个；没有门槛就是命中项自己。
- **双击穿过一层**：落到那个门槛的**直接子级**（沿命中链往下一格）。它可能仍是一个 Group，于是
  下一次双击再进一层；也可能就是命中项本身。解算 MUST 报告这一下是不是下钻（`descended`）。
- **深选无视门槛**：`command` 修饰键按下时直接是命中项。

「已进入」MUST 从选区派生，MUST NOT 另存状态：选区里任何一项的**严格**祖先都算进入过；
选中 Group 自己 MUST NOT 算进入（它不是自己的严格祖先）。复合地址（实例内部）MUST 按宿主
实例算祖先链。选区里已不在文档中的 ID MUST NOT 参与判定。

锁定的门槛 MUST NOT 下钻：不论连击计数，解算成那个 Group 自己，交给收敛规则按锁定处理。

判据 MUST 只读 first-class Group；容器（Frame、Auto Layout 容器）MUST NOT 是门槛。

四个读实体命中的插件（容器体收敛、空心移动兜底、几何编辑兜底、实体选中并拖动）MUST 读同一个
解算结果，MUST NOT 各自按裸命中判断。

#### Scenario: 单击 Group 深处的对象选中最外层 Group

- **WHEN** 选区为空，用户单击 `outer(Group) › inner(Group) › leaf` 里的 `leaf`
- **THEN** 解算结果是 `outer`，且不是下钻

#### Scenario: 双击穿过一层

- **WHEN** 选区是 `outer`，用户在 `leaf` 上双击（连击计数为 2）
- **THEN** 解算结果是 `inner`，且标记为下钻

#### Scenario: 已进入的 Group 不再是门槛

- **WHEN** 选区是 `inner`（`outer` 因此已进入），用户单击 `outer` 的另一个子级 `sibling`
- **THEN** 解算结果是 `sibling`

#### Scenario: 选中 Group 自己不算进入

- **WHEN** 选区是 `outer`，用户单击 `sibling`
- **THEN** 解算结果仍是 `outer`

#### Scenario: 深选无视门槛

- **WHEN** 用户按住 `command` 单击 `leaf`
- **THEN** 解算结果是 `leaf`

#### Scenario: 锁定的门槛不下钻

- **WHEN** `outer` 锁定，用户在 `leaf` 上双击
- **THEN** 解算结果是 `outer`，且不是下钻

#### Scenario: 复合地址按宿主实例算进入

- **WHEN** 选区是 `sibling/part`（下钻进实例 `sibling` 内部的复合地址），用户单击 `sibling`
- **THEN** `outer` 算已进入，解算结果是 `sibling`

### Requirement: Escape 退出分组的解算

`stage-engine` MUST 提供一个纯函数解算（`resolveStageGroupExit`），求当前选区**共同**的最近
first-class Group 严格祖先：选区里每一项各取最近的 Group 祖先，全部相同时返回它，否则返回
`null`。复合地址（实例内部）MUST 按宿主实例算；已不在文档中的 ID MUST NOT 参与；选区为空
MUST 返回 `null`。

#### Scenario: 单选回到上一层

- **WHEN** 选区是 `outer(Group) › inner(Group) › leaf` 里的 `leaf`
- **THEN** 解算结果是 `inner`；选区是 `inner` 时结果是 `outer`

#### Scenario: 没有更外层的 Group

- **WHEN** 选区是 `outer` 或一个不在任何 Group 里的对象
- **THEN** 解算结果是 `null`

#### Scenario: 多选只认共同的最近 Group

- **WHEN** 选区是 `inner` 与 `sibling`（都直接在 `outer` 里）
- **THEN** 解算结果是 `outer`
- **AND** 选区是 `leaf` 与 `sibling` 时结果是 `null`

### Requirement: 取点效果携带命中

绘图取点插件交给宿主的 `drafting.point` 效果 MUST 携带这次按下的命中（`hit`），与世界坐标并列。
引擎在任何命中类型上都接管取点，但「按在谁身上」只有持有会话的宿主才用得上——热夹点下按在别的
Entity 上是换对象还是取点，由宿主按捕捉结果判定。

#### Scenario: 效果带上命中

- **WHEN** 命令正在等一个点，用户在一个 Entity 上按下
- **THEN** `drafting.point` 效果的 `hit` 是那个 Entity 的命中，`point` 是按下的世界坐标

