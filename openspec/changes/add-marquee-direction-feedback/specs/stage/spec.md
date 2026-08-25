## MODIFIED Requirements

### Requirement: 选择与框选

select 工具 MUST 支持点击选择、Shift 切换多选、点击空白清除选择和空白拖动 marquee。marquee
工具 MUST 支持从任意位置（含节点之上）拖出 marquee。两个工具的框选 MUST 使用同一个受控
`policy.marqueeMode`，Stage MUST 只消费该值而不得自行持有模式的事实来源——Stage 本身不提供
切换模式的 UI。

marquee Overlay MUST 按**当前生效判定**分色：包含（窗口）与相交（窗交）的填充与描边 MUST
取两个不同的颜色，并 MUST 来自主题 token 而不是写死在 marquee 规则里。虚实边框保留——颜色
回答「哪一种」，虚实是同一句话的第二遍，拖动中的细边框在密集图纸上分辨率很低，两条都用得上。

分色的依据 MUST 是**生效判定**而不是模式：钉死相交时它一直是窗交色，那正是此刻生效的判定。选择结果 MUST 使用稳定文档 ID，并 MUST 忽略 hidden 节点和完全位于其他 Frame
剪裁范围之外的内容。

#### Scenario: 点击与 Shift 多选

- **WHEN** 用户点击一个可见节点，再 Shift 点击另一个可见节点
- **THEN** Stage 请求按交互顺序包含两个 ID 的选择
- **AND** SVG Overlay 显示对应单选或共同世界包围框

#### Scenario: 框选节点

- **WHEN** 用户从 Stage 空白处拖出 marquee
- **THEN** 按当前 `policy.marqueeMode` 命中的可见未锁定节点按确定性场景顺序进入选择
- **AND** marquee 只作为瞬时 SVG Overlay，不产生文档事务

#### Scenario: 使用框选工具从节点上起框

- **WHEN** 工具为 marquee 且用户在一个可见节点上按下并拖动
- **THEN** Stage 显示 marquee Overlay 而不是移动该节点
- **AND** 释放后按当前 `policy.marqueeMode` 请求选择

#### Scenario: Overlay 按判定分色并区分虚实

- **WHEN** 当前生效判定为包含
- **THEN** marquee Overlay 使用实线边框，填充与描边取窗口色
- **AND** 当前生效判定为相交时使用虚线边框，填充与描边取窗交色
- **AND** 两种判定的填充与描边颜色不相同

#### Scenario: 缺省下两个拖拽方向给出不同的框与不同的结果

- **WHEN** 用户没有动过判定模式，分别从左往右与从右往左拖出只盖住某节点一半的框
- **THEN** 两次的 marquee 颜色不同
- **AND** 从左往右那次不选中它，从右往左那次选中它

#### Scenario: 点击空白清选

- **WHEN** select 工具下用户点击未命中 Frame 内容或节点的空白
- **THEN** Stage 请求空选择
- **AND** 文档与 activeFrameId 保持不变

