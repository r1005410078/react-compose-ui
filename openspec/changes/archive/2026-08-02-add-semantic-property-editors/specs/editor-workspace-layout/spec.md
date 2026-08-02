## ADDED Requirements

### Requirement: Canvas Map 输出尺寸与背景 Inspector

隐式 Canvas Inspector MUST 将输出尺寸显示为 Map 属性：左侧 Key 只能选择“常见尺寸”或“自定义尺寸”；右侧 Value 在“常见尺寸”时显示六个桌面分辨率，在“自定义尺寸”时显示紧凑 Size W/H。输出背景 MUST 显示为 Color 属性。Key 是 Inspector 本地瞬时状态，不得写入 ComposeDocument。

#### Scenario: 在 Canvas Map 的常见尺寸 Value 选择分辨率
- **WHEN** 用户将左列 Key 选择为“常见尺寸”，并在右侧 Value 选择 1280×720、1366×768、1440×900、1920×1080、2560×1440 或 3840×2160
- **THEN** Canvas 输出 W/H 同步为该分辨率且不显示自定义 W/H 属性
- **AND** 系统只提交一次可逆 `output.configure` 事务

#### Scenario: 选择并编辑自定义 Canvas Size
- **WHEN** 用户将左列 Key 选择为“自定义尺寸”
- **THEN** 同一 property row 的右侧 Value 显示当前输出 W/H
- **AND** 系统不派发 `output.configure` 或创建无意义事务
- **WHEN** 用户提交合法自定义 W/H
- **THEN** 系统只提交一次可逆 `output.configure` 事务，尺寸匹配常见分辨率时 Key 自动回到“常见尺寸”，否则保持“自定义尺寸”
- **AND** 无效草稿不改写输出；Undo/Redo 或宿主外部 W/H 更新后，Inspector 依据当前尺寸重新选择 Key/Value 并保持 output inspection 激活

#### Scenario: 编辑 Canvas Color
- **WHEN** 用户通过 Color Picker 选择输出背景颜色
- **THEN** Color 行不显示 CSS 字符串，并以一次可逆 `output.configure` 事务提交有效颜色
