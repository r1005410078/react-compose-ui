## ADDED Requirements

### Requirement: 编辑期 Interaction 不改变命中与行为

Stage MUST NOT 因 Entity 携带 `Interaction` 而改变命中测试、选择、拖拽或任何编辑手势。
在画布上点击一个带跳转的 Entity MUST 只是选中它,MUST NOT 触发跳转。Stage MUST NOT 为
`Interaction` 引入新的编辑模式。

Stage MAY 以不可交互的视觉标记提示该 Entity 带有交互,但该标记 MUST NOT 参与命中测试,
也 MUST NOT 改变 Entity 的几何或布局呈现。

#### Scenario: 画布点击只选中

- **WHEN** 用户在画布上点击一个带 click→navigate 的 Entity
- **THEN** 该 Entity 被选中且当前页面不变
- **AND** 没有任何页面加载被发起

#### Scenario: 标记不参与命中

- **WHEN** Stage 呈现交互标记且用户点击标记所在位置
- **THEN** 命中的仍然是 Entity 本身
- **AND** Entity 的几何与布局呈现不受标记影响
