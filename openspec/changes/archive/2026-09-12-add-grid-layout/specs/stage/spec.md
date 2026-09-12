## RENAMED Requirements

- FROM: `### Requirement: resize 手势实时布局反馈`
- TO: `### Requirement: 手势期实时布局反馈`

## MODIFIED Requirements

### Requirement: 手势期实时布局反馈

Auto Layout 容器的子级或带子级的 Auto Layout 容器本身被 resize 期间，Stage MUST 按预览
Snapshot 渲染场景：拖子级时兄弟随拖动实时让位，拖容器时子级排布（fill 伸缩、wrap 换行）
随拖动实时更新，所见结果与 Pointer Up 提交后的布局一致。

网格容器内的子级被 **move 或 resize** 期间 MUST 同样按预览 Snapshot 渲染：被落点压住的
兄弟随拖动实时下移，重力随之生效。网格的 move 必须走这条通道而不是覆盖预览——覆盖只改被拖
的那一个，而网格的全部价值在于看见别人怎么让位。

预览渲染 MUST 以 rAF 合并，单帧最多触发一次预览求解。手势取消时 MUST 立即恢复提交态
Snapshot 的渲染，MUST NOT 残留预览几何；预览期间 MUST NOT 产生文档事务或历史条目。

预览 Snapshot MUST NOT 进入交互 Controller 的 context：提交几何始终以冻结的提交态 Snapshot
为准。这条在网格下更强——网格的提交几何是格坐标，根本不从 Snapshot 反算像素。

#### Scenario: resize 子级时兄弟实时让位

- **WHEN** 用户拖动 Auto Layout 容器内某子级的 resize 手柄
- **THEN** 兄弟节点随拖动按预览 Snapshot 实时重新排布
- **AND** Pointer Up 提交后的最终布局与松手前所见一致

#### Scenario: resize 容器时子级实时重排

- **WHEN** 用户拖动带子级的 Auto Layout 容器自身的 resize 手柄
- **THEN** 子级随拖动按预览 Snapshot 实时重新排布
- **AND** Pointer Up 提交后的最终布局与松手前所见一致

#### Scenario: 网格内 move 时兄弟实时下移

- **WHEN** 用户在网格容器里拖动一张卡，落点压住了另一张
- **THEN** 被压住的那张随拖动实时下移，没被压住的不动
- **AND** Pointer Up 提交后的最终布局与松手前所见一致

#### Scenario: 网格内 move 时重力实时生效

- **WHEN** 拖动使原先的位置空出来，且重力开启
- **THEN** 下方可上浮的卡片在拖动期间就已上浮
- **AND** 松手后的结果与拖动期间所见一致

#### Scenario: 取消手势恢复提交态

- **WHEN** resize 或网格 move 手势进行中收到 Escape 或失去指针捕获
- **THEN** 场景立即恢复为提交态 Snapshot 的渲染
- **AND** 历史与文档无任何新增条目

## ADDED Requirements

### Requirement: 网格容器的画布反馈

Stage MUST 在网格容器上渲染格线与占位影子，两者都 MUST 只在用户正在提出与格子有关的问题时
出现：**指针按下网格内的子级**、**正在拖动或缩放它**、或**容器本身被选中**。静息时
MUST NOT 渲染任何格线——一张图上多块网格全都画着格线，是几十条与当前操作无关的线。

格线 MUST 画成列带与行线，并 MUST 与预解算用的同一份列宽和行高推出。手势期间容器因行数变化
而长高时，格线 MUST 跟着覆盖新的行。

拖动或缩放期间 MUST 同时渲染：

- **跟手的对象**：跟随光标、MUST NOT 吸格——吸格会让拖动一顿一顿
- **占位影子**：吸在格上、虚线描边，回答"松手会变成什么"，并 MUST 标出落点格坐标与跨度
- **被推挤的兄弟**：按预览 Snapshot 实时移动（见「手势期实时布局反馈」）

缩放期间的读数 MUST 以**格**为单位，MUST NOT 印像素——像素值是派生的、会随容器宽度变，
印出来只会误导。

#### Scenario: 静息时不画格线

- **WHEN** 画布上有一个网格容器，指针没有按下、容器也没有被选中
- **THEN** 不渲染任何格线或影子
- **AND** 该容器与一个普通容器在画布上没有区别

#### Scenario: 按下子级时格线显形

- **WHEN** 用户在网格容器内的一张卡上按下指针
- **THEN** 该容器渲染列带与行线
- **AND** 抬起指针且容器未被选中时格线消失

#### Scenario: 拖动时同时渲染三样反馈

- **WHEN** 用户拖动网格里的一张卡且落点压住了另一张
- **THEN** 被拖的卡跟随光标且不吸格，占位影子吸在落点格上并标出格坐标与跨度
- **AND** 被压住的那张实时下移

#### Scenario: 缩放读数以格为单位

- **WHEN** 用户拖动网格里一张卡的东侧手柄使其跨度变为 8 格
- **THEN** 光标旁的读数写的是格数
- **AND** 不出现像素读数
