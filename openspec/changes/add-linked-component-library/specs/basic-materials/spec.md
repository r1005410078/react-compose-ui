## ADDED Requirements

### Requirement: 关联组件实例物料
materials MUST 提供隐藏于基础 Palette 的 `component-instance` Preset，并从组件媒体类型资源创建保存引用、applied revision、源快照和 overrides 的实例。

#### Scenario: 离线渲染已保存快照
- **WHEN** Provider 不可用但实例含有合法源快照
- **THEN** Stage 与 Preview 继续渲染快照而不清空内容

#### Scenario: 显式属性覆盖
- **WHEN** 用户修改主组件声明的可覆盖属性
- **THEN** 实例只保存 property ID override 并以覆盖后的快照渲染

#### Scenario: 嵌套组件保护
- **WHEN** 组件实例形成循环或超过八层嵌套
- **THEN** Renderer 停止递归并呈现可访问错误状态
