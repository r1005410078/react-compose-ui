## MODIFIED Requirements

### Requirement: 关联组件实例物料

materials MUST 提供隐藏于基础 Palette 的 `component-instance` Preset；实例保存稳定引用、
appliedLineage、resolvedSnapshot 和 instanceOverrides，以 Hug 尺寸与快照 fallback 渲染，允许移动和
旋转但不允许 Resize。实例内部 Entity MUST 可在宿主编辑期被投影、选中并按实例层稳定操作结构编辑，
且 MUST 保持在实例子树边界内。

#### Scenario: 离线渲染已保存快照

- **WHEN** Provider 不可用但实例含合法 resolvedSnapshot
- **THEN** Stage 与 Preview 继续渲染快照并显示离线状态

#### Scenario: 显式属性覆盖

- **WHEN** 用户修改 Base 声明的暴露属性
- **THEN** 实例只在 instanceOverrides 的属性分区保存 property ID 到 JSON 值的覆盖并以覆盖结果渲染

#### Scenario: 实例层结构覆盖

- **WHEN** 用户在实例内部删除、reparent、reorder 实体或增删非基础 Component
- **THEN** 实例只保存与 Variant 同构的稳定结构操作，并按 Base → Variant 链 → 结构操作 → 属性覆盖解析

#### Scenario: 拒绝越界结构编辑

- **WHEN** 操作试图删除或 reparent 实例根、删除基础 Component，或把内部实体移出实例子树
- **THEN** 操作被稳定拒绝，实例保持上一个合法状态

#### Scenario: 嵌套组件保护

- **WHEN** 组件嵌套形成循环或超过八层
- **THEN** Renderer 停止递归、释放已创建 Runtime 并呈现可访问错误状态
