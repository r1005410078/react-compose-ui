## RENAMED Requirements

- FROM: `### Requirement: Controller 驱动的默认组合`
- TO: `### Requirement: 默认 ECS 工作区同步`

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

### Requirement: 聚合 Inspector 通过 Registry Inspector 协议渲染

EntityInspector MUST 通过 ComposeComponentDefinition.inspector 渲染包括内建 Component 在内的
全部分组，MUST NOT 按 Component Key 硬编码内建编辑 UI；能力移除按钮状态 MUST 直接来自
listCapabilityAvailability；切换选中 Entity 时 MUST 重置移除确认等局部会话状态。

#### Scenario: 内建与宿主 Component 走同一条渲染路径

- **WHEN** Registry 内建与宿主 Component 定义都带 inspector
- **THEN** Inspector 按 order 渲染全部分组且无编辑器侧特判

#### Scenario: 切换选中重置移除确认

- **WHEN** 能力移除确认对话框打开时选中 Entity 发生变化
- **THEN** 对话框关闭且不会作用于新选中的 Entity

### Requirement: 容器创建 Preset 可配置

controller MUST 提供 containerPresetId 选项（默认 "container"）；Preset 缺失时创建入口
MUST 输出可定位的警告而不是静默失败。

#### Scenario: 缺失容器 Preset 时给出警告

- **WHEN** Registry 中不存在 containerPresetId 指向的 Preset 且用户触发创建
- **THEN** 不产生事务并输出包含该 Preset ID 的警告

## MODIFIED Requirements

### Requirement: 默认 ECS 工作区同步

默认 Editor MUST 使用同一 ComposeDocument v4 与 ComposeEntityRegistry 驱动 Scene Tree、Palette、
Stage、Inspector、History、Command Panel 和 Preview 集成。选择、命令和撤销后所有区域 MUST
读取相同 Entity 快照。

#### Scenario: 编辑 Entity 并跨面板同步

- **WHEN** 用户通过 Stage、Scene Tree 或 Inspector 修改同一 Entity
- **THEN** 所有面板显示相同 name、Components、层级和选择
- **AND** undo/redo 同步恢复全部区域

## REMOVED Requirements

### Requirement: Frame presets 与结构节点 Inspector

**原因**：Frame preset 与结构节点 Inspector 基于 v3 节点模型，已被 Entity Preset 和
Registry 协议驱动的聚合 Inspector 取代。

**迁移**：由「ECS 聚合 Entity Inspector」「聚合 Inspector 通过 Registry Inspector 协议渲染」
与「容器创建 Preset 可配置」共同承接。
