## REMOVED Requirements

### Requirement: Page Slot 基础物料

**原因**：Page Slot 与 Component Instance 是两套并行的嵌套文档 Runtime，而 Page Slot 没有
属性/结构覆盖、没有变体、编辑期不能下钻、不能离线渲染，能力严格弱于组件实例。复用由
Component Asset v2 与变体承担，页面回归为可跳转的目标。

**迁移**：复用一块 UI 的场景改用 Component Instance。文档中已有的 `page-slot` Entity 由
`compose-document` 的显式迁移降级为保留几何与外观的空 Container 并返回稳定 issue。

### Requirement: Page Slot 加载状态与嵌套护栏

**原因**：随 Page Slot 物料一并删除。循环引用与深度上限护栏只为页面嵌套存在；组件实例
拥有自己的八层嵌套与循环检测，不依赖这套实现。

**迁移**：无。组件实例的护栏不受影响。

### Requirement: 页面拖入画布创建 Page Slot

**原因**：Page Slot 已删除，该拖入路径没有目标物料。

**迁移**：把页面文件拖入画布不再创建实体。跳转目标通过 `Interaction` 的目标字段设置，
该字段同样接受从资源面板拖入页面文件。

## RENAMED Requirements

- FROM: `### Requirement: Image、SVG 与 Page Slot 物料`
- TO: `### Requirement: Image 与 SVG 物料`

## MODIFIED Requirements

### Requirement: Image 与 SVG 物料

Image 与 SVG MUST 分别使用 resolved asset natural size 与 SVG intrinsic box 作为 Hug
measurement，并在各自 subscription revision 变化时失效。

#### Scenario: 异步资源驱动 Hug
- **WHEN** Hug Image 或 SVG 的资源从 loading 变为 ready 或发布新 revision
- **THEN** 首帧使用 LayoutItem fallback，ready 后使用新的 intrinsic size 重排
- **AND** 失败状态保持 fallback 与可访问占位，不修改文档

### Requirement: 基础 Entity Presets

Materials MUST 发布 Container、Rectangle、Text、Image、SVG、Line、Arrow 与 Circle Entity Presets。Container
MUST 组合 Transform、Visibility、Lock、Hierarchy、Clip、Appearance；Rectangle、Text、Image、SVG 与形状
Renderer Presets MUST 组合 Transform、Visibility、Lock、Appearance、Renderer。Line、Arrow 与 Circle MUST 使用
第一方结构化 Shape Renderer props，不得依赖外部 SVG asset 或 Stage 专属数据。

已经拥有专用创建入口的 Preset MUST 默认隐藏于 Palette，避免同一个创建动作出现两个入口：
Text、Line、Arrow 与 Circle 由 Stage 工具栏绘制工具提供入口。默认隐藏 MUST 只影响 Palette
呈现，MUST NOT 影响 Registry 注册、拖入、键盘新增、资源拖放或文档反序列化；宿主 MUST
能够通过物料 options 覆盖该默认。

#### Scenario: 创建五种 ECS 物料

- **WHEN** Registry 从所有内建 Preset 创建 seed
- **THEN** 每个 seed 是合法独立 ComposeEntity
- **AND** Composition 记录正确 Preset、基础 Component Keys 与 Shape Renderer 类型

#### Scenario: 默认 Palette 不重复工具栏入口

- **WHEN** 宿主使用默认基础物料渲染组件库 Palette
- **THEN** Text、Line、Arrow 与 Circle 不出现在 Palette 中
- **AND** 这些 Preset 仍可由工具栏、资源拖入与 Registry API 正常创建

#### Scenario: 形状跨入口一致渲染

- **WHEN** Stage 或 Preview 渲染 Line、Arrow 或 Circle Entity
- **THEN** 两个入口基于同一 Renderer props 输出相同形状与方向
- **AND** 反向拖拽不产生负 LayoutItem 尺寸
