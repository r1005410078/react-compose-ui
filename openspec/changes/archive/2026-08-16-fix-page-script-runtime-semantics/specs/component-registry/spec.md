## MODIFIED Requirements

### Requirement: Authored 与 Runtime Props 分离

Registry Renderer bridge MUST 同时提供严格 JSON authored Props 与应用有效绑定后的 runtime Props。
`props` MUST 表示 Renderer 实际消费的 runtime 对象并允许包含 Function，`authoredProps` MUST 保持为
文档 `Renderer.props` 的只读 JSON。绑定解析 MUST NOT 修改 Entity 或 authored Props。

回退语义 MUST 按 Contract 类型区分：value 绑定失败 MUST 回退同名 authored 字面值；method 绑定失败
MUST 使 runtime prop 为 `undefined`，MUST NOT 回退同名 authored 字面值——authored Props 是严格 JSON，
其中的同名值永远不是可调用的 handler，把它交给宿主组件会在事件触发时抛错。

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

#### Scenario: 方法绑定失败不回退字面 Prop

- **WHEN** method Contract 的绑定目标缺失或 kind 不匹配，且 authored Props 中存在同名字面值
- **THEN** runtime props 中该 Prop 为 `undefined` 并发布目标 diagnostic
- **AND** authoredProps 仍然保留该字面值供 Inspector 展示

## ADDED Requirements

### Requirement: 页面脚本作用域加载 Hook

`@compose-ui/component-registry` MUST 导出唯一的 React Hook，供渲染入口按页面加载 setup 作用域。
Hook MUST 在缺省 Loader 时由 Asset Resolver 构造默认 JavaScript Loader，MUST 订阅 setup 资源变更并在
新 revision 到达时以新模块重建作用域，MUST 在卸载、引用变化和加载被取消时 dispose 自己创建的作用域，
并且 MUST NOT 在作用域与当前 setup 引用不匹配时把它交给消费方。

页面渲染入口 MUST NOT 各自实现这套加载与竞态逻辑；`preview` 与 Page Slot MUST 消费该 Hook。

#### Scenario: 按页面加载并在热重载后重建

- **WHEN** 页面关联的 setup 资源保存并发布新 revision
- **THEN** Hook dispose 旧作用域并以新模块建立新作用域
- **AND** 消费方在新作用域就绪前不会收到与旧引用不匹配的作用域

#### Scenario: 加载期间卸载

- **WHEN** setup 模块仍在加载时消费方卸载
- **THEN** Hook 取消加载并 dispose 迟到到达的作用域
- **AND** 不产生卸载后的状态更新
