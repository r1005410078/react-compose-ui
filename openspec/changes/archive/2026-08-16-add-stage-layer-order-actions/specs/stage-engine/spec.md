## ADDED Requirements

### Requirement: 同级节点层级命令规划

Stage Engine MUST 提供无 React/DOM 的前移、后移、置顶和置底命令规划。规划 MUST 只修改直接父级的
`rootIds` 或 `Hierarchy.childIds`，保持 Entity 数据、选择和选中项相对顺序；跨父级多选 MUST 合并为一个
可撤销事务。

#### Scenario: 稳定调整多选层级

- **WHEN** 用户选择同一父级内连续或非连续的多个节点并执行任一层级动作
- **THEN** 单步动作按连续选中块交换一个相邻未选中节点，置顶置底使用稳定分区
- **AND** 选中节点彼此的相对顺序保持不变

#### Scenario: 分父级原子重排

- **WHEN** 选择包含多个直接父级的可编辑节点
- **THEN** 每个父级独立计算新顺序并通过一个 batch 提交
- **AND** 一个 Undo 恢复所有父级的原始顺序

#### Scenario: 跳过不可移动与边界目标

- **WHEN** 选择包含锁定节点、锁定父级子项或已位于目标边界的节点
- **THEN** 不可移动或无变化分组不产生子命令，其他有效父级仍正常重排
- **AND** 全部无变化时 availability 明确不可用且不产生事务

#### Scenario: 重排 Flow 子项

- **WHEN** Auto Layout parent 的 Flow 子项执行层级动作
- **THEN** 系统只调整 `Hierarchy.childIds` 并允许布局顺序同步变化
- **AND** 全部 LayoutItem、Transform 与其他 authoring 数据保持不变
