## ADDED Requirements

### Requirement: 共享 Tree 的行首插槽

共享 Tree MUST 提供 `renderLeading` 插槽，渲染在缩进之后、展开控件之前，作为 `renderActions` 的
镜像。Tree MUST NOT 解释该插槽的内容，也 MUST NOT 因它改变行的角色、选择或键盘语义。

#### Scenario: 领域层在行首挂入口

- **WHEN** 消费者提供 `renderLeading`
- **THEN** 该内容渲染在缩进与展开控件之间
- **AND** 行的 role、选择与键盘行为保持不变

#### Scenario: 省略插槽

- **WHEN** 消费者不提供 `renderLeading`
- **THEN** 行的结构与既有渲染逐字相同
