## MODIFIED Requirements

### Requirement: 无 React 的增量 Layout Runtime

Layout Runtime MUST 接受 core measurement port，为 Hug leaf 安装同步 Yoga measure/baseline callback，
并在 port revision 变化时只 dirty 对应 leaf 与祖先。缺少结果或测量失败 MUST 使用 axis value 并产生
Snapshot diagnostic，不得抛弃其余布局。

#### Scenario: 异步测量完成后重排
- **WHEN** Hug leaf 首次使用 fallback，随后 measurement port 发布新的 ready revision
- **THEN** Runtime 重新测量受影响 leaf 并生成新 Snapshot revision
- **AND** 文档引用、TransactionRuntime 与历史保持不变

#### Scenario: 测量失败并恢复
- **WHEN** 自定义 measurer 抛错后输入或准备 revision 改变并返回合法尺寸
- **THEN** 首次 Snapshot 使用 fallback 与 diagnostic，后续 Snapshot 使用恢复尺寸并清除 diagnostic
- **AND** 其他未受影响子树不被重建

