## MODIFIED Requirements

### Requirement: ECS DOM 与 SVG 分层 Stage

Stage MUST 使用 ComposeDocument v4 Entity 渲染 DOM Scene，并用 SVG Overlay 渲染编辑反馈。
Entity MAY 同时渲染 Renderer 内容和 Hierarchy 子项；未知 Renderer MUST 降级且 Entity 仍可选择。

#### Scenario: 渲染可渲染容器

- **WHEN** Entity 同时拥有 Renderer、Hierarchy、Appearance 和 Clip
- **THEN** Stage 先渲染 Renderer 再渲染子项
- **AND** Appearance、裁剪、旋转和嵌套世界几何正确应用

### Requirement: 按约束显示变换手柄

Stage MUST 仅为允许编辑的选区显示对应手柄：free 显示八向，preserve-aspect 显示四角，
horizontal 显示 E/W，vertical 显示 N/S，none 不显示 Resize；rotatable 为 false 时不显示旋转。

#### Scenario: 动态切换几何限制

- **WHEN** Inspector 修改 TransformConstraints
- **THEN** Stage 手柄和直接操作立即同步
- **AND** 禁用但仍可选择的 Entity 保留选择框

### Requirement: 统一 Entity Palette

Component Palette MUST 只消费 ComposeEntityRegistry Presets，不再区分 Frame Preset 与 Component
Definition。Container、Rectangle、Text、Image、SVG MUST 使用相同拖入和键盘新增流程。

#### Scenario: 拖入五种基础 Preset

- **WHEN** 用户依次拖入 Container 与四种 Renderer Preset
- **THEN** 每次都创建合法 v4 Entity 并选中新实体
- **AND** 不产生旧 Frame/Component Node

### Requirement: ECS 上下文菜单与结构操作

Stage 上下文菜单 MUST 根据 Hierarchy、Lock 与 TransformConstraints 计算 duplicate、group、
ungroup、delete 和视图操作状态，不得读取旧 kind。

#### Scenario: 取消容器分组

- **WHEN** 单选含子项的可编辑 Hierarchy Entity
- **THEN** 菜单启用取消编组并保留现有快捷键提示
