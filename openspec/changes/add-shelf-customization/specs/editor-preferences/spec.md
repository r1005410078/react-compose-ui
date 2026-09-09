## MODIFIED Requirements

### Requirement: 实例级编辑器偏好

`@compose-ui/editor` MUST 导出 theme、locale、shortcut action、keybinding、workspace 与完整
preferences 公共类型，并提供产生独立默认值的 factory。`ComposeEditor` MUST 支持受控 `preferences`
和实例内非受控 `defaultPreferences`；系统 MUST NOT 自动读写 localStorage、ComposeDocument、History
或 Operation Log。

偏好 MUST 包含 `workspace` 字段：`lastUsed`（工作区 id）、`byDocument`（文档 key → 工作区 id）、
`layouts`（工作区 id → 不透明布局快照）、`toolbars`（工作区 id → 工具栏货架）、`palettes`
（工作区 id → 物料货架）、`custom`（用户另存的工作区定义，不含 builder）。缺席的字段 MUST 按
默认值补齐；各映射里引用了不存在工作区的条目 MUST 在规范化时保留、在使用时回退，MUST NOT 让
整份偏好无效。

#### Scenario: 使用实例内默认偏好

- **WHEN** 宿主不提供受控 preferences 并挂载 ComposeEditor
- **THEN** 编辑器使用 dark、zh-CN、默认快捷键、「页面」工作区与默认货架
- **AND** 有效修改只保留到该组件实例卸载

#### Scenario: 使用受控偏好

- **WHEN** 宿主提供 preferences 并在 onPreferencesChange 后回传新值
- **THEN** 编辑器显示宿主当前完整规范化偏好
- **AND** editor 不在宿主更新前私自提交受控显示状态

#### Scenario: 通知完整偏好

- **WHEN** 用户有效修改主题、语言、一个快捷键、切换工作区、拖动面板或改动一条货架
- **THEN** onPreferencesChange 收到包含所有字段的规范化新对象
- **AND** 修改不产生文档事务、会话历史或操作日志

#### Scenario: 旧形状的偏好按默认补齐

- **WHEN** 宿主回传的 preferences 没有 `workspace.toolbars` 或 `workspace.palettes`
- **THEN** 编辑器按默认货架补齐，不报错
