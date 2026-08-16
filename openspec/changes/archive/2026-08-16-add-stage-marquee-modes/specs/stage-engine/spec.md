## ADDED Requirements

### Requirement: 框选判定模式协议

Stage Engine MUST 导出 `StageMarqueeMode`，取值为 `intersect`、`contain` 与 `directional`，并
MUST 提供不依赖 React、DOM 与 controller 实例的纯函数解析框选结果。判定几何 MUST 使用节点的
世界 AABB；`intersect` 表示框与 AABB 有交集，`contain` 表示 AABB 完全落在框内。`directional`
MUST 由拖拽方向决定：起点在终点左侧时等价 `contain`，起点在终点右侧时等价 `intersect`。
纯函数 MUST 显式接收拖拽方向，不得从已归一化的矩形反推。解析结果 MUST 排除 hidden 与 locked
节点，并 MUST 按确定性场景顺序返回稳定文档 ID。

#### Scenario: 相交模式选中部分重叠节点

- **WHEN** 以 `intersect` 模式解析一个只与节点 AABB 部分重叠的框
- **THEN** 该节点进入结果

#### Scenario: 包含模式排除部分重叠节点

- **WHEN** 以 `contain` 模式解析同一个只与节点 AABB 部分重叠的框
- **THEN** 该节点不进入结果
- **AND** AABB 完全落在框内的节点仍进入结果

#### Scenario: 方向决定模式按拖拽方向切换判定

- **WHEN** 以 `directional` 模式解析同一个框，方向为从左往右
- **THEN** 结果与 `contain` 模式一致
- **AND** 方向为从右往左时结果与 `intersect` 模式一致

#### Scenario: 排除 hidden 与 locked 节点

- **WHEN** 框覆盖了 hidden 节点与 locked 节点
- **THEN** 两者都不进入结果

### Requirement: 框选工具与选区布尔组合

Stage Engine MUST 提供 `marquee` 工具值；该工具下 pointer 在节点上按下 MUST 起框而不是命中该
节点。`select` 工具 MUST 保持只在空白处起框。两个入口 MUST 使用受控传入的同一个
`StageMarqueeMode`，未传入时 MUST 回退 `intersect`。框选提交 MUST 按修饰键与已有选区组合：
无修饰键替换选区，Shift 与已有选区求并集，Alt 从已有选区中移除。框选 MUST 只发布瞬时
snapshot 与 selection effect，不得产生文档事务。

#### Scenario: 框选工具从节点上起框

- **WHEN** 工具为 `marquee` 且用户在一个可见节点上按下并拖动
- **THEN** controller 进入 marquee phase 并发布框选预览
- **AND** 不发生该节点的 move 手势

#### Scenario: 选择工具保持空白起框

- **WHEN** 工具为 `select` 且用户在一个可见节点上按下并拖动
- **THEN** controller 进入 move phase

#### Scenario: Shift 加选与 Alt 减选

- **WHEN** 已有选区存在且用户按住 Shift 完成一次框选
- **THEN** 框选结果与已有选区求并集
- **AND** 按住 Alt 完成框选时框选结果从已有选区中移除

#### Scenario: 未传入模式时回退相交

- **WHEN** 宿主未提供 `marqueeMode`
- **THEN** 判定使用 `intersect`
