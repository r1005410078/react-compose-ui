## ADDED Requirements

### Requirement: 共享确认对话框

系统 MUST 提供受控 ComposeConfirmDialog，用于不可逆操作的可访问确认。

#### Scenario: 取消危险操作
- **WHEN** 用户在 destructive 确认框选择取消或按 Escape
- **THEN** 对话框关闭且不调用确认回调
