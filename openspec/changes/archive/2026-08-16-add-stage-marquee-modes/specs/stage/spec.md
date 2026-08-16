## MODIFIED Requirements

### Requirement: 选择与框选

select 工具 MUST 支持点击选择、Shift 切换多选、点击空白清除选择和空白拖动 marquee。marquee
工具 MUST 支持从任意位置（含节点之上）拖出 marquee。两个工具的框选 MUST 使用同一个受控
`marqueeMode` prop，Stage MUST 只消费该值而不得自行持有模式的事实来源——Stage 本身不提供切换
模式的 UI。选择结果 MUST 使用稳定文档 ID，并 MUST 忽略 hidden 节点和完全位于其他 Frame 剪裁
范围之外的内容。

#### Scenario: 点击与 Shift 多选

- **WHEN** 用户点击一个可见节点，再 Shift 点击另一个可见节点
- **THEN** Stage 请求按交互顺序包含两个 ID 的选择
- **AND** SVG Overlay 显示对应单选或共同世界包围框

#### Scenario: 框选节点

- **WHEN** 用户从 Stage 空白处拖出 marquee
- **THEN** 按当前 `marqueeMode` 命中的可见未锁定节点按确定性场景顺序进入选择
- **AND** marquee 只作为瞬时 SVG Overlay，不产生文档事务

#### Scenario: 使用框选工具从节点上起框

- **WHEN** 工具为 marquee 且用户在一个可见节点上按下并拖动
- **THEN** Stage 显示 marquee Overlay 而不是移动该节点
- **AND** 释放后按当前 `marqueeMode` 请求选择

#### Scenario: Overlay 区分判定模式

- **WHEN** 当前生效判定为包含
- **THEN** marquee Overlay 使用实线边框
- **AND** 当前生效判定为相交时使用虚线边框

#### Scenario: 点击空白清选

- **WHEN** select 工具下用户点击未命中 Frame 内容或节点的空白
- **THEN** Stage 请求空选择
- **AND** 文档与 activeFrameId 保持不变
