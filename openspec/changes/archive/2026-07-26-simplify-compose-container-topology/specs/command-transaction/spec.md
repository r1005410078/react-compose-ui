## MODIFIED Requirements

### Requirement: 内置文档命令

core MUST 提供 `output.configure`、统一 `node.create`、delete、duplicate、move、rename、visibility、
locked、props、style、transform、group、ungroup 与 batch 命令。`frame.create` MUST 被移除；
所有结构命令 MUST 支持 Canvas 根和嵌套 Frame，并继续返回 committed/noop/rejected。

#### Scenario: 创建和移动任意根节点

- **WHEN** node.create 或 node.move 把 Frame/Component 放入 Canvas 或合法 Frame
- **THEN** rootIds/childIds 与节点表通过一个可逆事务同步更新
- **AND** Component 父级、循环、锁定父级和非法索引被拒绝

#### Scenario: 配置输出

- **WHEN** output.configure 提交合法、相同或非法输出设置
- **THEN** 分别得到 committed、noop 或 rejected
- **AND** committed 事务可撤销重做并具有 inverse Patch

### Requirement: Stage Engine 空间命令规划

stage-engine MUST 为任意同父级顶层选择创建 Frame-backed group，为任意含孩子 Frame 创建
ungroup，并为 Canvas 或 Frame 目标创建保持世界几何的 reparent/duplicate 命令。

#### Scenario: 在根级组合并解除 Frame

- **WHEN** 根级 Frame/Component 被组合后再解除
- **THEN** group 创建透明且不裁剪的 Frame，ungroup 把孩子提升回 rootIds
- **AND** 两次事务前后的孩子世界几何保持一致

#### Scenario: 拒绝无效组合

- **WHEN** 选择少于两个、不同父级、锁定或 Frame 没有孩子
- **THEN** group/ungroup 被稳定拒绝且文档不变
