## ADDED Requirements

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
