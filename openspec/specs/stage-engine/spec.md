# stage-engine Specification

## Purpose
TBD - created by archiving change extract-stage-interaction-engine. Update Purpose after archive.
## Requirements
### Requirement: 无 React 的 Stage Engine 包

系统 MUST 提供只依赖 `@compose-ui/core` 的 `@compose-ui/stage-engine` 公共包。包 MUST NOT
依赖 React、ReactDOM、DOM 类型、CSS、component-registry 或 ui-context，并 MUST 导出坐标、
矩阵、场景索引、吸附、滚动映射、空间命令与交互 controller 公共 API。

#### Scenario: 独立构建 Stage Engine

- **WHEN** 消费者在没有 React 或 DOM 的 TypeScript 环境导入 stage-engine
- **THEN** 可以计算文档世界几何、创建空间命令并驱动交互 controller
- **AND** 构建产物与 package manifest 不包含第一方 UI 包或 React 运行时

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

内部变换 session MUST 捕获开始文档与世界几何，Pointer 更新 MUST 只发布 preview。
pointerup MUST 使用最终点冻结最多一个命令或 batch，并在清理 preview 和释放 capture 之前
提交该 effect。cancel、真实 lost capture、失焦或不兼容 document/tool/selection context 更新
MUST 清理预览且不提交文档；surface 尺寸重测 MUST NOT 取消活动 move、resize 或 rotate。

#### Scenario: 高频更新后单次提交

- **WHEN** move、resize 或 rotate session 收到多次 Pointer 更新后结束
- **THEN** 每次更新只改变 snapshot 中的局部 preview transform
- **AND** 结束时只产生一个包含最终结果的 dispatch effect

#### Scenario: 取消或文档并发变化

- **WHEN** 活动内部手势被取消，或 context document 在提交前变化
- **THEN** phase 返回 idle 并清除 preview、snap guide 与 pointer 状态
- **AND** surface 不收到 dispatch effect

#### Scenario: 最终点与 effect 顺序

- **WHEN** move、resize 或 rotate 没有中间 move，直接以新的最终点 pointerup
- **THEN** dispatch effect 包含该最终点计算出的 transform
- **AND** command dispatch 先于 idle preview 清理和 pointer release

#### Scenario: 活动期间重测 surface

- **WHEN** 活动 move、resize 或 rotate 的 surface 尺寸发生变化
- **THEN** session 继续使用开始时的 viewport 与 adapter 冻结的 surface 原点计算最终几何
- **AND** 不因纯测量变化取消或丢失正常 pointerup

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

Stage Engine MUST 从 ComposeDocument v4 entities 建立 parent、世界矩阵、可见性、锁定、容器和
TransformConstraints 索引，不得依赖旧节点 kind。

#### Scenario: 索引可渲染容器

- **WHEN** Entity 同时包含 Renderer 和 Hierarchy
- **THEN** SceneIndex 保留其世界几何、子项顺序与容器命中能力

### Requirement: ECS 结构命令

Stage Engine MUST 使用 Hierarchy 实现 nullable reparent、group 和 ungroup。Container Resize
MUST 只更新所选 Entity 自身 Transform，后代局部 Transform 保持不变。

#### Scenario: 创建和取消容器结构

- **WHEN** 用户 group 或 ungroup Entity
- **THEN** 命令创建或移除具有 Hierarchy 的 Container Entity
- **AND** 全部目标保持世界几何

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

