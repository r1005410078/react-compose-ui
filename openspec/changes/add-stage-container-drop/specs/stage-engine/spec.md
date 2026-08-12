## MODIFIED Requirements

### Requirement: ECS SceneIndex

Stage Engine MUST 从 ComposeDocument v6 与 ready ComposeLayoutSnapshot 建立 parent、世界矩阵、
可见性、锁定、容器、裁剪与 GeometryConstraints 索引。全部世界几何 MUST 使用 Snapshot box 加
Transform rotation，缓存 MUST 同时区分 document 与 snapshot revision。

`containerAtPoint` MUST 接受一个可选的排除 Entity ID 集合，返回结果 MUST NOT 包含集合中的 Entity
及其任何后代——供画布内拖拽 reparent 判定候选容器时排除被拖动的选区自身，避免把节点拖进它自己或它
的子孙。

#### Scenario: Snapshot 改变使空间索引失效
- **WHEN** 文档引用不变但 Layout Snapshot revision 与子项 box 改变
- **THEN** SceneIndex 返回新的世界矩阵、bounds、命中与裁剪结果
- **AND** 不读取旧 Transform position/size

#### Scenario: 容器命中排除自身与后代

- **WHEN** 以拖动中选区的 Entity ID 作为排除集合查询 `containerAtPoint`
- **THEN** 返回结果不是选区中任何 Entity，也不是它们任意一个的后代
- **AND** 排除集合为空时行为与此前一致

## ADDED Requirements

### Requirement: 画布拖拽 reparent 会话

StageInteractionController MUST 在 `move` 手势进行中持续判定指针下最深的合法容器（复用
`containerAtPoint` 并排除被拖动选区自身与其后代）。仅当指针进入该容器包围盒内部达到规定比例时才把它
记为候选 reparent 目标；贴边掠过 MUST NOT 触发，且 MUST NOT 使用停留计时作为额外或替代的触发条件。
候选目标 MUST 通过 snapshot 暴露供宿主渲染高亮（与 `previewTransforms`、`drawing` 等既有 preview
状态同一机制，而不是 effect），Controller 自身不持有渲染状态。未达到判定条件时 MUST 保持现有行为：
目标坐标在原父级内更新，不触发 reparent。

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

- **WHEN** 拖动中的指针只在容器边缘附近掠过，未进入内部达到判定比例
- **THEN** 不产生候选 reparent 目标
- **AND** Pointer Up 只更新目标在原父级内的坐标

#### Scenario: 提交 reparent 使用目标默认 Flow/Absolute 判定

- **WHEN** Pointer Up 时存在候选 reparent 目标
- **THEN** 提交的 reparent 命令按目标是否为 Layout 容器分别得到 Flow 或 Absolute 的 LayoutItem
- **AND** 不产生第二条独立命令来设置 Flow/Absolute

#### Scenario: 候选目标提交前失效则不提交

- **WHEN** 候选 reparent 目标在 Pointer Up 前被锁定、删除或经其他事务变为不再是合法容器
- **THEN** 该并发文档变化按既有手势原子性取消整个手势，不产生任何命令
- **AND** 不产生指向已失效目标的命令

### Requirement: Auto Layout 容器内原地重排

对 `flexWrap` 为 `nowrap` 的 Layout 容器，`move` 手势拖动其 Flow 子级且指针全程未离开该容器边界时，
Controller MUST 按指针在主轴上的位置与各兄弟中点比较得到插入位置，Pointer Up MUST 只提交一次改变
`Hierarchy.childIds` 顺序的命令，MUST NOT 修改该 Entity 的 `LayoutItem`，MUST NOT 发布 Transform
命令。插入位置与拖动前顺序相同时 MUST NOT 提交任何命令。指针离开容器边界时 MUST 回退到既有的烘焙
Absolute 行为。`flexWrap` 为 `wrap` 或 `wrap-reverse` 的容器 MUST 保持现有行为，不进行原地重排判定。

拖动过程中 Controller MUST 通过 snapshot 发布当前插入位置，供宿主呈现落点预览；预览 MUST NOT 产生
文档事务。一次拖拽 MUST 只表达一种结构意图：当选区并非全部属于同一候选容器时 MUST NOT 进入重排，
改按 reparent 或既有 Transform 规则统一处理，MUST NOT 在同一次手势内混合提交重排与其他结构命令。

#### Scenario: 容器内拖拽只重排不烘焙

- **WHEN** 用户在 `nowrap` 容器内把一个 Flow 子级拖到另一个兄弟旁边并在容器内松手
- **THEN** 提交的命令只改变 `Hierarchy.childIds` 顺序
- **AND** 该 Entity 的 `LayoutItem.positioning` 保持 `flow` 且不产生 Transform 命令

#### Scenario: 顺序未变化不产生事务

- **WHEN** 用户在容器内拖动 Flow 子级后松手，计算出的插入位置与原顺序一致
- **THEN** 不提交任何命令
- **AND** 历史不增加条目

#### Scenario: 拖动中呈现落点预览

- **WHEN** 用户在 `nowrap` 容器内拖动 Flow 子级并移动指针
- **THEN** Controller 随指针在 snapshot 中发布当前插入位置
- **AND** 预览期间不产生任何文档事务

#### Scenario: 选区跨容器时不进入重排

- **WHEN** 一次拖动的选区同时包含某 `nowrap` 容器内的 Flow 子级与该容器外的其他目标
- **THEN** 不产生重排落点，整次手势按 reparent 或既有 Transform 规则统一处理
- **AND** 不在同一次手势内混合提交重排与其他结构命令

#### Scenario: 拖出容器边界回退为烘焙 Absolute

- **WHEN** 用户把 `nowrap` 容器内的 Flow 子级拖出该容器边界后松手
- **THEN** 该目标按既有规则烘焙为 Absolute
- **AND** 未拖出边界的其他并发拖动目标不受影响

#### Scenario: wrap 容器维持现状

- **WHEN** 容器 `flexWrap` 为 `wrap` 或 `wrap-reverse`
- **THEN** 拖动其 Flow 子级立即按既有规则烘焙为 Absolute
- **AND** 不进行插入位置判定
