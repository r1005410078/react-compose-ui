## ADDED Requirements

### Requirement: 基础物料使用共享语义 Inspector

Frame、Rectangle、Text、Image 和 SVG 的 Inspector MUST 使用 `@compose-ui/property-panel` 的语义 editor：position 使用 Vector2，size 使用 Size，rotation 使用 Angle，适用颜色使用来自 `@compose-ui/components` 的共享 Color Picker，透明度、边框宽度和圆角使用对应数值 editor，阴影偏移使用 Vector2。Materials MUST 直接依赖并加载 `@compose-ui/components` 样式。五种物料 MUST 显示 Visibility 并以既有 `node.set-visibility` 命令提交。Alignment 只作为可用的基础 editor，不得因此新增文档字段。

#### Scenario: 编辑物料复合几何与样式
- **WHEN** 用户在任一基础物料 Inspector 修改语义 position、size、rotation 或适用样式字段
- **THEN** Inspector 适配为与此前相同的 transform、style 或 props command payload
- **AND** 所有相关变化继续使用单次原子 batch、既有事务标签和完整 Schema 校验

#### Scenario: 切换物料可见性
- **WHEN** 用户在 Frame、Rectangle、Text、Image 或 SVG Inspector 修改 Visibility
- **THEN** 系统派发既有 `node.set-visibility` 命令
- **AND** 该节点的现有 props、style 和 transform 不被改变

#### Scenario: 保留 Rectangle 兼容样式
- **WHEN** 旧 Rectangle 节点只在 style 中保留背景、边框或阴影等表现字段
- **THEN** 语义 Inspector 读取并更新这些既有 style 值
- **AND** 不会把兼容 style 字段迁移为新的 document props
