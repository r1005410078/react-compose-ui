## MODIFIED Requirements

### Requirement: 版本化 JSON 文档

系统 MUST 在 `@compose-ui/core` 提供仅支持 `schemaVersion: 2` 的 `ComposeDocument`、严格 JSON 值
类型和无 React/DOM 依赖的文档校验器。文档 MUST 使用必填 canvas 设置、稳定 `rootIds` 与规范化
节点表，并且不得保存 `undefined`、函数、symbol、bigint、循环对象、React 元素或类实例。

#### Scenario: 校验合法 v2 多 Frame 文档

- **WHEN** 宿主校验包含 canvas、多个 Frame、Group、Component 和 JSON props 的版本 2 文档
- **THEN** 校验结果返回该文档有效
- **AND** 文档通过 JSON 序列化后保持相同业务结构

#### Scenario: 拒绝非 JSON 属性

- **WHEN** Component props 或 canvas 包含 undefined、函数、bigint、非有限数字或循环引用
- **THEN** 校验结果返回稳定 issue code、可定位 path 和可读消息
- **AND** 校验器不会把候选值强制转换成另一种数据

#### Scenario: 拒绝 v1 与未知版本

- **WHEN** 候选文档的 `schemaVersion` 不是 2
- **THEN** 校验结果明确报告不支持的版本
- **AND** 候选文档不会被迁移或当成当前版本继续处理

### Requirement: 可选通用节点样式

系统 MUST 允许 schemaVersion 2 的任意 Frame、Group 或 Component 节点保存可选 `style`。Style
MUST 只包含背景色、边框色、边框宽度、圆角、透明度和单个结构化阴影；系统 MUST 提供按节点
kind 补齐稳定默认值的解析函数。

#### Scenario: 解析没有 style 的 v2 节点

- **WHEN** 宿主校验并解析一个节点没有 style 字段的合法版本 2 文档
- **THEN** 文档继续有效且原始 JSON 不被修改
- **AND** Frame 解析为稳定画板默认值，Group 与 Component 解析为透明默认值

#### Scenario: 校验合法部分 style

- **WHEN** 节点只保存部分合法 style 字段或一个结构化 shadow
- **THEN** 文档校验通过并保留给定 JSON
- **AND** 解析结果使用给定值覆盖对应 kind 默认值

#### Scenario: 拒绝非法 style

- **WHEN** style 包含未知字段、空颜色、非有限数字、越界 opacity、负边框/圆角/blur 或 CSS shadow 字符串
- **THEN** 文档校验返回稳定 issue code 与字段 path
- **AND** 不返回经过静默修正的文档

## ADDED Requirements

### Requirement: 可持久化画布设置与辅助线

ComposeDocument v2 MUST 保存 grid、smartSnap 与全局世界坐标 guides。Grid stepX/stepY MUST 为有限
正数，offsetX/offsetY MUST 为有限数，primaryLineEvery MUST 为正整数；guide ID MUST 非空且唯一，
axis MUST 为 `x|y`，position MUST 为有限数。

#### Scenario: 创建默认画布设置

- **WHEN** 宿主调用 `createDefaultCanvasSettings`
- **THEN** 得到 8×8、零偏移、每 8 格主线且三类吸附开启的独立 JSON
- **AND** guides 初始为空且多次调用不共享可变对象

#### Scenario: 保存全局辅助线

- **WHEN** v2 文档包含位于正负世界坐标的合法水平和垂直辅助线
- **THEN** 校验保留 guide 顺序、ID、axis 与 position
- **AND** guides 不依赖任何 Frame 或 viewport

#### Scenario: 拒绝非法画布配置

- **WHEN** canvas 缺失、grid 数值非法、主线间隔不是正整数或 guide ID 重复
- **THEN** 校验返回稳定 issue code 和 canvas 字段 path
- **AND** 不返回经过静默修正的文档
