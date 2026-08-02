## ADDED Requirements

### Requirement: 共享确认对话框

系统 MUST 提供受控 ComposeConfirmDialog，用于不可逆操作的可访问确认。

#### Scenario: 取消危险操作
- **WHEN** 用户在 destructive 确认框选择取消或按 Escape
- **THEN** 对话框关闭且不调用确认回调

### Requirement: 共享键位格式化

系统 MUST 公开无领域语义的 `ComposeKeybinding`、`formatComposeKeybinding()` 与
`formatComposeKeybindings()`，供设置与菜单以同一规则显示当前平台键位。

#### Scenario: 格式化当前平台的多个键位
- **WHEN** 消费者在 macOS 或其他平台格式化一个或多个键位
- **THEN** macOS 使用符号修饰键，其他平台使用 `Ctrl+Shift+…` 形式
- **AND** 多个替代键位以 ` / ` 分隔，空数组或未提供的键位返回空字符串
