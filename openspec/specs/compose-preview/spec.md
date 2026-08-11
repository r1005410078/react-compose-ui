# compose-preview Specification

## Purpose
TBD - created by archiving change add-infinite-stage-composition. Update Purpose after archive.
## Requirements
### Requirement: Preview 配置与兼容
ComposePreview MUST require a document and registry, render a complete document or explicit Frame target, and MUST
NOT offer a legacy children container mode.

#### Scenario: Required document configuration
- **WHEN** a consumer renders ComposePreview with a document, registry and optional target
- **THEN** it renders the requested output using the existing output and clipping rules

### Requirement: Preview 资源解析

ComposePreview MUST 接受可选 assetResolver，并把它传给文档或 Frame target 内所有 Component
renderer；资源 chrome MUST NOT 出现在输出中。

#### Scenario: 预览资源组件

- **WHEN** 文档包含 Image/SVG 节点且 resolver 可用
- **THEN** document 与 frame target 都渲染最新资源
- **AND** 缺失 resolver 时只显示节点内可访问占位而不卸载 Preview

### Requirement: Preview 输出背景 Paint

ComposePreview MUST 在固定输出边界渲染 `output.backgroundPaint` 的 Solid、Linear、Radial 与 Angular
描述，并保持其位于所有 Entity 之后。Preview 不得渲染渐变编辑控制柄或其它 Editor chrome。

#### Scenario: 预览渐变输出背景

- **WHEN** v5 document output 使用任一合法 Gradient Paint
- **THEN** Preview 显示与 Stage 输出边界一致的渐变背景
- **AND** Entity Appearance、Hierarchy 和 Clip 渲染顺序保持不变

### Requirement: 图片背景渲染

Stage 与 Preview MUST 通过 ComposeAssetResolver 解析 Image Paint 的稳定引用，并按图片显示模式、透明度与叠色渲染。资源缺失或解析失败时 MUST 安全降级且继续渲染场景。

#### Scenario: 预览图片背景

- **WHEN** 文档输出或 Entity Appearance 使用可解析的 Image Paint
- **THEN** Preview 显示对应图片背景和颜色叠加
- **AND** 资源读取失败不会阻止其它实体显示

### Requirement: Preview 页面文档加载注入

Preview MUST 接受可选的页面文档加载端口并将其注入 Registry 渲染上下文，使引用了页面的实体在预览
中递归渲染被引用页面的内容。Preview MUST NOT 自行实现页面加载或嵌套渲染逻辑，也 MUST NOT 因此
依赖 `editor`、`stage` 或页面 Store 实现包。未注入端口时预览 MUST 正常渲染且相关实体呈现占位状态。

#### Scenario: 预览中递归渲染页面

- **WHEN** 宿主向 Preview 注入页面文档加载端口，文档中存在引用页面的实体
- **THEN** 预览递归渲染被引用页面的内容
- **AND** 循环引用与超出深度的嵌套被阻断并以警示语义呈现

#### Scenario: 未注入端口

- **WHEN** 宿主未注入页面文档加载端口
- **THEN** 预览正常渲染其余内容
- **AND** 引用页面的实体呈现可访问的占位状态

### Requirement: 独立只读 Preview

ComposePreview MUST 创建或接受 Layout Runtime，并把 Registry measurement adapter 接入该 Runtime。
Hug 内容完成异步准备后 MUST 使用新 Snapshot 重渲染；loading/error/fallback 状态 MUST 可访问且不依赖
Editor 或 Stage。

#### Scenario: Preview 独立解析 Hug
- **WHEN** 独立 Preview 渲染包含 Text、Image、SVG 或 Page Slot Hug 的 v6 文档
- **THEN** 它使用与 Stage 相同 measurement definition 和 Layout 语义得到 local boxes
- **AND** 卸载会取消全部 prepare、订阅、离屏 host 与 Layout Runtime

### Requirement: 完整文档与指定 Container 预览

Container target 的 viewport MUST 使用目标 Entity 的 resolved width/height，而不是读取旧 Transform
size；目标缺失、不是 Hierarchy 或布局 Runtime error 时 MUST 显示明确 alert。

#### Scenario: 预览 Auto Layout Container
- **WHEN** target 指向尺寸由 Layout Snapshot 解析的 Container
- **THEN** Preview 以其 resolved border box 建立相对 viewport 并渲染后代
- **AND** 不把目标在父级中的 offset 重复应用到 viewport

### Requirement: Preview 页面 setup 运行

Preview MUST 能够接受聚合页面与 Script Runtime 配置，创建当前页面实例的 setup scope，并用解析后的
value/method runtime Props 渲染。独立只传 ComposeDocument 的既有 Preview MUST 保持纯字面渲染，除非
宿主显式注入 scope。卸载 MUST dispose setup、Effect、订阅、方法 wrapper 与迟到异步结果。

#### Scenario: 点击方法更新绑定值

- **WHEN** Preview 页面把 Text.text 绑定到 State `num`、Button.onClick 绑定到方法 `onAdd`
- **THEN** 点击 Button 调用同一页面实例的方法并让 Text 显示递增后的 num
- **AND** 文档、事务历史和 authored Props 保持不变

#### Scenario: 独立文档 Preview 保持兼容

- **WHEN** 宿主只向 ComposePreview 传入 ComposeDocument 与 Registry
- **THEN** Preview 使用 authored Props 正常渲染
- **AND** 不猜测、搜索或执行任何页面脚本

### Requirement: 嵌套页面脚本实例隔离

Preview 递归渲染 Page Slot 时 MUST 为每个 Slot 页面创建独立 setup scope，并继续应用既有循环与深度
护栏。一个嵌套脚本失败 MUST 只降级对应 Slot；Slot 卸载或页面引用变化 MUST dispose 旧 scope。

#### Scenario: 两个 Page Slot 引用同一计数页面

- **WHEN** 两个 Slot 同时渲染同一页面且用户只点击其中一个实例的方法
- **THEN** 只有该 Slot 内的绑定值更新
- **AND** 两个实例分别拥有 Effect cleanup 与 diagnostic 生命周期

