## MODIFIED Requirements

### Requirement: 受约束 Transform 命令

Transform 命令 MUST 声明 `move|resize|rotate|set` 操作，拒绝锁定 Entity、非法字段变化和违反
TransformConstraints 的结果。多目标手势 MUST 继续由一次命令原子提交。
目标拥有 `Frame` 且尺寸发生变化时，命令 MUST 在同一个事务里同时写入 `Frame.size` 与
`LayoutItem` 的固定尺寸回退：布局求解以 `Frame.size` 为准，只写 `LayoutItem` 会让文档已经改变
而画面纹丝不动。

#### Scenario: 拒绝绕过几何限制

- **WHEN** 外部命令尝试移动不可移动、Resize 被禁用或旋转被禁用的 Entity
- **THEN** Core 拒绝命令而不依赖 Stage UI

#### Scenario: 提交合法多选变换

- **WHEN** Stage 提交多个 Entity 的最终局部 Transform
- **THEN** 运行时生成一个事务并允许一次 undo 恢复全部目标

#### Scenario: 拖拽手柄缩放 Frame

- **WHEN** 用户拖拽一个 Frame 的 resize 手柄
- **THEN** `Frame.size` 与 `LayoutItem` 固定尺寸在同一事务中更新为同一个值
- **AND** 画布上该 Frame 的边界随手柄实时变化，undo 一次同时恢复两者

## REMOVED Requirements

### Requirement: 输出 Paint 配置事务

**原因**：`output.configure` 命令与 `ComposeOutputSettings` 已随 v7 删除——文档级输出不再存在，
输出尺寸是 `Frame.size`、输出背景是该 Frame 自己的 `Appearance.backgroundPaint`。该需求自 v7
落地起就已失效，本变更把它清理掉。

**迁移**：尺寸改用 `entity.frame.size.set`，背景改用 `entity.appearance.set`，两者都以
Frame Entity 为目标，且都是可逆事务。
