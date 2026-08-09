## ADDED Requirements

### Requirement: Stage 页面 setup 值预览

Stage MUST 接受由宿主组合的可选页面 Script Scope/绑定解析端口，并使用 runtime value Props 渲染 Entity。
State/Computed 更新 MUST 精确刷新依赖 Entity；脚本缺失或错误 MUST 回退 authored Props。Stage MUST NOT
自行加载脚本资源，也不得依赖 Editor 或页面 Store 实现。

#### Scenario: 画布显示响应式页面值

- **WHEN** Text Prop 绑定页面 State 且 Effect 修改其 `.value`
- **THEN** Stage 在不修改 ComposeDocument 的情况下显示新文本
- **AND** Scene Tree、选择、事务历史和未依赖 Entity 不因运行值变化重置

#### Scenario: setup 失败回退字面内容

- **WHEN** 页面 setup 无法加载或绑定值不通过 Prop Contract
- **THEN** Stage 使用 Renderer authored Prop 并显示非阻断 diagnostic
- **AND** 其他 Entity 和编辑手势保持可用

### Requirement: Stage 编辑模式禁止方法副作用

普通 Stage 编辑模式 MUST 保持已绑定方法 Prop 的存在形状，但用户用于选择、移动、缩放和打开上下文
菜单的 Pointer/Keyboard 操作 MUST NOT 执行页面方法。未来允许方法执行的交互预览模式不属于本变更。

#### Scenario: 点击绑定 onClick 的 Entity

- **WHEN** 用户在普通 Stage 中点击一个 onClick 已绑定的 Button Entity
- **THEN** Stage 只执行既有选择命中行为且页面 State 不变
- **AND** Renderer 不因方法 Prop 完全缺失而切换视觉分支
