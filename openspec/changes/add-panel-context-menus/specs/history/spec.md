## ADDED Requirements

### Requirement: 历史右键导航菜单

HistoryPanel MUST 为历史条目和空白区域提供跳转、撤销、重做和跳转最新操作。

#### Scenario: 跳转到右键历史项
- **WHEN** 用户在历史条目的菜单中选择跳转
- **THEN** 面板调用 controller.navigate 对应稳定 ID
