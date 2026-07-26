## MODIFIED Requirements

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
