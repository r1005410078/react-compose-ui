## ADDED Requirements

### Requirement: Stage 吸附工具栏

默认 controller Stage Toolbar MUST 提供 grid snap、smart snap 快捷按钮和画布设置弹层。快捷开关
MUST 立即派发可逆 canvas.configure；数值设置 MUST 使用本地 draft，只有合法 Apply 才提交。

#### Scenario: 快捷切换吸附

- **WHEN** 用户点击 grid snap 或 smart snap 按钮
- **THEN** 按钮 pressed 状态与文档 canvas 设置同步
- **AND** 每次实际改变形成一个可撤销且可审计事务

#### Scenario: 应用或取消画布设置

- **WHEN** 用户编辑 X/Y step、offset、primaryLineEvery 或智能吸附选项
- **THEN** 非法值显示字段错误且不能 Apply，合法 Apply 只提交一个事务
- **AND** Cancel 关闭弹层且文档保持打开前状态

#### Scenario: 清空辅助线

- **WHEN** 用户在设置弹层选择清空全部辅助线
- **THEN** controller 使用一个原子 batch 删除现有 guides
- **AND** undo 一次恢复全部 guide 顺序和位置
