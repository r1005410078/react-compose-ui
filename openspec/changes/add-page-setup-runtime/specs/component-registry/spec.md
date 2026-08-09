## ADDED Requirements

### Requirement: Renderer Prop Contract

Renderer Definition MUST 能够以实例级 Prop Contract 声明顶层可绑定 Prop。value contract MUST 提供
稳定名称、显示名、纯同步 validator 与可选 measurement 影响标记；method contract MUST 声明
`event-handler` 角色。Registry MUST 保持无 Valibot 依赖，隔离 validator 异常，并让未声明 Contract 的
既有 Renderer 继续使用字面 Props 且不出现正式绑定入口。

#### Scenario: 注册值与事件方法 Props

- **WHEN** Renderer Definition 声明 number value Prop 和 event-handler method Prop
- **THEN** Registry 按稳定 Prop 名称返回两类 Contract
- **AND** Definition、Contract 与 validator 保持实例隔离

#### Scenario: 旧 Renderer 没有 Prop Contract

- **WHEN** 宿主继续注册只包含 type、label 与 renderer 的旧 Definition
- **THEN** Registry 正常渲染其 authored Props
- **AND** 不推断 TypeScript 类型或自动暴露任意 Prop 绑定

### Requirement: Authored 与 Runtime Props 分离

Registry Renderer bridge MUST 同时提供严格 JSON authored Props 与应用有效绑定后的 runtime Props。
`props` MUST 表示 Renderer 实际消费的 runtime 对象并允许包含 Function，`authoredProps` MUST 保持为
文档 `Renderer.props` 的只读 JSON。绑定解析 MUST NOT 修改 Entity 或 authored Props。

#### Scenario: 值绑定覆盖字面 Prop

- **WHEN** 页面 value export 通过目标 Contract validator
- **THEN** renderer props 使用当前导出值且 authoredProps 保留文档字面值
- **AND** 导出更新只发布运行快照而不产生文档事务

#### Scenario: 值绑定失败回退字面 Prop

- **WHEN** 返回成员缺失、kind 不匹配、validator 拒绝或脚本作用域失败
- **THEN** runtime props 使用同名 authored Prop 并发布目标 diagnostic
- **AND** 其他有效绑定继续生效

#### Scenario: 方法绑定注入事件 wrapper

- **WHEN** method export 绑定到 event-handler Contract
- **THEN** Preview runtime props 包含保留调用参数且忽略返回值的方法 wrapper
- **AND** Function 不出现在 authoredProps、Entity JSON 或 Registry 快照序列化中

### Requirement: 响应式 Prop 测量失效

Registry measurement adapter MUST 在绑定 value export 改变且对应 Contract 可能影响测量时使精确 Entity
失效。value contract 只有显式声明 `affectsMeasurement: false` 才能跳过；method export 调用或状态不变
MUST NOT 使 Layout Runtime 失效。

#### Scenario: 文本绑定变化重新测量 Hug

- **WHEN** Hug Text 的绑定 value export 从短文本变为长文本
- **THEN** adapter 只使该 Entity 的 measurement 与 Layout Snapshot 失效
- **AND** 新布局完成前继续遵守现有 fallback 与 diagnostic 规则

#### Scenario: 方法调用不直接触发布局

- **WHEN** 用户调用一个绑定 method 且它没有修改任何影响测量的 State export
- **THEN** Layout Runtime revision 不因方法调用本身增加
- **AND** 方法后来修改 value State 时按该 value Contract 决定是否失效
