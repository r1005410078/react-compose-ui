## ADDED Requirements

### Requirement: 布局意图命令原子性

系统 MUST 以结构化命令更新 LayoutItem positioning、axis sizing 与 offset。一次用户 move、nudge、
resize 或 reparent MUST 最多提交一个 command 或 batch，并 MUST 生成完整 inverse。

#### Scenario: Flow move 原子转换 Absolute
- **WHEN** 用户完成一次包含 Flow 与 Absolute 目标的 Stage move
- **THEN** 一个事务把 Flow 目标切为 Absolute、烘焙开始 box 并写入最终 offset
- **AND** Undo 一次恢复全部目标的 positioning、offset 和原父级几何意图

#### Scenario: Resize Fill 转为 Fixed
- **WHEN** 用户直接调整一个 Fill axis 的最终尺寸
- **THEN** 同一事务把该 axis mode 改为 Fixed 并写入最终 value
- **AND** 未调整轴与 Flow 排序保持不变

