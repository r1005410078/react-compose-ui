## ADDED Requirements

### Requirement: 可配置复制剪切粘贴快捷键

编辑器 MUST 把 `edit.copy`、`edit.cut` 和 `edit.paste` 纳入 stage 作用域的可配置 shortcut action
map，默认分别为 Primary+C、Primary+X 和 Primary+V。旧偏好对象缺少这些动作时 MUST 补默认值。
菜单、设置面板和命令目录 MUST 按当前平台格式化这些键位。剪贴板为空时粘贴 MUST 给出不可用原因。

#### Scenario: 使用默认平台复制键

- **WHEN** 用户使用默认偏好并在 Stage 焦点下按下 Primary+C
- **THEN** 编辑器执行复制动作
- **AND** 设置面板与命令目录按平台显示 ⌘C 或 Ctrl+C

#### Scenario: 规范化旧偏好

- **WHEN** 宿主传入缺少 `edit.copy` 的旧偏好对象
- **THEN** normalize 补上 Primary+C 默认值
- **AND** 已有自定义键位保持不变
