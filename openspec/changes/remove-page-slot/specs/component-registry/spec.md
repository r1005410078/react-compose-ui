## MODIFIED Requirements

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
