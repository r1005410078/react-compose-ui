## MODIFIED Requirements

### Requirement: 框选判定模式协议

Stage Engine MUST 导出 `StageMarqueeHitTest`，取值为 `intersect` 与 `contain`，并 MUST 提供
不依赖 React、DOM 与 controller 实例的纯函数解析框选结果。判定几何 MUST 使用节点的世界
AABB；`intersect` 表示框与 AABB 有交集，`contain` 表示 AABB 完全落在框内。

**判定 MUST 恒由拖拽方向决定**：起点在终点左侧时为 `contain`，起点在终点右侧时为
`intersect`。MUST NOT 提供第三个「可选模式」值，也 MUST NOT 接受一个覆盖方向的模式参数。

方向本身就是切换器：一次拖拽即可选定，比开一个菜单快，也不残留状态。一个能改变「同一个拖拽
手势意味着什么」的全局开关，与「模式必须是对象作用域且有明确的进出」直接冲突；而两种判定
各自都有真实用途（框住整根导线 / 抓一把穿过某片区域的线），方向是它们之间最快的切换。

类型名 MUST 反映它不是一个模式而是**方向的归约结果**：命中与覆盖层读的都是这个结果。

纯函数 MUST 显式接收拖拽方向，不得从已归一化的矩形反推。解析结果 MUST 排除 hidden 与 locked
节点，并 MUST 按确定性场景顺序返回稳定文档 ID。

#### Scenario: 相交模式选中部分重叠节点

- **WHEN** 以 `intersect` 模式解析一个只与节点 AABB 部分重叠的框
- **THEN** 该节点进入结果

#### Scenario: 包含模式排除部分重叠节点

- **WHEN** 以 `contain` 模式解析同一个只与节点 AABB 部分重叠的框
- **THEN** 该节点不进入结果
- **AND** AABB 完全落在框内的节点仍进入结果

#### Scenario: 判定按拖拽方向切换

- **WHEN** 以 `directional` 模式解析同一个框，方向为从左往右
- **THEN** 结果与 `contain` 模式一致
- **AND** 方向为从右往左时结果与 `intersect` 模式一致

#### Scenario: 没有可选模式可传

- **WHEN** 调用方解析一次框选
- **THEN** 它只能给出拖拽方向，没有任何参数可以覆盖由方向得出的判定

#### Scenario: 排除 hidden 与 locked 节点

