## MODIFIED Requirements

### Requirement: 直接移动缩放与旋转

Stage MUST 在拖动或方向键移动 Flow 时把它转换为 Absolute 后移动，不得在 Stage 重排 Flow。Resize
Fill axis MUST 转为 Fixed；Rotation MUST 保持 Flow 与 sizing。全部操作 MUST 使用开始 Snapshot 并
维持现有 preview/cancel/一次提交保证。

#### Scenario: 拖动 Flow 转为 Absolute
- **WHEN** 用户在 Stage 拖动一个或多个 Flow Entity 并正常松手
- **THEN** preview 保持开始世界几何并跟随指针，提交后目标为 Absolute final offset
- **AND** Hierarchy.childIds 顺序不因 Stage 拖动改变

#### Scenario: Flow 结构操作禁用
- **WHEN** 当前 Group/Ungroup 目标包含 Flow Entity
- **THEN** 菜单和快捷键使用相同 availability 禁用该操作并提供可读原因
- **AND** Delete、Lock、Visibility 与 Rotation 仍按各自能力执行

