## MODIFIED Requirements

### Requirement: Stage Engine 空间命令规划

stage-engine MUST 为同父级、顶层、Absolute 选择创建 first-class Group，为 first-class Group 或历史
Group 兼容结构创建 ungroup，并为 Canvas 或 Container 目标创建保持世界几何的 reparent/duplicate 命令。
普通 Container MUST 不再被当作可 Ungroup 的结构包装。

#### Scenario: 在根级组合并解除 Frame

- **WHEN** 根级 Entity 被组合后再解除
- **THEN** group 创建无外观、不可缩放旋转的 Group，ungroup 把孩子提升回 rootIds
- **AND** 两次事务前后的孩子世界几何保持一致

#### Scenario: 拒绝无效组合

- **WHEN** 选择不同父级、包含 Flow、锁定、非顶层，或目标是普通 Container
- **THEN** group/ungroup 返回稳定 issue 且文档不变

## ADDED Requirements

### Requirement: 组件来源原子替换命令

Core MUST 提供一次事务可完成的“删除规范化来源子树并在最小原 sibling index 插入实例”规划，校验开始
document revision、来源父级、顺序与锁定状态。Undo MUST 恢复完整来源，Redo MUST 恢复同一实例，命令
不得拥有或删除外部资源。

#### Scenario: 原子替换与历史导航

- **WHEN** Editor 在匹配 revision 的文档提交合法来源与实例
- **THEN** 一次提交完成替换，Undo/Redo 完整往返且不触发资源副作用

#### Scenario: 拒绝过期来源

- **WHEN** document revision、来源父级或来源实体已变化
- **THEN** 命令在任何 Patch 生效前被拒绝
