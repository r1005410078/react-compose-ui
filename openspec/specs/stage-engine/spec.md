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

系统 MUST 提供实例级 `StageInteractionController`，使用普通数据事件、不可变 snapshot 和
surface effect port 表达 pan、marquee、move、resize、rotate、guide 与 external drag。一个
controller MUST 同时只允许一个 surface 连接。

#### Scenario: 连接并驱动 surface

- **WHEN** 宿主连接一个 surface、更新受控 context 并发送 Pointer 事件
- **THEN** controller 发布对应 phase 与 preview snapshot
- **AND** viewport、selection、pointer capture 和命令请求通过 effect port 返回

#### Scenario: 拒绝第二个同时连接的 surface

- **WHEN** 同一 controller 已连接 surface 且另一个 surface 尝试连接
- **THEN** connectSurface 明确抛错
- **AND** 原连接与活动交互保持不变

### Requirement: 手势预览与原子提交

StageInteractionController MUST 在 session 开始冻结 Layout Snapshot。Flow move preview MUST 使用
resolved box 转为 Absolute 后应用位移；Fill resize preview MUST 把活动 axis 视为 Fixed。Cancel
MUST 丢弃全部布局意图 preview，pointerup MUST 请求最多一个命令或 batch。

#### Scenario: 混合选择移动并取消
- **WHEN** Flow 与 Absolute 混合选择开始移动后收到 Escape
- **THEN** preview 中的 positioning 与 offset 全部清除并恢复原 Snapshot
- **AND** surface 不收到 dispatch effect

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

#### Scenario: Snapshot 改变使空间索引失效
- **WHEN** 文档引用不变但 Layout Snapshot revision 与子项 box 改变
- **THEN** SceneIndex 返回新的世界矩阵、bounds、命中与裁剪结果
- **AND** 不读取旧 Transform position/size

### Requirement: ECS 结构命令

Reparent 与 Duplicate MUST 接受开始 Layout Snapshot，并按目标 parent Layout 决定 positioning、offset
与 Fill 转换；Group/Ungroup MUST 为 Flow 目标返回稳定不可用原因。

#### Scenario: Scene Tree 跨布局移动
- **WHEN** 节点从 free parent 移入 Layout、在 Layout 间移动或移出到 free parent
- **THEN** 分别得到 Flow、保持 Flow、或烘焙 Absolute 的确定 LayoutItem
- **AND** 一个 Undo 恢复 parent、index 与全部原 authoring 值

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

