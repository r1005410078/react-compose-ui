## MODIFIED Requirements

### Requirement: 手势预览与原子提交

StageInteractionController MUST 在 session 开始冻结 Layout Snapshot。Flow move preview MUST 使用
resolved box 应用位移且 MUST NOT 改变 preview 中的 positioning 语义；Fill resize preview MUST 把
活动 axis 视为 Fixed。Cancel MUST 丢弃全部布局意图 preview，pointerup MUST 请求最多一个命令或
batch。

并发的**外部**文档或布局变化 MUST 中止引用 Entity 的空间手势（移动、缩放、旋转、端点、Paint），
但 MUST NOT 中止绘制手势——绘制只由世界坐标定义，不引用任何 Entity。退出文字编辑时删除空文字
会在同一次指针按下里改动文档，若一并中止，紧接着开始的绘制会当场消失。工具切换仍然中止绘制。

手势自身触发的预览 Snapshot MUST NOT 中止手势：宿主 MUST NOT 把预览 Snapshot 作为 controller
context 的输入（预览只交给场景渲染层），controller context 始终持有提交态文档与 Snapshot，
手势的落点判定与提交几何因此始终以冻结 Snapshot 为准。外部并发文档变化的中止判定不变。

#### Scenario: 混合选择移动并取消
- **WHEN** Flow 与 Absolute 混合选择开始移动后收到 Escape
- **THEN** preview 中的 offset 全部清除并恢复原 Snapshot
- **AND** surface 不收到 dispatch effect

#### Scenario: 绘制中途的文档变化不打断手势

- **WHEN** 绘制手势进行中，文档因删除其他 Entity 而变化
- **THEN** 绘制手势保持进行，松手仍然请求一次 `drawing.commit`
- **AND** 同样情况下的移动手势仍然被中止

#### Scenario: 手势自身的预览 Snapshot 不中止手势

- **WHEN** resize 手势期间宿主经预览通道得到新的预览 Snapshot 并渲染
- **THEN** 手势保持进行，controller context 仍持有提交态 Snapshot，落点与提交几何以冻结
  Snapshot 为准
- **AND** 同一期间到达的外部文档事务仍按既有规则中止手势

### Requirement: 画布拖拽 reparent 会话

StageInteractionController MUST 在 `move` 手势进行中持续判定指针下最深的合法容器（复用
`containerAtPoint` 并排除被拖动选区自身与其后代）。仅当指针进入该容器包围盒内部达到规定比例时才把它
记为候选 reparent 目标；贴边掠过 MUST NOT 触发，且 MUST NOT 使用停留计时作为额外或替代的触发条件。
候选目标 MUST 通过 snapshot 暴露供宿主渲染高亮（与 `previewTransforms`、`drawing` 等既有 preview
状态同一机制，而不是 effect），Controller 自身不持有渲染状态。

落点判定 MUST 接受手势修饰键：按住 `Alt` 时指针命中的最内层合法容器 MUST 直接成为候选 reparent
目标，不再要求深入达到规定比例；手势中按住 `Space` 时 MUST 锁定原父级，任何非原父级容器
MUST NOT 成为候选目标。`Command`（禁用吸附）与 `Shift`（轴锁）的既有语义 MUST 保持不变。

未达到判定条件时：Absolute 目标与顶层自由画布目标 MUST 保持现有行为，坐标在原父级内更新；
Flow 目标 MUST NOT 提交任何修改 `LayoutItem` 的命令（回弹语义由「Auto Layout 容器内原地重排」
约束）。

Pointer Up 时若存在候选 reparent 目标，Controller MUST 提交一次原子 reparent 命令并使用该目标已有
的 Flow/Absolute 默认判定（与 `createReparentCommand` 的 `targetManagesFlow` 规则一致），MUST NOT
新增拖拽手势内的 Flow/Absolute 选择分支，且 MUST NOT 同时发布 Transform 命令——一次手势只表达一个
结构意图。多选拖拽 MUST 按文档顺序提交以保持相对顺序，祖先/后代去重规则 MUST 与既有场景树批量移动
规则一致。Escape 与失去指针捕获时 MUST NOT 提交任何命令。

候选目标失效（锁定、被删除、变为无 Hierarchy）只能经由文档变化发生，而并发文档变化已由「手势预览与
原子提交」判定为不兼容并取消整个空间手势，因此该情形 MUST NOT 提交任何命令；Controller 仍 MUST 在
提交前复核目标有效性，避免未来新增的非文档路径产生指向已失效目标的命令。

#### Scenario: 指针进入容器内部触发候选高亮

- **WHEN** 拖动中的指针进入某合法容器包围盒内部达到判定比例
- **THEN** Controller 在 snapshot 中发布该容器为候选 reparent 目标
- **AND** 指针退出该区域后候选目标清除且不产生任何命令

#### Scenario: 贴边掠过不触发吸入

- **WHEN** 拖动中的指针只在容器边缘附近掠过，未进入内部达到判定比例，且未按 `Alt`
- **THEN** 不产生候选 reparent 目标
- **AND** Absolute 目标 Pointer Up 只更新原父级内坐标，Flow 目标不产生任何命令

#### Scenario: Alt 强制以指针命中容器为落点

- **WHEN** 拖动中按住 `Alt`，指针位于某合法容器边缘留白区内
- **THEN** 该容器立即成为候选 reparent 目标
- **AND** 松开 `Alt` 后恢复深入比例判定

#### Scenario: Space 锁定原父级

- **WHEN** 拖动中按住 `Space`，指针深入了另一个合法容器内部
- **THEN** 不产生指向该容器的候选 reparent 目标
- **AND** Pointer Up 按选区停留在原父级的规则处理

#### Scenario: 提交 reparent 使用目标默认 Flow/Absolute 判定

- **WHEN** Pointer Up 时存在候选 reparent 目标
- **THEN** 提交的 reparent 命令按目标是否为 Layout 容器分别得到 Flow 或 Absolute 的 LayoutItem
- **AND** 不产生第二条独立命令来设置 Flow/Absolute

#### Scenario: 候选目标提交前失效则不提交

- **WHEN** 候选 reparent 目标在 Pointer Up 前被锁定、删除或经其他事务变为不再是合法容器
- **THEN** 该并发文档变化按既有手势原子性取消整个手势，不产生任何命令
- **AND** 不产生指向已失效目标的命令

### Requirement: Auto Layout 容器内原地重排

Controller MUST 支持 Auto Layout 容器内的原地重排。`move` 手势拖动 Layout 容器的 Flow 子级时，
Controller MUST 判定插入位置：`flexWrap` 为 `nowrap` 的容器按指针在主轴上的位置与各兄弟中点比较；
`wrap`/`wrap-reverse` 容器 MUST 先按冻结 Snapshot 中兄弟 box 的交叉轴区间聚类成行（`wrap-reverse`
行序取反），指针交叉轴坐标先选行，再在行内做主轴中点比较。插入序号 MUST 映射回容器原始
`childIds` 下标并复用与 `entity.move` 一致的索引代数。

Pointer Up 时存在顺序变化的插入位置则 MUST 只提交一次改变 `Hierarchy.childIds` 顺序的命令，
MUST NOT 修改该 Entity 的 `LayoutItem`，MUST NOT 发布 Transform 命令。插入位置与拖动前顺序相同、
或整个手势未产生任何 reorder/reparent 落点时，Flow 目标 MUST 回弹：不提交任何命令，历史不增加
条目，MUST NOT 回落为烘焙 Absolute——拖拽 MUST NOT 隐式改变 `LayoutItem.positioning`，脱流只能
经由显式入口（几何 Inspector 的「忽略 Auto Layout」开关）发生。

拖动过程中 Controller MUST 通过 snapshot 发布当前插入位置，供宿主呈现落点预览；预览 MUST NOT 产生
文档事务。一次拖拽 MUST 只表达一种结构意图：当选区并非全部属于同一候选容器时 MUST NOT 进入重排，
改按 reparent 规则统一处理或回弹，MUST NOT 在同一次手势内混合提交重排与其他结构命令。

#### Scenario: 容器内拖拽只重排不烘焙

- **WHEN** 用户在 `nowrap` 容器内把一个 Flow 子级拖到另一个兄弟旁边并在容器内松手
- **THEN** 提交的命令只改变 `Hierarchy.childIds` 顺序
- **AND** 该 Entity 的 `LayoutItem.positioning` 保持 `flow` 且不产生 Transform 命令

#### Scenario: wrap 容器跨行重排

- **WHEN** 用户在 `wrap` 容器内把第二行的 Flow 子级拖到第一行两个兄弟之间并松手
- **THEN** 提交的命令只把该子级移动到第一行对应的 `childIds` 位置
- **AND** `LayoutItem.positioning` 保持 `flow` 且不产生 Transform 命令

#### Scenario: 顺序未变化回弹且不产生事务

- **WHEN** 用户在容器内拖动 Flow 子级后松手，计算出的插入位置与原顺序一致
- **THEN** 不提交任何命令，节点回到布局位置
- **AND** 历史不增加条目且 `LayoutItem` 不变

#### Scenario: 无有效落点时 Flow 目标回弹

- **WHEN** 用户把 Flow 子级拖出容器边界，松手时指针不在任何合法容器的落点判定区内
- **THEN** 不提交任何命令，节点回到原容器的布局位置
- **AND** `LayoutItem.positioning` 保持 `flow`

#### Scenario: 拖动中呈现落点预览

- **WHEN** 用户在 Layout 容器内拖动 Flow 子级并移动指针
- **THEN** Controller 随指针在 snapshot 中发布当前插入位置
- **AND** 预览期间不产生任何文档事务

#### Scenario: 选区跨容器时不进入重排

- **WHEN** 一次拖动的选区同时包含某容器内的 Flow 子级与该容器外的其他目标
- **THEN** 不产生重排落点，整次手势按 reparent 规则统一处理或回弹
- **AND** 不在同一次手势内混合提交重排与其他结构命令
