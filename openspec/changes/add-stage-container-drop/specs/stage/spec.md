## MODIFIED Requirements

### Requirement: 直接移动缩放与旋转

Stage MUST 只允许当前工具暴露的 move、resize 或 rotate 手势；每种变换 MUST 在拖动或方向键移动 Flow
时把它转换为 Absolute 后移动，除非该次拖动落在同一 `nowrap` Layout 容器内部且未越过其边界——此时
MUST 按容器内原地重排处理，保持 Flow 并只改变 `Hierarchy.childIds` 顺序。`wrap`/`wrap-reverse` 容器
与方向键移动 MUST 保持转换为 Absolute 的既有行为。Resize Fill axis MUST 转为 Fixed；Rotation MUST
保持 Flow 与 sizing。全部操作 MUST 使用开始 Snapshot 并维持现有 preview/cancel/一次提交保证。

#### Scenario: 拖动 Flow 转为 Absolute

- **WHEN** 用户在允许移动的 Stage 工具中拖动一个或多个 Flow Entity 越过其所在容器边界，或该容器为
  wrap，并正常松手
- **THEN** preview 保持开始世界几何并跟随指针，提交后目标为 Absolute final offset
- **AND** Hierarchy.childIds 顺序不因此改变

#### Scenario: nowrap 容器内拖动保持 Flow 并重排

- **WHEN** 用户在 Stage 拖动一个 nowrap 容器内的 Flow Entity，全程未越过该容器边界，并正常松手
- **THEN** 提交后该 Entity 仍为 Flow，LayoutItem 不变
- **AND** Hierarchy.childIds 按拖动落点重新排序

#### Scenario: Flow 结构操作禁用

- **WHEN** 当前 Group/Ungroup 目标包含 Flow Entity
- **THEN** 菜单和快捷键使用相同 availability 禁用该操作并提供可读原因
- **AND** Delete、Lock、Visibility 与 Rotation 仍按各自能力执行

## ADDED Requirements

### Requirement: 画布拖拽落点反馈

Stage MUST 在存在候选 reparent 目标期间为该容器渲染高亮描边，区别于普通选中态。Stage MUST 在
`nowrap` 容器内原地重排期间按 Controller 发布的插入位置渲染落点指示。两种反馈 MUST 在候选目标清除
或 Pointer Up 提交/取消后立即消失。

被拖动目标自身的选中框与变换手柄呈现 MUST 保持既有行为不变——落点反馈画在目标容器上，与被拖动节点
的手柄属于不同对象，本变更不改动后者。

#### Scenario: 候选容器显示高亮描边

- **WHEN** 拖动中的指针使某容器成为候选 reparent 目标
- **THEN** 该容器显示高亮描边
- **AND** 被拖动 Entity 自身的选中框与手柄呈现与本变更前一致

#### Scenario: 容器内重排显示落点指示

- **WHEN** 用户在 `nowrap` 容器内拖动 Flow 子级
- **THEN** Stage 按当前插入位置渲染落点指示
- **AND** 指示随指针移动实时更新且不产生文档事务

#### Scenario: 反馈随会话状态同步消失

- **WHEN** 指针移出候选容器区域，或 Pointer Up 完成提交或取消
- **THEN** 容器高亮与落点指示立即消失
- **AND** 不残留在已经不再是候选目标的容器上
