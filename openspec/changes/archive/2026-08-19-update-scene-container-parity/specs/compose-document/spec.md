## ADDED Requirements

### Requirement: Frame 升格纯函数入口

`@compose-ui/core` MUST 导出一个把既有 Entity 就地升格为 Frame 的纯函数。该函数 MUST 只添加
`Frame`——缺 `Hierarchy` 时补一个空 `Hierarchy`，把 `Hierarchy` 与 `Frame` 补进
`Composition.baseComponentKeys`，写入给定 `size`。Entity 的 id、名称、子级与其余全部
Component（含 `Appearance`、`Clip`、`Renderer`、动画轨道）MUST 原地保留，MUST NOT 被规范化
或重置。对已经拥有 `Frame` 的 Entity 调用 MUST 是幂等的（只更新 `size`）。所有隐含升格入口
MUST 复用它，MUST NOT 各自内联一份。

#### Scenario: 升格保留既有外观

- **WHEN** 对一个背景为 `#204020`、`Clip.enabled` 为 false 的 Container 调用升格
- **THEN** 结果 Entity 的 `Appearance` 与 `Clip` 与升格前逐字段相同
- **AND** 结果 Entity 拥有 `Frame` 且 `Composition.baseComponentKeys` 含 `Frame`

#### Scenario: 升格后 Frame 不可被移除

- **WHEN** 宿主对升格后的 Entity 派发 `entity.component.remove` 移除 `Frame`
- **THEN** 命令返回 `component.protected` 而不是产出一个根为非 Frame 的非法文档

#### Scenario: 对叶 Entity 升格补齐 Hierarchy

- **WHEN** 对一个只有 `Renderer` 的叶 Entity 调用升格
- **THEN** 结果同时获得空的 `Hierarchy` 与 `Frame`，满足 `Frame ⇒ Hierarchy` 不变量

### Requirement: 场景默认外观

`@compose-ui/core` MUST 导出场景默认外观常量，其背景 MUST 与 `basic-materials` 的 Container
Preset 默认外观相同——场景就是放在顶层的容器，两者 MUST NOT 呈现出不同的默认底色。
该常量的边框宽度 MUST 为 0：布局求解把边框计入内容盒，而场景是绝对坐标的原点，默认边框会
把每个直接子级整体推离网格。Frame Entity 构造入口 MUST 默认采用该外观，并 MUST 提供显式
覆盖参数，供 Preset 校验探针这类非场景用途传回透明外观。

#### Scenario: 新建场景与新建容器同底色

- **WHEN** 分别构造一个默认 Frame Entity 与一个默认 Container Entity
- **THEN** 两者的 `Appearance.backgroundPaint` 相同

#### Scenario: 场景默认不带边框

- **WHEN** 用户把一个子级按网格吸附拖到默认场景中
- **THEN** 属性面板里的位置坐标落在网格倍数上，而不是被场景边框推离 1 个单位

#### Scenario: 校验探针不继承场景外观

- **WHEN** Registry 构造用于 Preset 校验的探针 Frame
- **THEN** 该探针 Frame 的外观是显式传入的透明外观，而不是场景默认外观
