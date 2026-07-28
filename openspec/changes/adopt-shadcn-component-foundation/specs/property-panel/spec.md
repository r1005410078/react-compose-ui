## ADDED Requirements

### Requirement: 属性行复用共享右键菜单

Property Panel MUST 使用 `@compose-ui/components` 的 ContextMenu 与 Hook 呈现字段和分组行的右键动作。
三点 overflow 继续是独立的普通点击菜单。

#### Scenario: 右键显示全部属性动作

- **WHEN** 用户右键具有可用或禁用动作的属性字段或分组行
- **THEN** 共享 ContextMenu 显示全部动作并保留禁用状态
- **AND** 点击三点按钮仍只显示空间不足时的 overflow 动作

### Requirement: Color 语义编辑器支持颜色通道透明度

Property Panel 的内建 `color` renderer MUST 将 Color Picker 的 Alpha channel 作为颜色值的一部分提交，
不得把它错误映射为节点级 `opacity` 字段。含 Alpha 的 `#rrggbbaa` 值 MUST 经过完整 Valibot Schema
校验与既有受控 `onValueChange` 路径；绑定和只读状态 MUST 保持不可编辑。

#### Scenario: 在属性面板提交半透明颜色

- **WHEN** 用户在声明 `propertyPanel.editor: 'color'` 的字符串字段中把 Alpha 调整为中间值
- **THEN** 面板只提交一次通过 Schema 校验的含 Alpha 规范颜色
- **AND** 绑定、只读和无效 Schema 错误语义与不透明颜色保持一致
