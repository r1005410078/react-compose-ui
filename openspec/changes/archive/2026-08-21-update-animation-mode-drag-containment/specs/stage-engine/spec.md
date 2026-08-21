## MODIFIED Requirements

### Requirement: 画布拖拽 reparent 会话

StageInteractionController MUST 在 `move` 手势进行中持续判定指针下最深的合法容器（复用
`containerAtPoint` 并排除被拖动选区自身与其后代）。仅当指针进入该容器包围盒内部达到规定比例时才把它
记为候选 reparent 目标；贴边掠过 MUST NOT 触发，且 MUST NOT 使用停留计时作为额外或替代的触发条件。
候选目标 MUST 通过 snapshot 暴露供宿主渲染高亮（与 `previewTransforms`、`drawing` 等既有 preview
状态同一机制，而不是 effect），Controller 自身不持有渲染状态。未达到判定条件时 MUST 保持现有行为：
目标坐标在原父级内更新，不触发 reparent。

`StageInteractionContext` MUST 支持可选的 `lockGestureParent` 输入：为 true 时全部 `move`
手势 MUST 按「锁定原父级」运行——与手势进行中按住 Space 同一语义与判定路径：不产生任何
跨父级 reparent 候选与命令，指针经过其他容器不出现落点高亮，同容器内的重排照常。该输入
与手势中的 Space 锁定 MUST 可叠加（任一生效即锁定）。

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

#### Scenario: 宿主锁定原父级时不产生结构落点

- **WHEN** 宿主 context 的 `lockGestureParent` 为 true，用户把对象拖过另一块容器内部并松手
- **THEN** 手势全程不发布候选 reparent 目标
- **AND** Pointer Up 只更新目标在原父级内的坐标，不产生任何结构命令

#### Scenario: 提交 reparent 使用目标默认 Flow/Absolute 判定

- **WHEN** Pointer Up 时存在候选 reparent 目标
- **THEN** 提交的 reparent 命令按目标是否为 Layout 容器分别得到 Flow 或 Absolute 的 LayoutItem
- **AND** 不产生第二条独立命令来设置 Flow/Absolute

#### Scenario: 候选目标提交前失效则不提交

- **WHEN** 候选 reparent 目标在 Pointer Up 前被锁定、删除或经其他事务变为不再是合法容器
- **THEN** 该并发文档变化按既有手势原子性取消整个手势，不产生任何命令
- **AND** 不产生指向已失效目标的命令
