## ADDED Requirements

### Requirement: Group 命中先选组，双击穿过一层

`stage-engine` MUST 提供一个纯函数解算（`resolveStageGroupHit`），把指针命中的最深 Entity 按
Group 门槛解算成这次按下真正作用的对象。规则 MUST 只有三条：

- **单击选中最外层还没进入的 Group**：命中项的祖先链上，所有「是 first-class Group 且不是当前
  选区任何一项的严格祖先」的那些是门槛，取最外层的一个；没有门槛就是命中项自己。
- **双击穿过一层**：落到那个门槛的**直接子级**（沿命中链往下一格）。它可能仍是一个 Group，于是
  下一次双击再进一层；也可能就是命中项本身。解算 MUST 报告这一下是不是下钻（`descended`）。
- **深选无视门槛**：`command` 修饰键按下时直接是命中项。

「已进入」MUST 从选区派生，MUST NOT 另存状态：选区里任何一项的**严格**祖先都算进入过；
选中 Group 自己 MUST NOT 算进入（它不是自己的严格祖先）。复合地址（实例内部）MUST 按宿主
实例算祖先链。选区里已不在文档中的 ID MUST NOT 参与判定。

锁定的门槛 MUST NOT 下钻：不论连击计数，解算成那个 Group 自己，交给收敛规则按锁定处理。

判据 MUST 只读 first-class Group；容器（Frame、Auto Layout 容器）MUST NOT 是门槛。

四个读实体命中的插件（容器体收敛、空心移动兜底、几何编辑兜底、实体选中并拖动）MUST 读同一个
解算结果，MUST NOT 各自按裸命中判断。

#### Scenario: 单击 Group 深处的对象选中最外层 Group

- **WHEN** 选区为空，用户单击 `outer(Group) › inner(Group) › leaf` 里的 `leaf`
- **THEN** 解算结果是 `outer`，且不是下钻

#### Scenario: 双击穿过一层

- **WHEN** 选区是 `outer`，用户在 `leaf` 上双击（连击计数为 2）
- **THEN** 解算结果是 `inner`，且标记为下钻

#### Scenario: 已进入的 Group 不再是门槛

- **WHEN** 选区是 `inner`（`outer` 因此已进入），用户单击 `outer` 的另一个子级 `sibling`
- **THEN** 解算结果是 `sibling`

#### Scenario: 选中 Group 自己不算进入

- **WHEN** 选区是 `outer`，用户单击 `sibling`
- **THEN** 解算结果仍是 `outer`

#### Scenario: 深选无视门槛

- **WHEN** 用户按住 `command` 单击 `leaf`
- **THEN** 解算结果是 `leaf`

#### Scenario: 锁定的门槛不下钻

- **WHEN** `outer` 锁定，用户在 `leaf` 上双击
- **THEN** 解算结果是 `outer`，且不是下钻

#### Scenario: 复合地址按宿主实例算进入

- **WHEN** 选区是 `sibling/part`（下钻进实例 `sibling` 内部的复合地址），用户单击 `sibling`
- **THEN** `outer` 算已进入，解算结果是 `sibling`

## MODIFIED Requirements

### Requirement: 实体命中的选中与拖动

在实体上按下 MUST 先把命中过一遍 Group 门槛解算（见「Group 命中先选组，双击穿过一层」），
再对解算出来的对象请求选区变更，随后按工具与目标状态决定这次按下的后续语义：解算报告为
**下钻**时只改选区并消费这次按下，MUST NOT 开始移动，也 MUST NOT 进入文字或几何编辑——那一下
的含义是「进到这一层」；select 工具下对可编辑目标的双击进入原地文字编辑且 MUST NOT 开始移动；
select 工具下对可几何编辑目标的双击进入几何编辑且 MUST NOT 开始移动；select/move 工具下未锁定
的目标开始移动；其余情形只改选区。

两种双击目标 MUST 由宿主注入的判定给出，引擎 MUST NOT 自己去读文档判断谁可编辑——它不认识
文档协议。文字可编辑 MUST 优先于几何可编辑：一次双击只能进一个会话。

选区变更 MUST 先于指针捕获发出——宿主据此更新选中态，顺序颠倒会让捕获落在旧选区上。

基准选区 MUST 滤掉已从文档中消失的 ID，否则 Shift 加选会把失效引用一路带进新选区。

无论是否开始移动，这次按下 MUST 被消费：选区已经改过了，再交给后续插件会让同一次按下既改
选区又起框。命中不存在的 Entity 时 MUST NOT 产生任何效果——命中判定与文档已经脱节。

#### Scenario: 按下即改选区并开始移动

- **WHEN** select 工具下在未锁定实体上按下
- **THEN** 先请求把选区改为该实体，再开始移动手势

#### Scenario: 单击 Group 的子级选中 Group 并拖动它

- **WHEN** 选区为空，select 工具下在 Group 的子级上按下
- **THEN** 先请求把选区改为最外层 Group，再开始移动 Group 的手势

#### Scenario: 双击穿过 Group 只改选区

- **WHEN** 选区是那个 Group，select 工具下在它的子级上双击
- **THEN** 请求把选区改为该子级，不开始移动，也不进入文字或几何编辑

#### Scenario: Shift 点击没进入的 Group 的子级加进的是 Group

- **WHEN** 用户 Shift 点击一个还没进入的 Group 的子级
- **THEN** 加进选区的是那个 Group

#### Scenario: 双击进入编辑而不拖动

- **WHEN** select 工具下双击一个可原地编辑的实体
- **THEN** 请求进入文字编辑，且不开始移动手势

#### Scenario: 双击曲线进入几何编辑

- **WHEN** select 工具下双击一个可几何编辑的未锁定实体
- **THEN** 请求进入几何编辑，且不开始移动手势

#### Scenario: 宿主没有注入几何判定

- **WHEN** 宿主没有传入几何可编辑判定，用户双击一个实体
- **THEN** 行为与今天完全一致，不请求进入几何编辑

#### Scenario: 锁定目标只改选区

- **WHEN** 用户在锁定实体上按下
- **THEN** 选区变为该实体，不开始移动，也不落到框选

#### Scenario: Shift 组合忽略失效引用

- **WHEN** 既有选区含已被删除的 ID，用户 Shift 点击另一个实体
- **THEN** 新选区只含仍然存在的实体

#### Scenario: 命中不存在的实体

- **WHEN** 命中的 Entity 已不在文档中
- **THEN** 不产生任何效果，也不开始框选

### Requirement: 顶层容器体的命中收敛

`StageInteractionHit` 的 entity 分支 MUST 携带命中来源 `source`，取值 `body` 与 `label`，
缺省 MUST 视为 `body`。收敛判定 MUST 作用于**过了 Group 门槛之后**的命中（见「Group 命中先
选组，双击穿过一层」）：命中一个锁定 Group 的子级，看到的必须是那个锁定的 Group。在 `select`
工具下，来源为 `body` 的命中若同时满足「目标是 `rootIds` 的直接成员」「目标含 Hierarchy」
「该目标不是 first-class Group」，controller MUST NOT 选中该目标，而是 MUST 起框选，判定几何、
方向判定、修饰键布尔组合与「不产生文档事务」MUST 与在空白 surface 上起框一致。起框所在的容器
及其祖先 MUST NOT 出现在框选结果中：用户是在这个容器「里面」框内容，把它自己选中等于没有收敛。

收敛 MUST NOT 因为目标为空（`childIds` 为空）而放弃，也 MUST NOT 因为目标已在当前选区内而
放弃。这两条曾经的例外各自制造了一条搬走整块场景的路径：空场景整块都是拖动把手，而用户
几乎总是先选中场景再去框选它的内容，此时保护恰好失效。两者都有标题标签这个不受影响的
选中入口，因此没有「收敛之后就选不中了」的补偿问题。

按住 `command` 修饰键在收敛目标的体上按下 MUST 直接选中该目标并进入 move 手势，作为标题
标签之外的第二个入口。该修饰键 MUST NOT 改变收敛在其余情形下的判定，也 MUST NOT 影响
`shift` 的加选语义。

锁定的容器与 first-class Group MUST 完全退出画布选中：无论是否有子元素、是否顶层、命中
来源是 body 还是 label，controller MUST NOT 选中它们，MUST 起框选。它们的选中入口只剩场景树。
锁定 Group 的子级 MUST 同样收敛（门槛把命中抬到那个 Group 上）。锁定的非容器 Entity MUST
保持既有行为，仍可被选中检查但不可变换。

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

#### Scenario: 锁定 Group 的子级同样收敛

- **WHEN** 用户在锁定 Group 的子级上按下或双击
- **THEN** 选区不发生变化，controller 进入 marquee phase

#### Scenario: 嵌套容器不参与收敛

- **WHEN** 用户在一个含子元素、但父级不是画布根的容器上按下
- **THEN** 该容器成为选区并进入 move 手势

#### Scenario: Group 不参与收敛

- **WHEN** 用户在含子项的 first-class Group 上按下
- **THEN** 该 Group 成为选区并进入 move 手势

#### Scenario: 标签来源不参与收敛

- **WHEN** 命中来源为 `label` 且目标是含子元素的容器
- **THEN** 该容器成为选区并进入 move 手势
