## RENAMED Requirements

- FROM: `### Requirement: 非空容器体的命中收敛`
- TO: `### Requirement: 顶层容器体的命中收敛`

## MODIFIED Requirements

### Requirement: 顶层容器体的命中收敛

`StageInteractionHit` 的 entity 分支 MUST 携带命中来源 `source`，取值 `body` 与 `label`，
缺省 MUST 视为 `body`。在 `select` 工具下，来源为 `body` 的命中若同时满足
「目标是 `rootIds` 的直接成员」「目标含 Hierarchy」「该目标不是 first-class Group」，
controller MUST NOT 选中该目标，而是 MUST 起框选，判定几何、方向判定、修饰键布尔组合与
「不产生文档事务」MUST 与在空白 surface 上起框一致。起框所在的容器及其祖先 MUST NOT 出现在
框选结果中：用户是在这个容器「里面」框内容，把它自己选中等于没有收敛。

收敛 MUST NOT 因为目标为空（`childIds` 为空）而放弃，也 MUST NOT 因为目标已在当前选区内而
放弃。这两条曾经的例外各自制造了一条搬走整块场景的路径：空场景整块都是拖动把手，而用户
几乎总是先选中场景再去框选它的内容，此时保护恰好失效。两者都有标题标签这个不受影响的
选中入口，因此没有「收敛之后就选不中了」的补偿问题。

按住 `command` 修饰键在收敛目标的体上按下 MUST 直接选中该目标并进入 move 手势，作为标题
标签之外的第二个入口。该修饰键 MUST NOT 改变收敛在其余情形下的判定，也 MUST NOT 影响
`shift` 的加选语义。

锁定的容器与 first-class Group MUST 完全退出画布选中：无论是否有子元素、是否顶层、命中
来源是 body 还是 label，controller MUST NOT 选中它们，MUST 起框选。它们的选中入口只剩场景树。
锁定的非容器 Entity MUST 保持既有行为，仍可被选中检查但不可变换。

来源为 `label` 的命中 MUST 始终按普通 entity 命中处理（锁定容器除外）。收敛 MUST 只作用于会
渲染标题标签的顶层容器：嵌套容器与 first-class Group 没有标签，收敛之后将没有任何选中入口，
因此 MUST NOT 参与收敛。非容器 Entity、Shift 加选、锁定判定与绘制工具的既有分支 MUST NOT
受影响。收敛 MUST NOT 改变 SceneIndex 的 `containerAtPoint` 与外部拖入的落点解析。

收敛判定 MUST 是可独立求值的纯函数，与它触发的框选会话同处一个模块——两者是同一个手势的不同
入口，分开放会让「哪些命中会起框」散在多处。

#### Scenario: 在非空容器空白处起框

- **WHEN** 工具为 `select`，容器含至少一个子元素且不在当前选区内，用户在其空白处按下并拖动
- **THEN** controller 进入 marquee phase，选区在按下瞬间保持不变
- **AND** 松手后按框选判定模式与修饰键组合出结果，不产生该容器的 move 手势
- **AND** 结果只包含被框住的后代，起框容器与其祖先不在其中

#### Scenario: 空的顶层容器同样收敛

- **WHEN** 顶层容器没有子元素且用户在其体上按下并拖动
- **THEN** controller 进入 marquee phase，该容器不成为选区也不进入 move 手势

#### Scenario: 已选中的顶层容器同样收敛

- **WHEN** 顶层容器已在当前选区内且用户在其空白处按下并拖动
- **THEN** controller 进入 marquee phase，该容器不随指针移动

#### Scenario: 收敛目标上单击清空选区

- **WHEN** 用户在收敛的顶层容器体上按下并原地松手
- **THEN** 框退化为零面积，选区被清空，不产生任何文档事务

#### Scenario: command 点体直选并拖动

- **WHEN** 用户按住 `command` 在收敛的顶层容器体上按下并拖动
- **THEN** 该容器成为选区并进入 move 手势

#### Scenario: 锁定容器与 Group 不可在画布上选中

- **WHEN** 用户在锁定的容器或 first-class Group 上按下，无论来源是 body 还是 label
- **THEN** 选区不发生变化，controller 进入 marquee phase
- **AND** 锁定的非容器 Entity 仍可被选中检查

#### Scenario: 嵌套容器不参与收敛

- **WHEN** 用户在一个含子元素、但父级不是画布根的容器上按下
- **THEN** 该容器成为选区并进入 move 手势

#### Scenario: Group 不参与收敛

- **WHEN** 用户在含子项的 first-class Group 上按下
- **THEN** 该 Group 成为选区并进入 move 手势

#### Scenario: 标签来源不参与收敛

- **WHEN** 命中来源为 `label` 且目标是含子元素的容器
- **THEN** 该容器成为选区并进入 move 手势

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

解析结果 MUST 排除 `rootIds` 的直接成员：框选表达的是「选这些内容」，而场景是容器不是内容，
把它一并选中之后紧接着的移动会整体搬走场景，且子级是相对坐标因而画面上看不出发生了什么。
该排除 MUST 不依赖框与场景的相对位置——从场景外面框住它同样不选中。其余 Frame（嵌套 Frame）
MUST 保持「完全包住框选区时不进入结果」的既有规则：它们没有标题标签，点体仍是唯一的画布
选中入口，一并排除会让它们够不着而没有补偿。

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

#### Scenario: 窗交框蹭到场景边缘不选中场景

- **WHEN** 从工作区空白从右往左拖一个与某块场景边缘相交、但不包住它的框
- **THEN** 该场景不进入结果，只有被框到的场景内容进入结果

#### Scenario: 从外面框住整块场景也不选中它

- **WHEN** 拖一个从左往右、完全包住某块场景的框
- **THEN** 该场景不进入结果，其被框住的后代进入结果

#### Scenario: 嵌套 Frame 保持既有排除规则

- **WHEN** 在一个嵌套 Frame 内部拖一个被它完全包住的框
- **THEN** 该嵌套 Frame 不进入结果
- **WHEN** 改为拖一个完全包住该嵌套 Frame 的框
- **THEN** 该嵌套 Frame 进入结果
