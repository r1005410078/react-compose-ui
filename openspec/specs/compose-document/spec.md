# compose-document Specification

## Purpose
TBD - created by archiving change add-command-transaction-runtime. Update Purpose after archive.
## Requirements
### Requirement: 版本化 JSON 文档

系统 MUST 在 `@compose-ui/core` 提供仅支持 `schemaVersion: 3` 的 ComposeDocument、严格 JSON
类型和无 React/DOM 的校验器。文档 MUST 保存 output、canvas、稳定 rootIds 与规范化 nodes；
v2、Group 和未知版本 MUST 被拒绝且不得自动迁移。

#### Scenario: 接受 v3 并拒绝旧版本

- **WHEN** 宿主分别校验合法 v3 文档、v2 文档和包含 Group 的候选文档
- **THEN** 只有 v3 Frame/Component 文档有效
- **AND** 失败结果包含稳定版本或节点字段问题

### Requirement: 规范化节点拓扑

系统 MUST 使用隐式 Canvas 作为结构根，允许 Frame 或 Component 出现在 rootIds。Frame MUST
可以递归包含 Frame/Component，Component MUST 保持叶节点；每个节点必须从 rootIds 恰好可达
一次且不得形成环。

#### Scenario: 使用任意根与嵌套 Frame

- **WHEN** rootIds 同时包含 Component 与 Frame，且 Frame 包含旋转 Frame 和 Component
- **THEN** 文档校验通过并保留确定性场景顺序
- **AND** `parentId: null` 可稳定表示任意根节点位置

#### Scenario: 拒绝非法拓扑

- **WHEN** childIds 缺失、重复拥有父级、指向 Component 后代或形成循环
- **THEN** 校验器返回对应稳定 issue 和路径

### Requirement: 节点变换与显示状态

每个节点 MUST 保存有限局部 transform、visible 与 locked。Frame 与 Component MUST 都允许有限
rotation，width/height MUST 为有限正数；Frame MUST 保存 boolean `clipContent`。

#### Scenario: 旋转并裁剪 Frame

- **WHEN** 根级或嵌套 Frame 使用有限 rotation 和任一 clipContent 值
- **THEN** 文档校验通过并保持字段原值

### Requirement: 可序列化组件节点

Component 节点 MUST 保存非空稳定 `componentType` 与 `JsonObject` props，不得在文档中保存
renderer、Inspector、默认值 factory 或运行时注册表引用。

#### Scenario: 保存未知组件类型

- **WHEN** 文档包含当前宿主尚未注册的非空 componentType
- **THEN** 文档结构校验仍然通过
- **AND** 组件类型的运行时可用性留给 renderer 层处理

#### Scenario: 拒绝空组件类型

- **WHEN** Component 的 componentType 为空字符串
- **THEN** 校验结果定位到该 Component 的 componentType

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

### Requirement: 固定原点输出设置

ComposeDocument MUST 保存正有限 width/height 与非空 backgroundColor 的 output，并导出默认
`1280×720`、`transparent` 的 `createDefaultOutputSettings()`。输出原点 MUST 固定为世界
`(0,0)`；backgroundColor MUST 继续允许宿主配置其他非空 CSS 颜色字符串。

#### Scenario: 校验输出设置

- **WHEN** 宿主创建默认输出或提供合法自定义尺寸和背景
- **THEN** 文档校验通过且值可 JSON 往返
- **AND** 非正、非有限尺寸或空背景被拒绝
