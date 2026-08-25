## MODIFIED Requirements

### Requirement: 框选判定模式协议

Stage Engine MUST 导出 `StageMarqueeMode`，取值为 `intersect`、`contain` 与 `directional`，并
MUST 提供不依赖 React、DOM 与 controller 实例的纯函数解析框选结果。判定几何 MUST 使用节点的
世界 AABB；`intersect` 表示框与 AABB 有交集，`contain` 表示 AABB 完全落在框内。`directional`
MUST 由拖拽方向决定：起点在终点左侧时等价 `contain`，起点在终点右侧时等价 `intersect`。
纯函数 MUST 显式接收拖拽方向，不得从已归一化的矩形反推。

**默认值 MUST 是 `directional`。**方向决定这套代数一直都在，而默认落在 `intersect` 上时它
等于不存在：不去菜单里手动选一次，拖拽方向就什么都不做——功能在，可达不到。这与「一条能力
只有进了某个模式才看得见」是同一类毛病。两种判定各自都有真实用途（框住整根线 / 抓一把穿过
某片区域的线），而方向是它们之间最快的切换。解析结果 MUST 排除 hidden 与 locked
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

#### Scenario: 缺省即方向决定

- **WHEN** 调用方没有给出判定模式
- **THEN** 解析按方向决定进行：从左往右等价包含，从右往左等价相交

#### Scenario: 排除 hidden 与 locked 节点

- **WHEN** 框覆盖了 hidden 节点与 locked 节点
- **THEN** 两者都不进入结果
