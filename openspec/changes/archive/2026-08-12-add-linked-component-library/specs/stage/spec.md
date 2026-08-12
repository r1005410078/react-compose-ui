## MODIFIED Requirements

### Requirement: 分组与重设父级

Stage MUST 允许 Canvas 或 Container 内同父级、顶层、Absolute 选择通过 group 创建 first-class Group，
并只允许 first-class Group 或历史 Group 兼容结构执行 ungroup。普通 Container MUST 保留其内容、裁剪与
布局语义而不再充当 Group。SceneTree 与 Stage MUST 使用同一 nullable reparent 规划器保持世界几何。

#### Scenario: 根级分组和取消分组

- **WHEN** 用户组合根级 Entity 并随后取消组合
- **THEN** 选择先变为具有 Group 图标的新 Group，再变为提升后的子项
- **AND** 每个动作最多提交一个事务且世界几何不变

#### Scenario: Container 不可解除分组

- **WHEN** 用户选择普通 Container
- **THEN** Ungroup 菜单与快捷键显示稳定不可用状态且文档不变

## ADDED Requirements

### Requirement: Group 动态选择反馈

Stage MUST 以可见后代动态并集绘制 Group 的选择边框、命中范围与吸附范围；Group MUST 不显示 Resize
或 Rotate 手柄。移动 Group MUST 移动其完整子树，移动孩子 MUST 不产生隐式 Group 文档更新。

#### Scenario: Group 子项改变范围

- **WHEN** 用户移动 Group 内子项越过初始边界
- **THEN** Group 选框随可见后代范围改变
- **AND** 历史中只出现子项移动事务
