## ADDED Requirements

### Requirement: Stage Engine 空间命令规划

`@compose-ui/stage-engine` MUST 基于当前只读文档创建 core 可执行的 transform、group、ungroup、
reparent 与 duplicate 命令。空间规划 MUST 与 runtime dispatch 分离；只有 surface adapter
应用 dispatch effect 时才允许进入正式事务。

#### Scenario: 预览不进入事务

- **WHEN** interaction controller 计算一次或多次节点变换 preview
- **THEN** runtime 文档、事务历史和 operation event 保持不变
- **AND** pointerup 的最终 dispatch effect 最多形成一个正式事务

#### Scenario: SceneTree 与 Stage 共用规划

- **WHEN** SceneTree 跨父级移动或 Stage 执行分组结构操作
- **THEN** 两者使用同一 stage-engine 空间命令工厂
- **AND** core 继续独立校验 payload、生成 Patch 与 inverse
