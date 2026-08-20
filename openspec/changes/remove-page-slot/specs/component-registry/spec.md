## RENAMED Requirements

- FROM: `### Requirement: 页面节点端口透传`
- TO: `### Requirement: 节点端口透传`

## MODIFIED Requirements

### Requirement: 节点端口透传

Component Registry MUST 在 Renderer 与 Component Inspector 的渲染上下文中透传可选的宿主节点
editor 端口，供 Inspector 编辑节点引用属性。端口 MUST 以纯协议类型声明，Registry MUST NOT
解释其领域含义，也 MUST NOT 因此新增对 `asset-browser`、`editor`、`property-panel` 或
`preview` 的依赖。端口缺省时 Registry MUST 正常渲染。

Registry MUST NOT 再透传页面文档加载端口——它只为 Page Slot 存在，随页面嵌套一并删除。

#### Scenario: 端口到达 Inspector 与 Renderer

- **WHEN** 宿主向 Registry 渲染上下文注入节点 editor 端口
- **THEN** 对应的 Component Inspector 与 Renderer 都能取到该端口
- **AND** 端口对象在多次渲染间保持引用稳定

#### Scenario: 端口缺省

- **WHEN** 宿主未注入该端口
- **THEN** Renderer 与 Inspector 正常渲染
- **AND** 依赖端口的能力以可访问的未配置状态呈现


### Requirement: 页面脚本作用域加载 Hook

`@compose-ui/component-registry` MUST 导出唯一的 React Hook，供渲染入口按页面加载 setup 作用域。
Hook MUST 在缺省 Loader 时由 Asset Resolver 构造默认 JavaScript Loader，MUST 订阅 setup 资源变更并在
新 revision 到达时以新模块重建作用域，MUST 在卸载、引用变化和加载被取消时 dispose 自己创建的作用域，
并且 MUST NOT 在作用域与当前 setup 引用不匹配时把它交给消费方。

页面渲染入口 MUST NOT 各自实现这套加载与竞态逻辑；`preview` 与页面导航宿主 MUST 消费该 Hook。

#### Scenario: 按页面加载并在热重载后重建

- **WHEN** 页面关联的 setup 资源保存并发布新 revision
- **THEN** Hook dispose 旧作用域并以新模块建立新作用域
- **AND** 消费方在新作用域就绪前不会收到与旧引用不匹配的作用域

#### Scenario: 加载期间卸载

- **WHEN** setup 模块仍在加载时消费方卸载
- **THEN** Hook 取消加载并 dispose 迟到到达的作用域
- **AND** 不产生卸载后的状态更新
