## ADDED Requirements

### Requirement: 共享 Shadcn Color Picker

`@compose-ui/components` MUST 公开受控 `ComposeColorPicker`。它 MUST 以包内 Shadcn CLI 生成的 Base UI Popover 源码为基础，提供色块 Trigger、饱和度/明度色盘、色相滑条和可选完全透明操作；不得引入第三方颜色运行时依赖、Preflight 或另一套全局主题。Picker 的可见 UI MUST 不显示 HEX、RGB、HSL 或 CSS 文本输入。

#### Scenario: 选择不透明色或透明
- **WHEN** 用户从 Color Picker 的色盘、色相滑条或透明操作修改值
- **THEN** 受控回调只提交小写 `#rrggbb` 或 `transparent`
- **AND** Trigger、Escape、焦点恢复、键盘色盘操作、Theme 和 I18n 均保持可访问

#### Scenario: 读取无法精确编辑的既有 CSS 色
- **WHEN** 受控值为 `rgb()`、`hsl()`、`rgba()` 或其他非 HEX CSS 色
- **THEN** Trigger 继续尝试以该 CSS 值预览颜色，色盘从安全回退色打开
- **AND** 原值在用户未修改前不得被转换
