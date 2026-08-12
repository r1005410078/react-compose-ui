## ADDED Requirements

### Requirement: 组件实例内部下钻与命中

Stage MUST 支持穿透进组件实例内部的命中与选择。默认单击 MUST 选中实例整体；双击 MUST 逐层下钻，
并受既有八层上限约束。下钻 MUST 复用已归一化的 clickCount，MUST NOT 引入独立计时。内部选区 MUST
使用与 Scene Tree 一致的复合地址，并与 Scene Tree 的展开与选中状态双向同步。

#### Scenario: 默认选中实例整体

- **WHEN** 用户单击组件实例
- **THEN** 选区是实例 Entity 本身，内部实体不被单独选中

#### Scenario: 双击下钻选中内部实体

- **WHEN** 用户在 select 工具下双击实例
- **THEN** 命中穿透到内部实体，选区为对应复合地址且不启动移动手势
- **AND** Scene Tree 同步展开并高亮同一节点

#### Scenario: 退出下钻

- **WHEN** 用户退出下钻上下文
- **THEN** 选区恢复为实例整体，内部命中不再生效

#### Scenario: 下钻与文本原地编辑互斥

- **WHEN** 用户双击的目标是 component-instance 或可编辑文本
- **THEN** 只触发下钻或只触发原地编辑，两者不同时激活
