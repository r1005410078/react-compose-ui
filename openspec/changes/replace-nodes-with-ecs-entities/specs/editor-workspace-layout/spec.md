## ADDED Requirements

### Requirement: ECS 聚合 Entity Inspector

默认 Editor Inspector MUST 显示 Identity，并按 Registry 顺序聚合当前 Entity 已附加 Component
属性区和 Renderer 内容区。所有属性区 MUST 位于同一个 Property Panel，并共享唯一的搜索、筛选、
显示设置与列宽状态；Composition MUST 保持内部隐藏；锁定时除 Lock 外全部只读。

#### Scenario: 查看矩形组合

- **WHEN** 用户选择 Rectangle Entity
- **THEN** Inspector 显示 Transform、Visibility、Lock、Appearance 与 Rectangle 内容
- **AND** 用户可以感知属性由多个能力区组合而成

#### Scenario: 使用单一 Inspector 工具栏

- **WHEN** Entity 同时拥有多个 Component 和 Renderer 内容属性
- **THEN** Inspector 只显示一个属性搜索框、一组筛选和显示设置
- **AND** 搜索可跨 Component 分组过滤，所有属性行共享列宽

#### Scenario: 添加能力分组

- **WHEN** 用户添加几何限制或容器能力
- **THEN** Inspector 增加对应的可折叠 Component 分组
- **AND** 不新增第二套属性工具栏

#### Scenario: 合并容器属性

- **WHEN** Entity 同时拥有 Hierarchy 与 Clip
- **THEN** Inspector 只显示一个“容器”分组
- **AND** 子项数量与裁剪属性使用共享属性列展示

#### Scenario: 未知扩展降级

- **WHEN** Entity 保存了当前 Registry 不认识的 Component 或 Renderer
- **THEN** Inspector 使用普通 Component 分组显示降级说明
- **AND** 不创建空分组或额外属性工具栏

#### Scenario: 解锁 Entity

- **WHEN** Entity 已锁定
- **THEN** 只有 Lock 控件仍可编辑
- **AND** 解锁后其他属性与能力入口恢复可用

### Requirement: 添加和移除能力

Inspector 顶部 MUST 提供“添加能力”，列出 Registry 中可用、已附加、冲突和不可用状态。
添加 MUST 原子补齐依赖；移除 MUST 二次确认并遵守依赖、基础项、锁定与子项保护。

#### Scenario: 添加几何限制

- **WHEN** 用户给 Rectangle 添加“几何限制”
- **THEN** Inspector 立即出现 TransformConstraints 属性区
- **AND** History 只新增一个事务

#### Scenario: 确认移除能力

- **WHEN** 用户移除可移除能力
- **THEN** AlertDialog 说明将删除能力数据
- **AND** 取消保持文档不变，确认后原子移除

#### Scenario: 显示不可移除原因

- **WHEN** 能力被依赖、定义缺失、属于基础组合、目标锁定或 Container 含子项
- **THEN** 移除入口禁用并提供对应可访问说明

## MODIFIED Requirements

### Requirement: 默认 ECS 工作区同步

默认 Editor MUST 使用同一 ComposeDocument v4 与 ComposeEntityRegistry 驱动 Scene Tree、Palette、
Stage、Inspector、History、Command Panel 和 Preview 集成。选择、命令和撤销后所有区域 MUST
读取相同 Entity 快照。

#### Scenario: 编辑 Entity 并跨面板同步

- **WHEN** 用户通过 Stage、Scene Tree 或 Inspector 修改同一 Entity
- **THEN** 所有面板显示相同 name、Components、层级和选择
- **AND** undo/redo 同步恢复全部区域
