## MODIFIED Requirements

### Requirement: 受约束变换 System

Move、Resize 与 Rotate MUST 查询 Transform、Visibility、Lock 和 TransformConstraints。缺失约束
时保持当前自由变换；存在约束时 MUST 限制操作、Resize 轴、宽高比和尺寸区间。

变换目标的解析与提交规划 MUST 由不产生副作用的纯函数承担：前者从文档、场景索引、变换类型
与可选手柄解析出可变换目标与选区 bounds，无可变换目标时返回空结果而不是抛错；后者从已完成
的手势规划出至多一条命令。两者 MUST NOT 创建手势、发布快照或直接产生 surface effect，
使这些判定可以脱离交互会话单独测试。

调用方 MUST 传入同一求解周期的文档与场景索引。

#### Scenario: 使用全部 Resize 模式

- **WHEN** 选区分别配置 free、preserve-aspect、horizontal、vertical 和 none
- **THEN** Engine 只生成对应允许方向的 Transform preview
- **AND** pointerup 命令声明正确操作语义

#### Scenario: Core 与 Engine 一致拒绝锁定

- **WHEN** Entity 不可见、锁定或禁止目标变换
- **THEN** Engine 不开始对应手势且不产生命令 effect

#### Scenario: 目标解析可脱离会话调用

- **WHEN** 以文档、场景索引、变换类型与手柄调用目标解析
- **THEN** 得到按约束过滤后的目标与选区 bounds，且没有任何手势或快照副作用
- **AND** 没有可变换目标时得到空结果

#### Scenario: 提交规划可脱离会话调用

- **WHEN** 以一个已完成的 move、resize 或 rotate 手势调用提交规划
- **THEN** 得到至多一条命令：move 排除 Flow 目标，resize 只改被拖动的轴，
  rotate 的位置与尺寸取持久值
- **AND** 没有可提交的更新时得到空结果
