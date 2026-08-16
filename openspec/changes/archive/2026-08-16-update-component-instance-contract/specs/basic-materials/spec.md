## MODIFIED Requirements

### Requirement: 关联组件实例物料

materials MUST 提供隐藏于基础 Palette 的 `component-instance` Preset；实例保存稳定引用、
appliedLineage、resolvedSnapshot 和 instanceOverrides。实例的 LayoutItem 与 GeometryConstraints
MUST 从组件根派生：根允许 Resize 时实例同样允许，尺寸、外观、裁剪与 Auto Layout 的编辑 MUST 写入
实例覆盖并以组件根为目标，不修改组件源。实例内部 Entity MUST 可在宿主编辑期被投影、选中并按实例层
稳定操作结构编辑，且 MUST 保持在实例子树边界内。

#### Scenario: 离线渲染已保存快照

- **WHEN** Provider 不可用但实例含合法 resolvedSnapshot
- **THEN** Stage 与 Preview 继续渲染快照并显示离线状态

#### Scenario: 实例暴露组件根属性

- **WHEN** 组件根是允许 Resize 的容器
- **THEN** 实例可被 Resize，且尺寸、外观、裁剪与 Auto Layout 在 Inspector 中可编辑
- **AND** 编辑结果保存为以组件根为目标的实例结构操作

#### Scenario: 实例层结构覆盖

- **WHEN** 用户在实例内部删除、reparent、reorder 实体或增删非基础 Component
- **THEN** 实例只保存与 Variant 同构的稳定结构操作，并按 Base → Variant 链 → 实例结构操作解析

#### Scenario: 拒绝越界结构编辑

- **WHEN** 操作试图删除或 reparent 组件根、删除基础 Component，或把内部实体移出实例子树
- **THEN** 操作被稳定拒绝，实例保持上一个合法状态

#### Scenario: 嵌套组件保护

- **WHEN** 组件嵌套形成循环或超过八层
- **THEN** Renderer 停止递归、释放已创建 Runtime 并呈现可访问错误状态
