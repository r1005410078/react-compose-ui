## ADDED Requirements

### Requirement: 组件实例合成 Inspector 表面

默认 Editor 在选中页面上的 component-instance（未下钻内部实体）时 MUST 将宿主身份相关字段与组件根视觉/布局字段合成到同一个 Entity Inspector 外壳中：共享唯一标题区（若有）、唯一 Property Panel 搜索/筛选/设置与列宽状态。MUST NOT 纵向堆叠两个完整 Entity Inspector 或两套属性工具栏。宿主侧 MUST 提供名称及页面级位置相关编辑；MUST NOT 在宿主侧再暴露应以组件根为事实源的外观、裁剪、几何限制、Hierarchy/Layout（容器与 Auto Layout）分组。根侧字段 MUST 经实例覆盖通路写入，MUST NOT 修改组件源文档；根侧 MUST 隐藏与宿主重复的名称、Transform、LayoutItem、可见性与锁定。下钻选中内部实体时，Inspector MUST 仅显示该内部实体，不再拼接宿主表面。

#### Scenario: 选中实例只有一个属性搜索框

- **WHEN** 用户在页面上单击选中一个 component-instance
- **THEN** 右侧 Inspector 只存在一个属性搜索框与一套筛选/显示设置
- **AND** 名称输入只出现一次

#### Scenario: 根外观与布局可编辑且写入覆盖

- **WHEN** 用户选中实例并修改组件根的外观或 Auto Layout 相关属性
- **THEN** 变更经实例覆盖通路提交，组件源 Asset 不被修改
- **AND** 同一面板内可见布局/外观分组，而非第二块独立「Container」属性面板外壳

#### Scenario: 下钻后不再拼接宿主表面

- **WHEN** 用户下钻选中实例内部实体
- **THEN** Inspector 只显示该内部实体的属性
- **AND** 不继续拼接宿主 identity 与根表面双段外壳

#### Scenario: 自定义 inspector 插槽仍可全量替换

- **WHEN** 宿主通过 editor slots 提供完整 inspector 内容
- **THEN** 默认合成逻辑不强制插入第二套面板
- **AND** 未提供 slots 时默认路径满足本需求
