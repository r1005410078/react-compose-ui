## MODIFIED Requirements

### Requirement: 共享 Shadcn Color Picker

`@compose-ui/components` MUST 公开受控 `ComposeColorPicker`。它 MUST 以包内 Shadcn CLI 生成的 Base UI Popover 源码为基础，提供色块 Trigger、饱和度/明度色盘、色相滑条和可选完全透明操作；不得引入第三方颜色运行时依赖、Preflight 或另一套全局主题。默认（带 Trigger 的）形态的可见 UI MUST 不显示 HEX、RGB、HSL 或 CSS 文本输入。

它 MUST 公开一个**内嵌**形态：只渲染色彩编辑内容，不自带 Trigger、不自带 Popover，由调用方把它放进自己已经打开的那块面上。这一档 MUST 由调用方声明而不是由组件猜——组件看不见自己外面有没有一层弹出层。内嵌形态 MUST 显示精确输入（HEX 与只读 RGBA）与吸管：它没有 Trigger 上那个色块，读数与取色因此没有别的地方可放。

内嵌形态此前是包内私有（只服务同包的 Paint Picker），现在 MUST 公开：判据是**出现了第二个消费者**（工具栏的填充色面板），而不是「将来可能有人用」。

#### Scenario: 选择不透明色或透明
- **WHEN** 用户从 Color Picker 的色盘、色相滑条或透明操作修改值
- **THEN** 受控回调只提交小写 `#rrggbb` 或 `transparent`
- **AND** Trigger、Escape、焦点恢复、键盘色盘操作、Theme 和 I18n 均保持可访问

#### Scenario: 读取无法精确编辑的既有 CSS 色
- **WHEN** 受控值为 `rgb()`、`hsl()`、`rgba()` 或其他非 HEX CSS 色
- **THEN** Trigger 继续尝试以该 CSS 值预览颜色，色盘从安全回退色打开
- **AND** 原值在用户未修改前不得被转换

#### Scenario: 内嵌进调用方自己的面板
- **WHEN** 调用方声明内嵌形态
- **THEN** 组件只渲染色彩编辑内容，不渲染 Trigger、不打开第二层 Popover
- **AND** 颜色历史仍由共享的 Provider 记录，两处实例不各记一份
