## MODIFIED Requirements

### Requirement: 布局意图命令原子性

系统 MUST 以结构化命令更新 LayoutItem positioning、axis sizing 与 offset。一次用户 move、nudge、
resize 或 reparent MUST 最多提交一个 command 或 batch，并 MUST 生成完整 inverse。

`setTransform` 的 move 操作 MUST NOT 隐式改变目标的 `LayoutItem.positioning`。Flow→Absolute 的
转换与伴随的 fill→fixed 烘焙 MUST 只在 update 项携带显式脱流意图字段（`detachFromFlow: true`）时
发生；字段缺省为 false，旧命令 JSON 语义不变。意图字段为 true 时，同一事务 MUST 完成 positioning
切换、开始 box 烘焙与最终 offset 写入，undo 一次恢复全部。

#### Scenario: 显式脱流意图原子转换 Absolute
- **WHEN** 一条 move 类 `setTransform` 的 update 项携带 `detachFromFlow: true`
- **THEN** 同一事务把该目标切为 Absolute、烘焙开始 box 并写入最终 offset
- **AND** Undo 一次恢复 positioning、offset 和原父级几何意图

#### Scenario: 无脱流意图的 move 不改 positioning
- **WHEN** 一条 move 类 `setTransform` 作用于 Flow 目标且 update 项未携带脱流意图
- **THEN** 该目标的 `LayoutItem.positioning` 与 axis sizing mode 保持不变
- **AND** 只有 offset 按命令写入

#### Scenario: Resize Fill 转为 Fixed
- **WHEN** 用户直接调整一个 Fill axis 的最终尺寸
- **THEN** 同一事务把该 axis mode 改为 Fixed 并写入最终 value
- **AND** 未调整轴与 Flow 排序保持不变
