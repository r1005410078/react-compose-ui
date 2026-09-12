## ADDED Requirements

### Requirement: 变换指示器把手的命中与仲裁

变换指示器的把手 MUST 是一个独立的命中类型（携带 `x` / `y` / `rotate` 三者之一），并由一个
独立插件接管，MUST NOT 混进实体选择或缩放分支。

指示器的开关 MUST 只影响把手的存在，MUST NOT 改变别处任何一次拖动的含义——它是 chrome 的
可见性而不是模式。

插件优先级 MUST 高于 `entity-select-move` 与 `resize`：圆环会横穿盒手柄与圆角把手，排在它们
之下等于环在四个角上按不动，而那正是环最容易被抓到的地方。同时 MUST 低于 `path` 与 `paint`
把手——那些是**别的编辑会话**的把手，指示器不该把它们偷走。

轴把手 MUST 产出一次**受该轴约束**的平移，并复用移动手势既有的提交漏斗；MUST NOT 写
`Transform.rotation`。

圆环 MUST 复用既有的旋转会话（其中心已经是该 Entity 的旋转基点），MUST NOT 另写一份旋转数学
——另写的那份必然在 Shift 角度吸附、`baseRotation` 与并发中止三处里漏掉一两处。圆环 MUST NOT
写 `LayoutItem.offset`。

把手几何 MUST 是可独立求值的纯函数，输入是基点世界坐标、该 Entity 的 `rotation` 与当前缩放。

#### Scenario: 环压过盒手柄

- **WHEN** 圆环与某个缩放手柄在屏幕上重叠处被按下
- **THEN** 开始的是旋转会话，不是缩放

#### Scenario: 别的编辑会话的把手不被偷走

- **WHEN** 指示器显示着，同时按下一个路径顶点或 Paint 控制柄
- **THEN** 接管的仍是那条既有会话

#### Scenario: 拖轴不改角度

- **WHEN** 拖动 X 轴的方块把手
- **THEN** 该 Entity 的 `Transform.rotation` 不变

#### Scenario: 拖环不改位置

- **WHEN** 拖动圆环
- **THEN** 该 Entity 的 `LayoutItem.offset` 不变

#### Scenario: 轴方向跟随对象旋转

- **WHEN** 目标已经转过 30°
- **THEN** 求出的两条轴方向同样是 30° 与 120°

## REMOVED Requirements

### Requirement: 旋转工具插件

**移除理由**：`rotate` 工具值连同它的插件一起删除，旋转的入口改为变换指示器的圆环。

判据是「模式必须是对象作用域且有明确的进出」：`rotate` 是一个工具、也就是模式，切过去之后
画布上**每一次**拖动的含义都变了；而指示器打开之后只有**把手上**的拖动有新含义。留着它还会
让旋转有两个入口，是「工具集只保留没有别的入口的动作」禁止的那一类。

原插件承担的能力全部由指示器覆盖：单选绕该 Entity 的旋转基点转、多选绕选区包围盒中心转、
Shift 角度吸附、并发文档变化中止。旋转会话本身**不删除**——圆环复用它。

优先级表的 `rotate-tool`(1600)、`legacy-rotate-hit`(500) 与 `rotate-tool-fallback`(200)
三项一并删除；`gizmo`(1200) 不是它们的替代，位置与条件都不同。
