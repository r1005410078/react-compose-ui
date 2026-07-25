## ADDED Requirements

### Requirement: 可选通用节点样式

系统 MUST 允许 schemaVersion 1 的任意 Frame、Group 或 Component 节点保存可选 `style`。Style
MUST 只包含背景色、边框色、边框宽度、圆角、透明度和单个结构化阴影；系统 MUST 提供按节点
kind 补齐稳定默认值的解析函数。

#### Scenario: 兼容没有 style 的旧文档

- **WHEN** 宿主校验并解析一个没有任何 style 字段的合法版本 1 文档
- **THEN** 文档继续有效且原始 JSON 不被迁移
- **AND** Frame 解析为稳定画板默认值，Group 与 Component 解析为透明默认值

#### Scenario: 校验合法部分 style

- **WHEN** 节点只保存部分合法 style 字段或一个结构化 shadow
- **THEN** 文档校验通过并保留给定 JSON
- **AND** 解析结果使用给定值覆盖对应 kind 默认值

#### Scenario: 拒绝非法 style

- **WHEN** style 包含未知字段、空颜色、非有限数字、越界 opacity、负边框/圆角/blur 或 CSS shadow 字符串
- **THEN** 文档校验返回稳定 issue code 与字段 path
- **AND** 不返回经过静默修正的文档
