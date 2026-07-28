## ADDED Requirements

### Requirement: Canvas 语义尺寸与背景 Inspector

隐式 Canvas Inspector MUST 将输出几何显示为一个 Size 属性，并将输出背景显示为 Color 属性。当前六个桌面尺寸预设 MUST 位于 Size 属性内的 picklist，而不是独立属性行；Canvas 仍允许任意合法自定义尺寸。

#### Scenario: 在单一 Size 属性选择输出预设
- **WHEN** 用户在 Canvas Inspector 的 Size 属性中选择 1280×720、1366×768、1440×900、1920×1080、2560×1440 或 3840×2160
- **THEN** 同一 Size 属性中的 W/H 同步更新
- **AND** 系统只提交一次可逆 `output.configure` 事务

#### Scenario: 编辑自定义 Canvas Size 与 Color
- **WHEN** 用户手动修改 Canvas Size 的 W/H 或通过 Color Picker 选择颜色
- **THEN** 不再匹配预设的尺寸显示 custom，Color 行不显示 CSS 字符串
- **AND** Undo/Redo 更新 Inspector 值并保持 output inspection 激活
