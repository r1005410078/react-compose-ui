## ADDED Requirements

### Requirement: Paint 语义属性编辑器

Property Panel MUST 提供独立于字符串 color editor 的 `paint` editor。Paint editor 只接受结构化 ComposePaint，并在绑定、只读或无效 Schema 时禁止修改。普通 color editor 保持 Solid Alpha 语义。

#### Scenario: 编辑背景 Paint

- **WHEN** 背景字段声明 `propertyPanel.editor: 'paint'`
- **THEN** 面板使用 ComposePaintPicker 并通过既有受控路径提交结构化值
- **AND** 其它颜色字段不得显示 Gradient 控件
