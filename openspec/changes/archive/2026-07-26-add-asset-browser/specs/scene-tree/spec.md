## ADDED Requirements

### Requirement: SceneTree 组合公共 Tree

SceneTree MUST 依赖 `@compose-ui/components` 的公共 Tree 承载虚拟行、受控选择/展开、键盘和
Pointer 拖排，同时在 scene-tree 内保留场景命令、检索工具栏、右键菜单、可见性和锁定语义。
现有 SceneTree 公共 API、操作 intent 和规范视觉 MUST 保持兼容。

#### Scenario: 迁移后使用场景树

- **WHEN** 宿主按现有 SceneTreeProps 挂载并操作场景树
- **THEN** 选择、展开、检索、命令、重命名、可见性、锁定和 reparent intent 保持原行为
- **AND** 消费者不需要直接配置公共 Tree

#### Scenario: 保持场景树视觉

- **WHEN** 默认深色工作区渲染迁移后的 SceneTree
- **THEN** 行高、缩进、图标、选择、焦点、拖拽目标和工具栏黄金视觉无非预期变化
