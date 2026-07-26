# basic-materials Specification

## Purpose
TBD - created by archiving change add-basic-materials. Update Purpose after archive.
## Requirements
### Requirement: 独立基础物料包

materials MUST 提供默认启用 clipContent 的 Frame preset、Rectangle/Text definitions 与只接受
ComposeFrameNode 的 ContainerInspector。BasicMaterialFrameOptions MUST 允许覆盖默认裁剪值。

#### Scenario: 创建统一 Frame 物料

- **WHEN** 宿主创建默认或覆盖后的 basic materials
- **THEN** Frame preset 返回独立 style、尺寸和 defaultClipContent
- **AND** 包不导入或引用 ComposeGroupNode

### Requirement: 完整基础物料与 Inspector

Frame Inspector MUST 编辑名称、位置、尺寸、rotation、clipContent 和通用 style；Rectangle/Text
Inspector 行为保持。跨 transform/style/clipContent 修改 MUST 使用一个原子 batch。

#### Scenario: 编辑 Frame 裁剪和旋转

- **WHEN** 用户同时修改 Frame rotation 与 clipContent
- **THEN** 文档通过一个事务更新两个字段
- **AND** undo/redo 恢复完整状态

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
