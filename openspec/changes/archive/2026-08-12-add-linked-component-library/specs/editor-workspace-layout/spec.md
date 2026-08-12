## ADDED Requirements

### Requirement: 从场景选择创建项目组件

Editor MUST 从一个或多个同父级、Absolute、未锁定的顶层规范化选择创建组件。提取器 MUST 始终生成
坐标归零、透明输出、尺寸匹配当前 Layout Snapshot 世界包围并集的 Group 单根文档；单节点也包入 Group，
已有 first-class Group 不重复嵌套。资源成功创建后，Editor MUST 以一个事务在最小原 sibling index
用关联实例替换来源。

#### Scenario: 框选后创建组件

- **WHEN** 用户框选多个合法节点并从 Stage、Scene Tree 或 Command Panel 选择“创建组件…”
- **THEN** Editor 写入一个 Base 资源并以一个可撤销事务替换来源
- **AND** 新实例输出与来源世界几何一致

#### Scenario: 创建资源失败

- **WHEN** Provider 写入失败、名称冲突或确认前文档 revision 已改变
- **THEN** 场景和历史完全不变并显示失败原因

#### Scenario: 资源成功但场景替换失败

- **WHEN** 资源写入后文档 revision 改变或替换命令被拒绝
- **THEN** 资源保留、场景不变并报告“资源已保存但未实例化”

#### Scenario: 撤销组件替换

- **WHEN** 用户撤销或重做成功的场景替换
- **THEN** Undo 恢复原来源子树，Redo 恢复指向同一资源的实例
- **AND** 两个动作都不删除或重写组件资源

### Requirement: Scene Tree 到资源目录创建组件

Editor MUST 桥接 SceneTree 普通行拖拽和 Asset Browser 外部放置：树内 drop 继续移动，落入可写资源目录
时使用开始 revision、规范化 nodeIds、目标目录和命名结果执行同一创建组件流程。

#### Scenario: 普通行拖到资源目录

- **WHEN** 用户把已选 Scene Tree 行拖到可写资源目录并确认名称
- **THEN** Editor 创建 Base 组件并原子替换场景来源
- **AND** SceneTree 与 Asset Browser 都不直接依赖组件领域协议

### Requirement: 组件与 Variant 独立工作区

Editor MUST 以独立 TransactionRuntime 标签打开 Base 或 Variant，提供 dirty、保存、关闭确认、revision
冲突和活动会话回调。Base 可以定义稳定暴露属性；Variant 继承定义并在保存时从直接父快照生成稳定操作。
场景实例内部 MUST 不进入结构编辑树。

#### Scenario: 独立编辑 Base

- **WHEN** 用户双击组件目录或资源目录中的 Base
- **THEN** Editor 打开独立 Runtime，允许结构编辑、暴露属性、保存与冲突处理

#### Scenario: 独立编辑 Variant

- **WHEN** 用户打开 Variant 并修改字段或结构
- **THEN** 编辑器显示 resolved document，保存时只持久化相对直接父源的规范操作和新快照

#### Scenario: 从实例创建 Variant

- **WHEN** 用户从带 propertyOverrides 的场景实例创建 Variant
- **THEN** 新 Variant 直接引用该实例来源并把属性覆盖转换为字段操作

### Requirement: Apply、Revert 与提示后更新界面

Editor MUST 为 Variant 和实例显示当前层覆盖、单项/全部 Apply 与 Revert、pending update 和冲突确认。
实例 Apply MUST 只接受暴露属性；结构操作只在 Variant 工作区出现。更新 MUST 保留实例位置和旋转。

#### Scenario: Apply 和 Revert 覆盖

- **WHEN** 用户对当前层覆盖执行单项或全部 Apply/Revert
- **THEN** Editor 按 Component Store 结果刷新当前 Runtime、lineage、快照和覆盖状态
- **AND** partial success 显示稳定恢复指引

#### Scenario: 用户确认更新

- **WHEN** 源 revision 变化且用户确认兼容更新或丢弃列出的冲突
- **THEN** Editor 以一次事务更新实例 lineage、快照、兼容覆盖和尺寸
- **AND** 不改变实例位置与旋转
