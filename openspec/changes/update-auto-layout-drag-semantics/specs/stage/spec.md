## MODIFIED Requirements

### Requirement: 画布拖拽落点反馈

Stage MUST 在存在候选 reparent 目标期间为该容器渲染高亮描边，区别于普通选中态。Stage MUST 在
Layout 容器内原地重排期间按 Controller 发布的插入位置渲染落点指示：`nowrap` 容器为主轴插入线，
`wrap`/`wrap-reverse` 容器为目标行内的主轴插入线。两种反馈 MUST 在候选目标清除或 Pointer Up
提交/取消后立即消失。

被拖动目标自身的选中框与变换手柄呈现 MUST 保持既有行为不变——落点反馈画在目标容器上，与被拖动节点
的手柄属于不同对象。

#### Scenario: 候选容器显示高亮描边

- **WHEN** 拖动中的指针使某容器成为候选 reparent 目标
- **THEN** 该容器显示高亮描边
- **AND** 被拖动 Entity 自身的选中框与手柄呈现保持既有行为

#### Scenario: 容器内重排显示落点指示

- **WHEN** 用户在 `nowrap` 容器内拖动 Flow 子级
- **THEN** Stage 按当前插入位置渲染落点指示
- **AND** 指示随指针移动实时更新且不产生文档事务

#### Scenario: wrap 容器按行渲染插入线

- **WHEN** 用户在 `wrap` 容器内把 Flow 子级拖到另一行的两个兄弟之间
- **THEN** Stage 在目标行内按插入位置渲染主轴插入线
- **AND** 指示线位置与松手后的真实插入结果一致

#### Scenario: 反馈随会话状态同步消失

- **WHEN** 指针移出候选容器区域，或 Pointer Up 完成提交或取消
- **THEN** 容器高亮与落点指示立即消失
- **AND** 不残留在已经不再是候选目标的容器上

## ADDED Requirements

### Requirement: resize 手势实时布局反馈

Auto Layout 容器的子级被 resize 期间，Stage MUST 按预览 Snapshot 渲染场景，使兄弟随拖动实时
让位，所见结果与 Pointer Up 提交后的布局一致。预览渲染 MUST 以 rAF 合并，单帧最多触发一次
预览求解。手势取消时 MUST 立即恢复提交态 Snapshot 的渲染，MUST NOT 残留预览几何；预览期间
MUST NOT 产生文档事务或历史条目。

#### Scenario: resize 时兄弟实时让位

- **WHEN** 用户拖动 Auto Layout 容器内某子级的 resize 手柄
- **THEN** 兄弟节点随拖动按预览 Snapshot 实时重新排布
- **AND** Pointer Up 提交后的最终布局与松手前所见一致

#### Scenario: 取消手势恢复提交态

- **WHEN** resize 手势进行中收到 Escape 或失去指针捕获
- **THEN** 场景立即恢复为提交态 Snapshot 的渲染
- **AND** 历史与文档无任何新增条目
