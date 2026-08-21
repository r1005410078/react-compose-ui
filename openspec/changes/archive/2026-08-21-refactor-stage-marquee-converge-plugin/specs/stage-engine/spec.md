## MODIFIED Requirements

### Requirement: 非空容器体的命中收敛

`StageInteractionHit` 的 entity 分支 MUST 携带命中来源 `source`，取值 `body` 与 `label`，
缺省 MUST 视为 `body`。在 `select` 与 `move` 工具下，来源为 `body` 的命中若同时满足
「目标是 `rootIds` 的直接成员」「目标含 Hierarchy」「其 childIds 非空」「该目标不是
first-class Group」「该目标不在当前选区内」，controller MUST NOT 选中
该目标，而是 MUST 起框选，判定几何、方向判定、修饰键布尔组合与「不产生文档事务」MUST 与在
空白 surface 上起框一致。起框所在的容器及其祖先 MUST NOT 出现在框选结果中：用户是在这个
容器「里面」框内容，把它自己选中等于没有收敛。

锁定的容器与 first-class Group MUST 完全退出画布选中：无论是否有子元素、是否顶层、命中
来源是 body 还是 label，controller MUST NOT 选中它们，MUST 起框选。它们的选中入口只剩场景树。
锁定的非容器 Entity MUST 保持既有行为，仍可被选中检查但不可变换。

来源为 `label` 的命中 MUST 始终按普通 entity 命中处理（锁定容器除外）。收敛 MUST 只作用于会渲染标题标签的
顶层容器：嵌套容器与 first-class Group 没有标签，收敛之后将没有任何选中入口，因此
MUST NOT 参与收敛。空容器、已在选区内的容器、非容器
Entity、Shift 加选、锁定判定、marquee 工具与绘制工具的既有分支 MUST NOT 受影响。收敛
MUST NOT 改变 SceneIndex 的 `containerAtPoint` 与外部拖入的落点解析。

收敛判定 MUST 是可独立求值的纯函数，与它触发的框选会话同处一个模块——两者是同一个手势的不同
入口，分开放会让「哪些命中会起框」散在多处。

#### Scenario: 在非空容器空白处起框

- **WHEN** 工具为 `select`，容器含至少一个子元素且不在当前选区内，用户在其空白处按下并拖动
- **THEN** controller 进入 marquee phase，选区在按下瞬间保持不变
- **AND** 松手后按框选判定模式与修饰键组合出结果，不产生该容器的 move 手势
- **AND** 结果只包含被框住的后代，起框容器与其祖先不在其中

#### Scenario: 空容器仍可点体选中

- **WHEN** 容器没有子元素且用户在其上按下
- **THEN** 该容器成为选区并进入 move 手势

#### Scenario: 已选中的容器可以拖体移动

- **WHEN** 容器已在当前选区内且用户在其空白处按下并拖动
- **THEN** controller 进入 move phase，容器随指针移动

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
