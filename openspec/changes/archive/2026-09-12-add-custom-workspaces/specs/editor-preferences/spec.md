## MODIFIED Requirements

### Requirement: 实例级编辑器偏好

`@compose-ui/editor` MUST 导出 theme、locale、shortcut action、keybinding、workspace 与完整
preferences 公共类型，并提供产生独立默认值的 factory。`ComposeEditor` MUST 支持受控 `preferences`
和实例内非受控 `defaultPreferences`；系统 MUST NOT 自动读写 localStorage、ComposeDocument、History
或 Operation Log。

偏好 MUST 包含 `workspace` 字段：`lastUsed`（工作区 id）、`byDocument`（文档 key → 工作区 id）、
`layouts`（工作区 id → 不透明布局快照）、`custom`（用户另存的工作区定义，不含 builder）。缺席的
字段 MUST 按默认值补齐；`byDocument` 与 `layouts` 里引用了不存在工作区的条目 MUST 在规范化时
保留、在使用时回退，MUST NOT 让整份偏好无效。

#### Scenario: 使用实例内默认偏好

- **WHEN** 宿主不提供受控 preferences 并挂载 ComposeEditor
- **THEN** 编辑器使用 dark、zh-CN、默认快捷键与「页面」工作区
- **AND** 有效修改只保留到该组件实例卸载

#### Scenario: 使用受控偏好

- **WHEN** 宿主提供 preferences 并在 onPreferencesChange 后回传新值
- **THEN** 编辑器显示宿主当前完整规范化偏好
- **AND** editor 不在宿主更新前私自提交受控显示状态

#### Scenario: 通知完整偏好

- **WHEN** 用户有效修改主题、语言、一个快捷键、切换工作区或拖动面板
- **THEN** onPreferencesChange 收到包含所有字段的规范化新对象
- **AND** 修改不产生文档事务、会话历史或操作日志

#### Scenario: 旧形状的偏好按默认补齐

- **WHEN** 宿主回传的 preferences 没有 `workspace` 字段
- **THEN** 编辑器按「页面」与空记忆补齐，不报错

## ADDED Requirements

### Requirement: 工作区动作

动作目录 MUST 包含：切换到每一个工作区（按 id）、下一个工作区、上一个工作区、只看画布、
另存为工作区、重置当前工作区布局。它们 MUST 可在命令行键入、可在设置里绑键，默认 MUST NOT
绑键——`Ctrl+PageUp/Down` 在浏览器里是切标签页，拦不住；一个默认就失效的键位比没有更差。
这些动作 MUST NOT 进入事务历史。

#### Scenario: 命令行切换工作区

- **WHEN** 用户在命令行键入切换到某个工作区的动作名
- **THEN** 工作区切过去，事务历史条目数量不变

#### Scenario: 默认无键位

- **WHEN** 用户打开设置里的快捷键页
- **THEN** 工作区动作列出且键位为空，可以绑定
