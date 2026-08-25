## MODIFIED Requirements

### Requirement: 选择与框选

select 工具 MUST 支持点击选择、Shift 切换多选、点击空白清除选择和空白拖动 marquee。marquee
工具 MUST 支持从任意位置（含节点之上）拖出 marquee。框选的判定 MUST 恒由拖拽方向决定，
MUST NOT 由任何受控 prop、宿主开关或 Stage 自持状态覆盖——方向就是切换器，再给一个开关等于
给同一件事造第二个、更慢的入口。

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
- **THEN** 按拖拽方向决定的判定命中的可见未锁定节点按确定性场景顺序进入选择
- **AND** marquee 只作为瞬时 SVG Overlay，不产生文档事务

#### Scenario: 使用框选工具从节点上起框

- **WHEN** 工具为 marquee 且用户在一个可见节点上按下并拖动
- **THEN** Stage 显示 marquee Overlay 而不是移动该节点
- **AND** 释放后按拖拽方向决定的判定请求选择

#### Scenario: Overlay 按判定分色并区分虚实

- **WHEN** 当前生效判定为包含
- **THEN** marquee Overlay 使用实线边框，填充与描边取窗口色
- **AND** 当前生效判定为相交时使用虚线边框，填充与描边取窗交色
- **AND** 两种判定的填充与描边颜色不相同

#### Scenario: 两个拖拽方向给出不同的框与不同的结果

- **WHEN** 分别从左往右与从右往左拖出只盖住某节点一半的框
- **THEN** 两次的 marquee 颜色不同
- **AND** 从左往右那次不选中它，从右往左那次选中它

### Requirement: Stage 注入面聚合

`ComposeStageProps` MUST 把宿主注入面收敛为 `services` 与 `policy` 两个聚合对象。
`services` MUST 承载宿主拥有的能力端口（`dispatch`、`registry`、`assetResolver`、
`pageLoader`、`scriptModuleLoader`、`clipboard`、`onClipboardChange`、`layoutRuntime`）。
Stage MUST 按字段消费 `services`，MUST NOT 以其对象引用作为场景子树或 measurement adapter
的缓存键。`policy` MUST 承载宿主拥有事实来源、Stage 只消费的开关（`lockGestureParent`、
`gridVisible`），Stage MUST NOT 为其中任何一项持有事实来源或提供切换 UI。
框选判定 MUST NOT 出现在 `policy` 里：它恒由拖拽方向决定，宿主没有可持有的事实来源。

受控协议（`viewport`、`tool`、`selectedIds`、`activeFrameId` 及其 `onChange`）、逐帧数据
（`document`、`layoutSnapshot`、`layoutPreviewSnapshot`、`layoutError`、`scriptScope`）与
快捷键（`shortcuts`、`onShortcutAction`）MUST 保持平铺。上述聚合项的同名平铺 prop
MUST 被删除，且 MUST NOT 提供兼容别名或运行时迁移层。

#### Scenario: 端口经 services 注入

- **WHEN** 宿主通过 `services` 注入 `assetResolver` 与 `pageLoader` 并渲染 Stage
- **THEN** 资源节点创建与页面实体渲染的行为与聚合前完全一致
- **AND** 省略某个可选端口时该端口对应能力呈现既有的缺省状态

#### Scenario: 模式语义经 policy 注入

- **WHEN** 宿主传入 `policy.lockGestureParent` 为 true 并在画布上拖动一个对象
- **THEN** 拖动不产生跨父级挂载，同容器重排照常
- **AND** 该行为与聚合前的平铺 `lockGestureParent` 逐项一致

#### Scenario: 端口按字段消费

- **WHEN** 宿主重新构造 `services` 对象但其中各端口的值未变
- **THEN** Stage MUST NOT 因此重建场景子树、重建 measurement adapter 或重置进行中的交互会话

#### Scenario: policy 变化不牵动端口

- **WHEN** 宿主因模式切换更新 `policy` 而 `services` 各端口未变
- **THEN** Stage MUST NOT 因此重建场景子树或重置进行中的交互会话

