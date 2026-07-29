## MODIFIED Requirements

### Requirement: ECS SceneIndex

Stage Engine MUST 从 ComposeDocument v4 entities 建立 parent、世界矩阵、可见性、锁定、容器和
TransformConstraints 索引，不得依赖旧节点 kind。

#### Scenario: 索引可渲染容器

- **WHEN** Entity 同时包含 Renderer 和 Hierarchy
- **THEN** SceneIndex 保留其世界几何、子项顺序与容器命中能力

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
