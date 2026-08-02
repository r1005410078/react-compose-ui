## ADDED Requirements

### Requirement: 输出 Paint 配置事务

`output.configure` MUST 校验完整的 v5 `ComposeOutputSettings`，并在宽高或 `backgroundPaint` 任一变化时保存
一个可逆 output Patch。命令不得接受 `backgroundColor` 或只更新 Paint 的局部字段。

#### Scenario: 提交并撤销输出渐变

- **WHEN** 用户在 Canvas Inspector 把输出背景从 Solid 改为 Linear、Radial 或 Angular Paint
- **THEN** Runtime 记录一个完整且可逆的 `output.configure` 事务
- **AND** undo/redo 分别恢复变化前后的完整输出尺寸和 Paint
