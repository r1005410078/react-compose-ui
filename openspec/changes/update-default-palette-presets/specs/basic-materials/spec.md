## MODIFIED Requirements

### Requirement: 基础 Entity Presets

Materials MUST 发布 Container、Rectangle、Text、Image 与 SVG Entity Presets。Container MUST
组合 Transform、Visibility、Lock、Hierarchy、Clip、Appearance；其余 MUST 组合 Transform、
Visibility、Lock、Appearance、Renderer。

已经拥有专用创建入口的 Preset MUST 默认隐藏于 Palette，避免同一个创建动作出现两个入口：
Text、Line、Arrow 与 Circle 由 Stage 工具栏绘制工具提供入口，Page Slot 由资源面板的页面拖入
提供入口。默认隐藏 MUST 只影响 Palette 呈现，MUST NOT 影响 Registry 注册、拖入、键盘新增、
资源拖放或文档反序列化；宿主 MUST 能够通过物料 options 覆盖该默认。

#### Scenario: 创建五种 ECS 物料

- **WHEN** Registry 从五种内建 Preset 创建 seed
- **THEN** 每个 seed 是合法独立 ComposeEntity
- **AND** Composition 记录正确 Preset 和基础 Component Keys

#### Scenario: 默认 Palette 不重复工具栏入口

- **WHEN** 宿主使用默认基础物料渲染组件库 Palette
- **THEN** Text、Line、Arrow、Circle 与 Page Slot 不出现在 Palette 中
- **AND** 这些 Preset 仍可由工具栏、资源拖入与 Registry API 正常创建
