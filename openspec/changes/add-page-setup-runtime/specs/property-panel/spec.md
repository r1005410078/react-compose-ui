## ADDED Requirements

### Requirement: 值与方法绑定源分类

Property Panel 的受控绑定候选 MUST 区分 value source 与 method source。Schema 字段和自定义 renderer
子目标 MUST 只接受通过现有 Schema、semantic scope 与宿主规则的 value source；方法源不得进入普通
Valibot 字段。现有未声明 kind 的变量候选 MUST 兼容解释为 value source。

#### Scenario: 值字段过滤页面返回成员

- **WHEN** 页面作用域同时包含 number State、string 值和 Function，目标字段 Schema 为 number
- **THEN** 选择器只显示当前值通过 Schema 的 number State
- **AND** Function 不作为普通数值候选出现

#### Scenario: 旧变量候选保持兼容

- **WHEN** 独立宿主继续提供没有 kind 的现有 PropertyPanelVariable
- **THEN** 面板按 value source 使用现有解析与 fallback 语义
- **AND** 不要求宿主采用页面 Script Runtime

### Requirement: 无字面值方法绑定目标

Property Panel MUST 提供可独立组合的受控 binding-only target row，使宿主能够显示没有 JSON 字面编辑器
的方法目标。方法目标 MUST 只列出 method source，并提供显示名、搜索、绑定、换绑、解绑、只读和错误
状态；它 MUST NOT 尝试把 Function 写入 Schema value 或调用 `onValueChange`。

#### Scenario: 绑定事件方法 Prop

- **WHEN** 用户在 onClick 方法目标中选择页面返回的 onAdd Function
- **THEN** 面板发出独立 binding change 并显示已绑定方法名称
- **AND** 受控字面属性值和完整 Valibot Schema input 保持不变

#### Scenario: 方法缺失与只读

- **WHEN** 已绑定 Function 从页面返回作用域消失，或面板进入只读状态
- **THEN** 行显示可访问错误和现有 exportName
- **AND** 只读时不能换绑或解绑，错误也不会自动删除文档引用
