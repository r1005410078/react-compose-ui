## Context

Component registry 只描述宿主 Component，而 Frame 是只能位于根级的文档结构节点。Frame 不得
伪装成普通 component；基础物料包也不得成为 editor 的反向依赖。

## Goals / Non-Goals

- 目标：提供实例级基础物料 bundle、统一节点样式、Frame Palette drop、结构节点 Inspector。
- 目标：保持 schemaVersion 1、旧文档、旧 definitions 和旧 component drag API 兼容。
- 非目标：Frame 嵌套、Group Palette 物料、多层阴影、CSS shadow 字符串或自动文档迁移。

## Decisions

- `ComposeNodeBase.style` 是可选、可部分保存的严格 JSON；`resolveNodeStyle` 按 kind 补齐默认值。
- 样式包含背景、边框、圆角、透明度和单个结构化阴影。Frame 默认浅色画板；其他节点默认透明。
- `node.style.set/reset` 根据路径构造完整合法 style，并以一个可逆 Patch 提交。
- ComponentDefinition 可提供 style factory 与可选 defaultName；StageFramePreset 使用独立 style factory。
- StageDragController 只新增 Frame 方法与可选 dropFrame，不改变现有 component 方法签名。
- Stage 与 Preview 使用几何无关的视觉层应用边框和阴影，避免改变节点坐标与尺寸。
- materials 依赖 core、registry、stage、property-panel 和 Valibot，不依赖 editor。
- `createBasicMaterials` 返回实例级 registry、definitions、Frame presets 和绑定默认值的
  ContainerInspector；扩展 definitions 按宿主顺序追加。

## Compatibility

- 无 style 的旧节点继续有效并按 kind 默认值渲染。
- 旧 Rectangle 的 color/opacity/cornerRadius 只在 style 缺失时作为兼容 fallback。
- 现有工具栏 Frame 创建入口继续保留。
- editor 只消费通用 preset/Inspector 协议，不依赖 materials。

## Risks / Mitigations

- 通用 opacity 会作用于完整节点子树：文档语义明确为 wrapper opacity，并由 Stage/Preview 共测。
- Frame border 可能改变子坐标：使用 inset 视觉层，不使用参与布局的 CSS border。
- Inspector 一次可能跨多个字段域：使用 transaction.batch 原子提交并生成单条历史。
