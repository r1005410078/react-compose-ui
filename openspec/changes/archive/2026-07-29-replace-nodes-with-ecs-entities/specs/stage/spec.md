## RENAMED Requirements

- FROM: `### Requirement: 多 Frame 与输出边界`
- TO: `### Requirement: 多 Container 与输出边界`

- FROM: `### Requirement: 分组与重设父节点`
- TO: `### Requirement: 分组与重设父级`

- FROM: `### Requirement: DOM 与 SVG 分层 Stage`
- TO: `### Requirement: ECS DOM 与 SVG 分层 Stage`

- FROM: `### Requirement: ComponentPalette 拖入`
- TO: `### Requirement: 统一 Entity Palette`

## MODIFIED Requirements

### Requirement: ECS DOM 与 SVG 分层 Stage

Stage MUST 使用 ComposeDocument v4 Entity 渲染 DOM Scene，并用 SVG Overlay 渲染编辑反馈。
Entity MAY 同时渲染 Renderer 内容和 Hierarchy 子项；未知 Renderer MUST 降级且 Entity 仍可选择。

#### Scenario: 渲染可渲染容器

- **WHEN** Entity 同时拥有 Renderer、Hierarchy、Appearance 和 Clip
- **THEN** Stage 先渲染 Renderer 再渲染子项
- **AND** Appearance、裁剪、旋转和嵌套世界几何正确应用

### Requirement: 统一 Entity Palette

Component Palette MUST 只消费 ComposeEntityRegistry Presets，不再区分 Frame Preset 与 Component
Definition。Container、Rectangle、Text、Image、SVG MUST 使用相同拖入和键盘新增流程。

#### Scenario: 拖入五种基础 Preset

- **WHEN** 用户依次拖入 Container 与四种 Renderer Preset
- **THEN** 每次都创建合法 v4 Entity 并选中新实体
- **AND** 不产生旧 Frame/Component Node

### Requirement: 多 Container 与输出边界

Stage MUST 渲染位于世界 `(0,0)` 的可检查文档输出边界，并渲染 rootIds 中任意 Entity。
输出背景 MUST 使用 document.output，默认透明并显示 1 屏幕像素非缩放边框；
未选中边框 MUST 使用统一的主题中性色且不得复用 X/Y 轴颜色，选中输出检查目标时四边 MUST
统一使用编辑器强调色。Stage MUST 在世界 `(0,0)` 显示固定屏幕尺寸、Godot 风格的前景十字
标记：MUST 精确使用 16×16 `EditorPosition` 双填充轮廓，外层为
`rgba(255,255,255,0.706)`，内层为 `#ff5f5f`；不得以描边线条近似，也不得通过 halo 或轴线
分段在原点周围制造缺口。X/Y 轴 MUST 分别使用 `rgba(245,51,82,0.75)` 与
`rgba(135,214,3,0.75)`。平移、缩放或 output 尺寸变化不得改变其世界锚点。
激活输出检查时不得显示 Entity 变换手柄。带 Hierarchy 的 Container Entity MUST 可以嵌套、
旋转，并按 Clip 裁剪或显示溢出；输出边界不得限制无限 Stage 中的编辑和滚动范围。

#### Scenario: 编辑输出边界外的根 Entity

- **WHEN** 根 Entity 位于文档输出边界外
- **THEN** Stage 仍渲染、选择、移动和 resize 该 Entity
- **AND** 输出区域只作为网格之上、Entity 之下的检查目标，不阻止边界外编辑

#### Scenario: 检查透明输出区域

- **WHEN** 用户点击没有 Entity 覆盖的输出区域
- **THEN** Stage 发送 output inspection 回调并清空 Entity 选择
- **AND** 网格透过 transparent 背景可见，边框在任意 zoom 下保持 1 屏幕像素
- **AND** 未选中时四边使用同一主题中性色且不与 X/Y 轴混淆，选中时四边统一使用强调色
- **AND** 原点标记在连续 X/Y 轴之后按 Godot `EditorPosition` 的双填充路径和精确颜色绘制

#### Scenario: 渲染嵌套 Container 裁剪

- **WHEN** 嵌套 Container Entity 切换 Clip.enabled
- **THEN** Stage 对越界后代切换 hidden/visible overflow
- **AND** Container 的 Transform rotation 与后代世界几何保持一致

### Requirement: 分组与重设父级

Stage MUST 允许根或 Container 内的同父级混合选择通过 group 创建 Container Entity，并允许
ungroup 任意含子项的 Container。SceneTree 与 Stage MUST 使用同一 nullable reparent 规划器
保持世界几何。

#### Scenario: 根级分组和取消分组

- **WHEN** 用户组合根级 Entity 并随后取消组合
- **THEN** 选择先变为新 Container Entity，再变为提升后的子项
- **AND** 每个动作最多提交一个事务

## ADDED Requirements

### Requirement: 按约束显示变换手柄

Stage MUST 仅为允许编辑的选区显示对应手柄：free 显示八向，preserve-aspect 显示四角，
horizontal 显示 E/W，vertical 显示 N/S，none 不显示 Resize；rotatable 为 false 时不显示旋转。

#### Scenario: 动态切换几何限制

- **WHEN** Inspector 修改 TransformConstraints
- **THEN** Stage 手柄和直接操作立即同步
- **AND** 禁用但仍可选择的 Entity 保留选择框

### Requirement: ECS 上下文菜单与结构操作

Stage 上下文菜单 MUST 根据 Hierarchy、Lock 与 TransformConstraints 计算 duplicate、group、
ungroup、delete 和视图操作状态，不得读取旧 kind。

#### Scenario: 取消容器分组

- **WHEN** 单选含子项的可编辑 Hierarchy Entity
- **THEN** 菜单启用取消编组并保留现有快捷键提示

## REMOVED Requirements

### Requirement: Frame Palette 拖入

**原因**：Frame Palette 与 Component Palette 已合并为统一 Entity Palette。

**迁移**：由「统一 Entity Palette」承接，Container 与基础物料走同一 Preset 拖入路径。

### Requirement: Stage 统一节点样式

**原因**：v3 NodeStyle 已被 Appearance Component 取代。

**迁移**：Stage 与 Preview 共同调用 component-registry 的 composeEntitySceneStyle。
