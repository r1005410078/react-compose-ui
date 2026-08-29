## MODIFIED Requirements

### Requirement: 场景默认外观

`@compose-ui/core` MUST 导出场景默认外观常量，其背景 MUST 是透明的：场景背景是会被发布出去
的真实像素而不是编辑器配色，编辑器 MUST NOT 替用户先填一个他迟早要改的颜色。该常量的背景
MUST NOT 与 `basic-materials` 的 Container Preset 默认外观绑定——两者相同曾经是一条不变量，
理由是「用户会看到画容器和画场景颜色不一样」，而那正是需要看出来的区别。

该常量的边框宽度 MUST 为 0：布局求解把边框计入内容盒，而场景是绝对坐标的原点，默认边框会
把每个直接子级整体推离网格。场景边界的可辨认性 MUST 由 Stage 的编辑器边界描边承担，MUST NOT
由默认背景色或默认边框承担——默认值只保护第一次，用户改过背景之后边界必须仍然读得出来。

Frame Entity 构造入口 MUST 默认采用该外观，并 MUST 提供显式覆盖参数，供 Preset 校验探针
这类非场景用途传回透明外观。

既有文档 MUST NOT 因本默认值变化而迁移：默认值只作用于新建，已有场景保留自己写下的背景。

#### Scenario: 新建场景背景透明

- **WHEN** 构造一个默认 Frame Entity
- **THEN** 它的 `Appearance.backgroundPaint` 是透明 solid Paint
- **AND** 该值不随 Container Preset 默认背景的变化而变化

#### Scenario: 场景默认不带边框

- **WHEN** 用户把一个子级按网格吸附拖到默认场景中
- **THEN** 属性面板里的位置坐标落在网格倍数上，而不是被场景边框推离 1 个单位

#### Scenario: 校验探针不继承场景外观

- **WHEN** Registry 构造用于 Preset 校验的探针 Frame
- **THEN** 该探针 Frame 的外观是显式传入的透明外观，而不是场景默认外观

#### Scenario: 既有场景背景不被改写

- **WHEN** 打开一份在本变更之前保存、场景背景为深色的页面文件
- **THEN** 该场景仍然是它保存时的深色背景，没有产生任何迁移事务
