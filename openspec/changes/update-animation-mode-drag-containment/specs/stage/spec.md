## ADDED Requirements

### Requirement: 手势父级锁定输入

`ComposeStage` MUST 提供可选的 `lockGestureParent` prop，并把它原样传入交互 Controller 的
`StageInteractionContext.lockGestureParent`。为 true 时画布 move 手势 MUST NOT 产生跨父级
reparent 落点高亮与结构命令，同容器重排照常；缺省时行为与现在完全一致。Stage 自身
MUST NOT 感知宿主启用锁定的理由（如编辑器的动画模式）——它只透传布尔输入。

#### Scenario: 锁定时拖拽不显示挂载高亮

- **WHEN** 宿主以 `lockGestureParent` 渲染 Stage，用户把对象拖过另一块容器内部
- **THEN** 画布不出现 reparent 落点高亮
- **AND** 松手后对象仍属原父级

#### Scenario: 缺省时行为不变

- **WHEN** 宿主未传 `lockGestureParent`
- **THEN** 跨父级拖拽的落点判定与提交与既有行为一致
