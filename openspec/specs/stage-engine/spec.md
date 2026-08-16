# stage-engine Specification

## Purpose
TBD - created by archiving change extract-stage-interaction-engine. Update Purpose after archive.
## Requirements
### Requirement: 无 React 的 Stage Engine 包

Stage Engine MUST 继续只依赖 `@compose-ui/core`，并 MUST 接受 core 定义的 Layout Snapshot 协议而
不得依赖 layout-engine 或 Yoga。

#### Scenario: 独立消费已解析布局
- **WHEN** 非 DOM 消费者提供 v6 document 与合法 Snapshot
- **THEN** 可以计算世界几何、吸附与空间命令
- **AND** 构建产物不包含 Yoga、WASM、React 或 DOM 类型

### Requirement: Headless 交互 Controller

系统 MUST 提供实例级 `StageInteractionController`，使用普通数据事件、不可变 snapshot 和 surface effect port
表达 pan、marquee、move、resize、rotate、guide、external drag 与 draw。一个 controller MUST 同时只允许一个
surface 连接。

#### Scenario: 连接并驱动 surface

- **WHEN** 宿主连接一个 surface、更新受控 context 并发送 Pointer 事件
- **THEN** controller 发布对应 phase 与 preview snapshot
- **AND** viewport、selection、pointer capture、绘制提交和命令请求通过 effect port 返回

#### Scenario: 拒绝第二个同时连接的 surface

- **WHEN** 同一 controller 已连接 surface 且另一个 surface 尝试连接
- **THEN** connectSurface 明确抛错
- **AND** 原连接与活动交互保持不变

### Requirement: 手势预览与原子提交

StageInteractionController MUST 在 session 开始冻结 Layout Snapshot。Flow move preview MUST 使用
resolved box 转为 Absolute 后应用位移；Fill resize preview MUST 把活动 axis 视为 Fixed。Cancel
MUST 丢弃全部布局意图 preview，pointerup MUST 请求最多一个命令或 batch。

并发的文档或布局变化 MUST 中止引用 Entity 的空间手势（移动、缩放、旋转、端点、Paint），
但 MUST NOT 中止绘制手势——绘制只由世界坐标定义，不引用任何 Entity。退出文字编辑时删除空文字
会在同一次指针按下里改动文档，若一并中止，紧接着开始的绘制会当场消失。工具切换仍然中止绘制。

#### Scenario: 混合选择移动并取消
- **WHEN** Flow 与 Absolute 混合选择开始移动后收到 Escape
- **THEN** preview 中的 positioning 与 offset 全部清除并恢复原 Snapshot
- **AND** surface 不收到 dispatch effect

#### Scenario: 绘制中途的文档变化不打断手势

- **WHEN** 绘制手势进行中，文档因删除其他 Entity 而变化
- **THEN** 绘制手势保持进行，松手仍然请求一次 `drawing.commit`
- **AND** 同样情况下的移动手势仍然被中止

### Requirement: 输出区域检查命中

controller MUST 接受独立的 output hit，并通过 output selection effect 请求宿主检查隐式 Canvas。
输出检查不得写入 selectedIds；节点、resize、rotate、guide 和平移命中 MUST 保持原优先级。

#### Scenario: 点击与框选输出区域

- **WHEN** 选择工具在输出区域空白处按下并松开
- **THEN** controller 清空节点选择并请求检查 output
- **AND** 从输出区域拖出有效框选后改为返回命中的节点选择

#### Scenario: 平移不切换检查目标

- **WHEN** pan 工具、Space 临时平移或中键从输出区域开始
- **THEN** controller 只更新 viewport
- **AND** 不发送 output selection effect

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
与 Fill 转换；Group/Ungroup MUST 为 Flow 目标返回稳定不可用原因。Group MUST 只接受同一直接父级、
顶层、Absolute、未锁定选择，并通过 Core Group seed 创建 `Composition.presetId: "group"` 的无外观
结构 Entity，保持世界几何、sibling 顺序和 Undo/Redo。Ungroup MUST 拒绝普通 Container，但允许
first-class Group 与精确匹配旧 Group seed 的 `presetId: null` 兼容结构。

#### Scenario: Scene Tree 跨布局移动

- **WHEN** 节点从 free parent 移入 Layout、在 Layout 间移动或移出到 free parent
- **THEN** 分别得到 Flow、保持 Flow、或烘焙 Absolute 的确定 LayoutItem
- **AND** 一个 Undo 恢复 parent、index 与全部原 authoring 值

#### Scenario: 成组生成 first-class Group

- **WHEN** 用户对同一 free parent 下的两个或更多顶层 Absolute 节点执行 Group
- **THEN** planner 生成无 Renderer/Appearance/Clip/Layout 的 `presetId: "group"` Entity
- **AND** 子项世界几何、相对顺序和一次 Undo/Redo 保持确定

#### Scenario: 限定解除分组

- **WHEN** 用户对普通 Container、first-class Group 或历史 Group 兼容结构请求 Ungroup
- **THEN** 普通 Container 返回稳定不可用原因
- **AND** 两类 Group 提升子项并保持世界几何

### Requirement: ECS 外部拖入

External descriptor MUST 统一使用 Entity Preset ID。Engine MUST 只负责世界定位和最深合法
Hierarchy 命中，React adapter MUST 使用 Registry 创建 Entity seed。

#### Scenario: 拖入任意 Entity Preset

- **WHEN** 用户从 Palette 拖入 Container 或 Renderer Preset
- **THEN** drop effect 包含 presetId、世界点和合法 parentId
- **AND** Engine 不读取 Renderer props 或 React Definition

### Requirement: 受约束变换 System

Move、Resize 与 Rotate MUST 查询 Transform、Visibility、Lock 和 TransformConstraints。缺失约束
时保持当前自由变换；存在约束时 MUST 限制操作、Resize 轴、宽高比和尺寸区间。

#### Scenario: 使用全部 Resize 模式

- **WHEN** 选区分别配置 free、preserve-aspect、horizontal、vertical 和 none
- **THEN** Engine 只生成对应允许方向的 Transform preview
- **AND** pointerup 命令声明正确操作语义

#### Scenario: Core 与 Engine 一致拒绝锁定

- **WHEN** Entity 不可见、锁定或禁止目标变换
- **THEN** Engine 不开始对应手势且不产生命令 effect

### Requirement: 无 DOM Paint 编辑与图层采样会话

StageInteractionController MUST 通过普通数据 context、event、snapshot 和 effect 支持 Paint edit 与 sample；不得导入 React、DOM、Registry 或 Renderer。编辑仅限当前单选 target，pointer move 只产生 preview，pointer up 最多产生一个命令；取消和不兼容 context 更新不提交。

#### Scenario: 拖动旋转 Entity 的渐变 stop

- **WHEN** 用户拖动旋转或嵌套 Entity 的渐变控制柄
- **THEN** Engine 以逆世界矩阵换算局部 Paint 坐标并发布 preview
- **AND** pointer up 只提交一次完整 Paint

### Requirement: 基于图层的安全降级取色

Engine MUST 命中最深、最上层、可见且未被裁剪排除的 Entity。普通采样返回点击局部点的 Solid/Gradient 颜色；Alt/Option 采样返回完整 backgroundPaint。无可求值 Paint 的 Entity 不得产生文档命令。

#### Scenario: 采样被裁剪层与完整 Paint

- **WHEN** 用户在 Stage sample mode 点击被裁剪排除的层，或 Alt 点击可见 Gradient layer
- **THEN** 前者不会被采样，后者返回完整结构化 Paint
- **AND** 选择、viewport 和普通移动手势不改变

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

#### Scenario: 绘制 preview 与提交

- **WHEN** draw tool 从 surface 开始拖拽并正常松手
- **THEN** snapshot 在拖拽中发布预览 bounds，松手时发出包含 tool、bounds 与合法 parent 命中的 commit effect
- **AND** Engine 不创建 Entity 或读取 Preset 内容

#### Scenario: Shift 锁定正方形与正圆

- **WHEN** 用户使用 rectangle 或 circle 工具拖拽，并在 pointermove 与 pointerup 时按住 Shift
- **THEN** preview 与 `drawing.commit` MUST 使用相同的等宽高 bounds，当前鼠标点 MUST 保持为绘制终点，负向拖拽仍保持正确象限
- **AND** 约束只存在于 Headless Engine；松开 Shift 后恢复常规矩形或椭圆 bounds

#### Scenario: 绘制被取消

- **WHEN** draw gesture 收到 Escape、pointercancel、window blur 或失去有效 pointer capture
- **THEN** draw preview 被清理且不存在 commit 或 command dispatch effect

### Requirement: Headless 两点端点会话

StageInteractionController MUST 通过通用的两点端点 hit、`segmentPreview` snapshot 与 `segment.commit` effect
支持端点拖拽。该协议只包含 Entity ID 与世界坐标，MUST 不读取 Renderer、SVG、Registry、React 或 DOM；
surface 负责解释和持久化两点图形的业务含义。

#### Scenario: 端点预览与提交

- **WHEN** surface 为当前单选 Entity 发送端点 hit，并持续发送 pointermove
- **THEN** Controller 使用既有 grid/smart snap 规则更新 `segmentPreview`，不 dispatch 文档命令
- **AND** pointerup 最多发出一个包含最终首尾坐标的 `segment.commit` effect

#### Scenario: 端点会话取消

- **WHEN** 端点会话收到 pointercancel、Escape、window blur 或失去 pointer capture
- **THEN** `segmentPreview` 被清理
- **AND** 不发出 `segment.commit` 或文档命令 effect

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

#### Scenario: 一次拖拽产生三阶段

- **WHEN** 用户按下顶点、移动若干次、松开
- **THEN** 宿主依次收到一次开始、若干次移动与一次结束，每次都带当前世界坐标

#### Scenario: 拖拽期间文档不被引擎修改

- **WHEN** 用户拖动切线手柄
- **THEN** 引擎不产出任何文档 Patch

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

Stage Engine MUST 提供 `marquee` 工具值；该工具下 pointer 在节点上按下 MUST 起框而不是命中该
节点。`select` 工具 MUST 保持只在空白处起框。两个入口 MUST 使用受控传入的同一个
`StageMarqueeMode`，未传入时 MUST 回退 `intersect`。框选提交 MUST 按修饰键与已有选区组合：
无修饰键替换选区，Shift 与已有选区求并集，Alt 从已有选区中移除。框选 MUST 只发布瞬时
snapshot 与 selection effect，不得产生文档事务。

#### Scenario: 框选工具从节点上起框

- **WHEN** 工具为 `marquee` 且用户在一个可见节点上按下并拖动
- **THEN** controller 进入 marquee phase 并发布框选预览
- **AND** 不发生该节点的 move 手势

#### Scenario: 选择工具保持空白起框

- **WHEN** 工具为 `select` 且用户在一个可见节点上按下并拖动
- **THEN** controller 进入 move phase

#### Scenario: Shift 加选与 Alt 减选

- **WHEN** 已有选区存在且用户按住 Shift 完成一次框选
- **THEN** 框选结果与已有选区求并集
- **AND** 按住 Alt 完成框选时框选结果从已有选区中移除

#### Scenario: 未传入模式时回退相交

- **WHEN** 宿主未提供 `marqueeMode`
- **THEN** 判定使用 `intersect`

### Requirement: 画布拖拽 reparent 会话

StageInteractionController MUST 在 `move` 手势进行中持续判定指针下最深的合法容器（复用
`containerAtPoint` 并排除被拖动选区自身与其后代）。仅当指针进入该容器包围盒内部达到规定比例时才把它
记为候选 reparent 目标；贴边掠过 MUST NOT 触发，且 MUST NOT 使用停留计时作为额外或替代的触发条件。
候选目标 MUST 通过 snapshot 暴露供宿主渲染高亮（与 `previewTransforms`、`drawing` 等既有 preview
状态同一机制，而不是 effect），Controller 自身不持有渲染状态。未达到判定条件时 MUST 保持现有行为：
目标坐标在原父级内更新，不触发 reparent。

Pointer Up 时若存在候选 reparent 目标，Controller MUST 提交一次原子 reparent 命令并使用该目标已有
的 Flow/Absolute 默认判定（与 `createReparentCommand` 的 `targetManagesFlow` 规则一致），MUST NOT
新增拖拽手势内的 Flow/Absolute 选择分支，且 MUST NOT 同时发布 Transform 命令——一次手势只表达一个
结构意图。多选拖拽 MUST 按文档顺序提交以保持相对顺序，祖先/后代去重规则 MUST 与既有场景树批量移动
规则一致。Escape 与失去指针捕获时 MUST NOT 提交任何命令。

候选目标失效（锁定、被删除、变为无 Hierarchy）只能经由文档变化发生，而并发文档变化已由「手势预览与
原子提交」判定为不兼容并取消整个空间手势，因此该情形 MUST NOT 提交任何命令；Controller 仍 MUST 在
提交前复核目标有效性，避免未来新增的非文档路径产生指向已失效目标的命令。

#### Scenario: 指针进入容器内部触发候选高亮

- **WHEN** 拖动中的指针进入某合法容器包围盒内部达到判定比例
- **THEN** Controller 在 snapshot 中发布该容器为候选 reparent 目标
- **AND** 指针退出该区域后候选目标清除且不产生任何命令

#### Scenario: 贴边掠过不触发吸入

- **WHEN** 拖动中的指针只在容器边缘附近掠过，未进入内部达到判定比例
- **THEN** 不产生候选 reparent 目标
- **AND** Pointer Up 只更新目标在原父级内的坐标

#### Scenario: 提交 reparent 使用目标默认 Flow/Absolute 判定

- **WHEN** Pointer Up 时存在候选 reparent 目标
- **THEN** 提交的 reparent 命令按目标是否为 Layout 容器分别得到 Flow 或 Absolute 的 LayoutItem
- **AND** 不产生第二条独立命令来设置 Flow/Absolute

#### Scenario: 候选目标提交前失效则不提交

- **WHEN** 候选 reparent 目标在 Pointer Up 前被锁定、删除或经其他事务变为不再是合法容器
- **THEN** 该并发文档变化按既有手势原子性取消整个手势，不产生任何命令
- **AND** 不产生指向已失效目标的命令

### Requirement: Auto Layout 容器内原地重排

Controller MUST 支持 Auto Layout 容器内的原地重排。对 `flexWrap` 为 `nowrap` 的 Layout 容器，
`move` 手势拖动其 Flow 子级且指针全程未离开该容器边界时，Controller MUST 按指针在主轴上的位置与
各兄弟中点比较得到插入位置，Pointer Up MUST 只提交一次改变 `Hierarchy.childIds` 顺序的命令，MUST NOT 修改该 Entity 的 `LayoutItem`，MUST NOT 发布 Transform
命令。插入位置与拖动前顺序相同时 MUST NOT 提交任何命令。指针离开容器边界时 MUST 回退到既有的烘焙
Absolute 行为。`flexWrap` 为 `wrap` 或 `wrap-reverse` 的容器 MUST 保持现有行为，不进行原地重排判定。

拖动过程中 Controller MUST 通过 snapshot 发布当前插入位置，供宿主呈现落点预览；预览 MUST NOT 产生
文档事务。一次拖拽 MUST 只表达一种结构意图：当选区并非全部属于同一候选容器时 MUST NOT 进入重排，
改按 reparent 或既有 Transform 规则统一处理，MUST NOT 在同一次手势内混合提交重排与其他结构命令。

#### Scenario: 容器内拖拽只重排不烘焙

- **WHEN** 用户在 `nowrap` 容器内把一个 Flow 子级拖到另一个兄弟旁边并在容器内松手
- **THEN** 提交的命令只改变 `Hierarchy.childIds` 顺序
- **AND** 该 Entity 的 `LayoutItem.positioning` 保持 `flow` 且不产生 Transform 命令

#### Scenario: 顺序未变化不产生事务

- **WHEN** 用户在容器内拖动 Flow 子级后松手，计算出的插入位置与原顺序一致
- **THEN** 不提交任何命令
- **AND** 历史不增加条目

#### Scenario: 拖动中呈现落点预览

- **WHEN** 用户在 `nowrap` 容器内拖动 Flow 子级并移动指针
- **THEN** Controller 随指针在 snapshot 中发布当前插入位置
- **AND** 预览期间不产生任何文档事务

#### Scenario: 选区跨容器时不进入重排

- **WHEN** 一次拖动的选区同时包含某 `nowrap` 容器内的 Flow 子级与该容器外的其他目标
- **THEN** 不产生重排落点，整次手势按 reparent 或既有 Transform 规则统一处理
- **AND** 不在同一次手势内混合提交重排与其他结构命令

#### Scenario: 拖出容器边界回退为烘焙 Absolute

- **WHEN** 用户把 `nowrap` 容器内的 Flow 子级拖出该容器边界后松手
- **THEN** 该目标按既有规则烘焙为 Absolute
- **AND** 未拖出边界的其他并发拖动目标不受影响

#### Scenario: wrap 容器维持现状

- **WHEN** 容器 `flexWrap` 为 `wrap` 或 `wrap-reverse`
- **THEN** 拖动其 Flow 子级立即按既有规则烘焙为 Absolute
- **AND** 不进行插入位置判定

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

