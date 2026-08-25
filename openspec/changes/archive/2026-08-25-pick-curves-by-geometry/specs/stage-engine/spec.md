# Stage Engine 规范增量

## MODIFIED Requirements

### Requirement: 框选判定模式协议

Stage Engine MUST 导出 `StageMarqueeHitTest`，取值为 `intersect` 与 `contain`，并 MUST 提供
不依赖 React、DOM 与 controller 实例的纯函数解析框选结果。

判定几何 MUST 按 Entity 类型分流，与 `StageSceneIndex.entityAtPoint` 已有的分流形状一致：

- 盒模型 Entity 用节点的世界 AABB；`intersect` 表示框与 AABB 有交集，`contain` 表示 AABB
  完全落在框内。
- 带 `Curve` 的 Entity MUST 按**几何**判定，MUST NOT 用 AABB。盒里绝大部分是空的——一个从不
  碰线身的框选中斜线，与「点击包围盒空角不选中曲线」是同一条判断被破坏。

曲线的世界几何 MUST 复用点选与特征点走的同一条链（投影到盒，再经世界矩阵送到世界空间），
MUST NOT 把框逆变换进几何空间：非等比缩放会把矩形变成平行四边形，四条边不再轴对齐。

**填充过的曲线是例外**：框落在可见填充区域内 MUST 算命中，判断 MUST 走与点选路径相同的读取
入口。空心时 MUST NOT 做这一步。

非曲线 Entity 的**旋转仍用 AABB**，这是一处明写的欠账：旋转节点的 AABB 大于其图形，因此
`contain` 对它们偏严格。规范 MUST 保留这句话，直到矩形对凸四边形的判定落地。

**判定 MUST 恒由拖拽方向决定**：起点在终点左侧时为 `contain`，起点在终点右侧时为
`intersect`。MUST NOT 提供第三个「可选模式」值，也 MUST NOT 接受一个覆盖方向的模式参数。

方向本身就是切换器：一次拖拽即可选定，比开一个菜单快，也不残留状态。一个能改变「同一个拖拽
手势意味着什么」的全局开关，与「模式必须是对象作用域且有明确的进出」直接冲突；而两种判定
各自都有真实用途（框住整根导线 / 抓一把穿过某片区域的线），方向是它们之间最快的切换。

类型名 MUST 反映它不是一个模式而是**方向的归约结果**：命中与覆盖层读的都是这个结果。

纯函数 MUST 显式接收拖拽方向，不得从已归一化的矩形反推。解析结果 MUST 排除 hidden 与 locked
节点，并 MUST 按确定性场景顺序返回稳定文档 ID。

#### Scenario: 相交模式选中部分重叠节点

- **WHEN** 以 `intersect` 判定解析一个只与盒模型节点 AABB 部分重叠的框
- **THEN** 该节点进入结果

#### Scenario: 包含模式排除部分重叠节点

- **WHEN** 以 `contain` 判定解析同一个只与节点 AABB 部分重叠的框
- **THEN** 该节点不进入结果
- **AND** AABB 完全落在框内的节点仍进入结果

#### Scenario: 窗交框不因碰到曲线包围盒而命中

- **WHEN** 从右往左在一条斜线包围盒的空角里拖一个从不与线身相交的框
- **THEN** 该曲线不进入结果

#### Scenario: 窗交框穿过线身仍然命中

- **WHEN** 从右往左拖一个与同一条斜线的线身相交的框
- **THEN** 该曲线进入结果

#### Scenario: 框落在填充区内命中

- **WHEN** 在一个有不透明填充的整圆曲线内部拖一个完全落在填充区内的窗交框
- **THEN** 该曲线进入结果

#### Scenario: 空心形状内部的框不命中

- **WHEN** 同一个整圆曲线没有填充，在其内部拖同一个框
- **THEN** 该曲线不进入结果

#### Scenario: 判定按拖拽方向切换

- **WHEN** 解析同一个框，方向为从左往右
- **THEN** 结果与 `contain` 判定一致
- **AND** 方向为从右往左时结果与 `intersect` 判定一致

#### Scenario: 没有可选模式可传

- **WHEN** 调用方解析一次框选
- **THEN** 它只能给出拖拽方向，没有任何参数可以覆盖由方向得出的判定

#### Scenario: 排除 hidden 与 locked 节点

- **WHEN** 框覆盖一个 hidden 节点与一个 locked 节点
- **THEN** 两者都不进入结果
