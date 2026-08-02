## ADDED Requirements

### Requirement: 页面节点端口透传

Component Registry MUST 在 Renderer 与 Component Inspector 的渲染上下文中透传两个可选宿主端口：
供 Inspector 编辑节点引用属性的节点 editor 端口，以及供 Renderer 加载页面文档的页面文档加载端口。
两个端口 MUST 以纯协议类型声明，Registry MUST NOT 解释其领域含义，也 MUST NOT 因此新增对
`asset-browser`、`editor`、`property-panel` 或 `preview` 的依赖。端口缺省时 Registry MUST 正常渲染。

#### Scenario: 端口到达 Inspector 与 Renderer

- **WHEN** 宿主向 Registry 渲染上下文注入节点 editor 端口与页面文档加载端口
- **THEN** 对应的 Component Inspector 与 Renderer 都能取到这两个端口
- **AND** 端口对象在多次渲染间保持引用稳定

#### Scenario: 端口缺省

- **WHEN** 宿主未注入这两个端口
- **THEN** Renderer 与 Inspector 正常渲染
- **AND** 依赖端口的能力以可访问的未配置状态呈现
