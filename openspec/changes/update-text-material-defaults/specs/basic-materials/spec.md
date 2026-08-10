## ADDED Requirements

### Requirement: Figma 基线的 Text 默认值与排版

Materials MUST 以 Inter Regular 12px、白色文字填充、自动行高、左对齐、顶部对齐、原始大小写和无文字装饰创建新的 Text Preset。Text Renderer MUST 支持并公开 `textAlign`、`verticalAlign`、`textCase` 与 `textDecoration`，且 Inspector、Stage、Preview、Renderer measurement MUST 使用相同的 Props Contract。颜色 MUST 继续属于 Text 内容分类；字体、对齐、大小写与装饰 MUST 属于排版分类。

#### Scenario: 创建默认 Text

- **WHEN** Registry 从 Text Preset 创建一个新 Entity
- **THEN** Renderer Props 使用白色 Inter 12px 的基础文字样式，且不持久化数值 lineHeight
- **AND** LayoutItem 的宽度和高度均为 `hug`

#### Scenario: 编辑文字排版

- **WHEN** 用户在 Text Inspector 修改对齐、大小写或文字装饰
- **THEN** Stage 与 Preview 立即以相同方式渲染该 Text
- **AND** 影响文字字形的大小写设置同时用于 Hug measurement，schema 外 authored props 保持不变

#### Scenario: 读取旧 Text

- **WHEN** v6 Text 缺少新的排版字段，或缺少颜色字段
- **THEN** 显式既有颜色、字号、字体和行高保持不变
- **AND** 缺失颜色回退为白色，缺失排版字段保持旧的垂直居中、原始大小写和无装饰行为

### Requirement: Text 内容尺寸贴合

Text Preset MUST 为 `hug × hug` 提供不大于默认文字内容的回退尺寸，并使用既有 isolated measurement 收敛到真实文本尺寸；透明 Appearance MUST 不产生文字外框。

#### Scenario: 默认文字选区贴合内容

- **WHEN** 新 Text 的 Layout Runtime 完成 measurement
- **THEN** Layout snapshot 的选区宽高等于 Text Renderer 的内容尺寸
- **AND** 不保留 280×72 的固定默认文本框
