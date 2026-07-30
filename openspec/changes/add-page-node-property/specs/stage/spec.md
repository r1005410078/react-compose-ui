## ADDED Requirements

### Requirement: Stage 页面文档加载注入

Stage MUST 接受可选的页面文档加载端口并将其注入 Registry 渲染上下文，使引用了页面的实体能在编辑
画布上实时渲染其内容。Stage MUST NOT 自行实现页面加载或嵌套渲染逻辑，也 MUST NOT 因此依赖
`preview`、`editor` 或页面 Store 实现包。未注入端口时画布 MUST 正常渲染且相关实体呈现占位状态。

#### Scenario: 注入后实时渲染

- **WHEN** 宿主向 Stage 注入页面文档加载端口，画布上存在引用页面的实体
- **THEN** 该实体在编辑画布上渲染被引用页面的内容
- **AND** 渲染结果与预览一致

#### Scenario: 未注入端口

- **WHEN** 宿主未注入页面文档加载端口
- **THEN** 画布正常渲染
- **AND** 引用页面的实体呈现可访问的占位状态

#### Scenario: 嵌套内容不干扰选择

- **WHEN** 用户在渲染了嵌套页面内容的实体区域内点击或框选
- **THEN** 命中与选择结果为该实体本身
- **AND** 嵌套内容不产生额外的可选目标
