## ADDED Requirements

### Requirement: Group 基础物料

materials MUST 注册使用 Core seed 的 `group` Preset，供文档识别、图标和 Inspector 使用，但 MUST 将其
隐藏于基础 Palette。Group MUST 可移动、不可缩放和旋转，并且不提供 Container 的外观、裁剪或布局能力。

#### Scenario: Group 与 Container 分离

- **WHEN** Registry 同时注册 Group 与 Container
- **THEN** Palette 只显示 Container
- **AND** Group 仍能以不同图标和只读结构语义显示在 Scene Tree 与 Inspector

### Requirement: 关联组件实例物料

materials MUST 提供隐藏于基础 Palette 的 `component-instance` Preset；实例保存稳定引用、
appliedLineage、resolvedSnapshot 和 propertyOverrides，以 Hug 尺寸与快照 fallback 渲染，允许移动和
旋转但不允许 Resize。实例内部 Entity MUST 是宿主场景的编辑叶子。

#### Scenario: 离线渲染已保存快照

- **WHEN** Provider 不可用但实例含合法 resolvedSnapshot
- **THEN** Stage 与 Preview 继续渲染快照并显示离线状态

#### Scenario: 显式属性覆盖

- **WHEN** 用户修改 Base 声明的暴露属性
- **THEN** 实例只保存 property ID 到 JSON 值的覆盖并以覆盖结果渲染

#### Scenario: 嵌套组件保护

- **WHEN** 组件嵌套形成循环或超过八层
- **THEN** Renderer 停止递归、释放已创建 Runtime 并呈现可访问错误状态
