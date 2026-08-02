## ADDED Requirements

### Requirement: 历史右键导航菜单

HistoryPanel MUST 为历史条目和空白区域提供跳转、撤销、重做和跳转最新操作。

#### Scenario: 跳转到右键历史项
- **WHEN** 用户在历史条目的菜单中选择跳转
- **THEN** 面板调用 controller.navigate 对应稳定 ID

### Requirement: 历史菜单只提示已安装的键位

HistoryPanel MUST 仅在宿主显式传入 `ComposeHistoryShortcuts` 时为撤销和重做菜单项显示快捷键；
默认 Editor 面板 MUST 透传当前 preferences 中的 history 键位。

#### Scenario: 独立面板不暗示未安装的快捷键
- **WHEN** 独立 HistoryPanel 没有收到 `shortcuts`
- **THEN** 撤销和重做菜单项不显示快捷键
