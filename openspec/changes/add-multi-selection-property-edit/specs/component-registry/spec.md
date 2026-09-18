## ADDED Requirements

### Requirement: Renderer Inspector 的作用对象是选区

`ComposeRendererInspectorProps` MUST 携带本次编辑的**作用对象**（一组 Entity），且该字段
**缺席即只有 `entity` 自己**——既有 Renderer Definition 因此一行不改，单选是这一组恰好一个
成员的退化情形，由构造保证而不是由各物料各判一次。

Inspector 读取当前值时 MUST 以 `entity` 为代表；写入时 MUST 作用于整组。两者分开的理由是
它们回答不同的问题：屏幕上显示什么、这一下改了谁。

#### Scenario: 缺席即退化成单个对象

- **WHEN** 宿主渲染 Renderer Inspector 而不传作用对象
- **THEN** 作用对象是 `[entity]`
- **AND** 呈现与写入与本变更之前逐字相同

#### Scenario: 多个作用对象时写入整组

- **WHEN** 作用对象是三个 Entity，用户改一个字段
- **THEN** 三个 Entity 都被写入该字段
- **AND** 其余字段各自保持原值
