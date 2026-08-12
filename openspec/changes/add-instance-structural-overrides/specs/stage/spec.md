## ADDED Requirements

### Requirement: 组件实例内部下钻与命中

Stage MUST 支持穿透进组件实例内部的命中与选择。默认单击 MUST 选中实例整体；进入内部 MUST 需要显式
下钻手势，并逐层受既有八层上限约束。内部选区 MUST 使用与 Scene Tree 一致的复合地址，并与 Scene Tree
的展开与选中状态双向同步。

#### Scenario: 默认选中实例整体

- **WHEN** 用户单击组件实例
- **THEN** 选区是实例 Entity 本身，内部实体不被单独选中

#### Scenario: 显式下钻选中内部实体

- **WHEN** 用户对实例执行下钻手势
- **THEN** 命中穿透到内部实体，选区为对应复合地址
- **AND** Scene Tree 同步展开并高亮同一节点

#### Scenario: 退出下钻

- **WHEN** 用户退出下钻上下文
- **THEN** 选区恢复为实例整体，内部命中不再生效

#### Scenario: 下钻不与既有手势冲突

- **WHEN** 下钻手势与平移或框选可能重叠
- **THEN** Stage 手势状态机以确定优先级消解，且不产生同时激活的手势
