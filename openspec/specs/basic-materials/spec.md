# basic-materials Specification

## Purpose
TBD - created by archiving change add-basic-materials. Update Purpose after archive.
## Requirements
### Requirement: 独立基础物料包

系统 MUST 提供可独立安装的 `@compose-ui/materials` React 包。包 MUST 提供 Frame、Rectangle、
Text 的默认 definitions/presets、样式入口和实例级 createBasicMaterials factory，并 MUST NOT
依赖 editor、ECharts 或模块级可变 registry。

#### Scenario: 创建默认物料 bundle

- **WHEN** 宿主调用 createBasicMaterials
- **THEN** 返回 registry、Rectangle/Text definitions、Frame presets 与 ContainerInspector
- **AND** Palette 顺序为 Frame、Rectangle、Text

#### Scenario: 覆盖默认值并追加扩展

- **WHEN** 宿主覆盖物料 label/name/尺寸/props/style 并传入扩展 definitions
- **THEN** factory 创建隔离的默认值与 Inspector reset 基线
- **AND** 扩展 definitions 按传入顺序追加在 Text 之后

### Requirement: 完整基础物料与 Inspector

Rectangle MUST 使用通用 node.style 保存视觉；Text MUST 使用 props 保存文字、颜色和字号。
Frame/Group ContainerInspector 与 Rectangle/Text Inspector MUST 通过统一命令编辑名称、几何、
样式及组件字段，并在跨域修改时使用原子 batch。

#### Scenario: 编辑基础物料

- **WHEN** 用户在 Inspector 修改 Frame、Group、Rectangle 或 Text 的合法字段
- **THEN** 文档通过一个可撤销事务更新对应 name、transform、style 或 props
- **AND** History 与 Operation Log 使用英文数据摘要记录变化

#### Scenario: 兼容旧 Rectangle props

- **WHEN** Rectangle 节点没有 style 但保存旧 color、opacity 或 cornerRadius props
- **THEN** renderer 使用旧值显示相同视觉
- **AND** 首次 Inspector 编辑写入标准 style 而不自动删除旧 props

### Requirement: 基础材料 Inspector 共享 UI 环境

Frame、Group、Rectangle 与 Text 的第一方 Inspector MUST 消费共享 Theme/I18n Context，并为内建
字段、分组、帮助文案和操作提供 zh-CN/en-US 文案与语义主题 token。宿主扩展 definition、
registry label、自定义 Inspector 和自定义 Schema metadata MUST 保持原文。

#### Scenario: 使用英文基础材料 Inspector

- **WHEN** 基础材料 Inspector 位于 en-US Provider
- **THEN** 第一方字段和操作显示英文
- **AND** 宿主扩展物料的标签和业务字段保持宿主提供的内容

#### Scenario: 切换 Inspector 主题

- **WHEN** Provider 从 dark 切换为 light
- **THEN** Inspector surface、输入、边框、文本和焦点态使用浅色 token
- **AND** Inspector 不重新创建 registry 或修改节点文档
