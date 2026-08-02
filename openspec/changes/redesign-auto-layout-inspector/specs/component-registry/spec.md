## ADDED Requirements

### Requirement: 缺失 Component Inspector 协议

Component Definition MUST 能够声明 Component 缺失时的 Inspector 标题栏操作与可见条件。Editor
MUST 按 Registry 顺序组合该协议，不得硬编码具体 Component Key；锁定、文档、LayoutSnapshot 与
dispatch MUST 使用和普通 Component Inspector 相同的上下文。

#### Scenario: Hierarchy 缺少 Layout 时显示入口

- **WHEN** Materials 的 Layout Definition 检查拥有 Hierarchy 但缺少 Layout 的 Entity
- **THEN** Inspector 在 Layout 的 Registry 顺序位置显示“布局”操作行
- **AND** 非 Hierarchy Entity 与已经拥有 Layout 的 Entity 不显示重复入口

#### Scenario: 缺失入口继承只读上下文

- **WHEN** Entity 已锁定或宿主 Inspector 为只读
- **THEN** 缺失 Component 的操作收到 readOnly 状态并保持禁用
- **AND** Editor 不创建任何 Component 命令

### Requirement: Component Inspector 分组与默认展开协议

Component Definition MUST 能够声明将已存在 Component 的 Inspector 合并进基础分组，并且 Component
与 Renderer Definition MUST 能够声明独立分组是否默认展开。Editor MUST 通过 Registry 元数据组合
分组，不得按具体 Component Key 硬编码编辑 UI。

#### Scenario: 合并基础 Component Inspector

- **WHEN** LayoutItem Definition 声明 `inspectorGroup: 'basic'` 并提供复合几何 Inspector
- **THEN** 复合 Inspector 按 Registry 顺序渲染在 Identity 之后的同一“基础”分组中
- **AND** Transform 不再创建独立 Inspector，Editor 也不再为 Transform 或 LayoutItem 创建独立顶级分组

#### Scenario: 应用默认展开状态

- **WHEN** Layout 声明默认展开而其他普通 Component/Renderer 分组未声明展开
- **THEN** 基础与 Layout 默认展开，其余分组默认折叠
- **AND** 搜索命中仍临时显示并展开对应分组
