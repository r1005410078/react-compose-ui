## ADDED Requirements

### Requirement: Component Field Contract 与运行时绑定

Component Definition MUST 能以稳定 Field 名称声明可绑定 value Contract、显示名、authored getter 与纯
同步 validator。Registry MUST 校验空名和重复名，隔离 getter/validator 异常，并提供 authored/runtime
值、绑定 diagnostic、页面 scope 订阅及 Inspector binding port。未声明 Contract 的 Component MUST
保持原有 authored JSON 与 Inspector 行为。

#### Scenario: 注册 Animation play 字段
- **WHEN** Animation Definition 声明 boolean value Field `play`
- **THEN** Registry 返回稳定 Contract，并允许 Inspector 列出兼容的页面 value export
- **AND** method export 与非 boolean value 不进入候选

#### Scenario: 运行值覆盖 authored 字段
- **WHEN** 有效页面 boolean export 绑定到 Animation.play
- **THEN** runtime field 使用导出当前值且 authored getter 仍返回文档值
- **AND** value 更新只发布运行时刷新，不产生文档事务

#### Scenario: Component 字段绑定失败
- **WHEN** export 缺失、kind 不匹配、getter/validator 抛错或 validator 拒绝
- **THEN** runtime field 回退 authored 值并发布目标 diagnostic
- **AND** 其他 Renderer Prop 和 Component Field 绑定继续解析

### Requirement: Component Field Inspector 绑定端口

Registry React bridge MUST 向声明 Field Contract 的 Component Inspector 提供可选 binding port，包含兼容
变量、当前引用、状态以及绑定/换绑/解绑意图。端口 MUST 复用页面 Script Scope 的 value/method 分类，
且 MUST NOT 要求 Component Inspector读取 Editor 内部状态或直接修改 Bindings JSON。

#### Scenario: Inspector 绑定和解绑 play
- **WHEN** 用户在 Animation Inspector 把 play 绑定到 playFault 后再解绑
- **THEN** binding port 分别请求一个可逆文档事务写入和删除 Component Field 引用
- **AND** authored play 保持原值并在解绑后重新生效

#### Scenario: 没有页面作用域
- **WHEN** 独立 Registry Inspector 未注入页面 Script Scope 或 binding port
- **THEN** Component Inspector 仍可编辑 authored 字段
- **AND** 不显示伪造变量或产生绑定事务

