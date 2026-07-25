## ADDED Requirements

### Requirement: 原子节点样式命令

core MUST 提供 `node.style.set` 与 `node.style.reset` 内置同步命令。命令 MUST 支持 style 与 shadow
路径、锁定检查、合法性校验、noop 检测和精确 inverse，并 MUST 适用于全部节点 kind。

#### Scenario: 更新并撤销样式路径

- **WHEN** 宿主更新一个未锁定节点的 backgroundColor 或 shadow 子字段
- **THEN** runtime 只提交一个包含完整合法 style 的事务
- **AND** undo 精确恢复命令前 style 是否存在及其原始值

#### Scenario: 重置样式

- **WHEN** 宿主重置一个 style 字段或完整 style
- **THEN** 对应值恢复为节点 kind 默认值，完整重置移除可选 style
- **AND** 等价重置返回 noop

#### Scenario: 拒绝非法或锁定目标

- **WHEN** style 命令目标不存在、已锁定、路径未知或候选值非法
- **THEN** dispatch 返回稳定 rejection
- **AND** 文档、History 和成功事件保持不变
