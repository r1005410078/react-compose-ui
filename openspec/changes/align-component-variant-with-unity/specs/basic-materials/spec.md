## ADDED Requirements

### Requirement: 页面实例使用空心组件符号

`component-instance` 在场景树与依赖 Registry preset 图标的呈现中 MUST 使用空心（描边）组件符号，
以表示页面引用而非库内主组件本体。主组件 preset 图标 MUST 为实心同形符号。该规则 MUST 与组件库
中主组件/变体图标体系一致，且 MUST NOT 仅依赖颜色区分。

#### Scenario: 场景树实例图标为空心

- **WHEN** 页面场景树渲染 component-instance 节点
- **THEN** 行图标为空心组件符号
- **AND** 与普通 Rectangle/Container 物料图标可区分

#### Scenario: 主组件库图标为实心

- **WHEN** 组件库展示主组件资源
- **THEN** 图标为实心组件符号
