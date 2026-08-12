## 上下文

Registry Preset 是代码注册的 Entity 创建模板，Asset Provider 是项目文件事实来源，两者只在组件库
UI 中聚合。组件与变体必须在 Provider 离线、父资源缺失或 revision 变化时继续确定渲染，且资源写入
不能假装与 ComposeDocument 事务具有跨系统原子性。

## 目标/非目标

- 目标：first-class Group、项目组件文件、Base/Variant 继承、关联实例、显式覆盖、Apply/Revert、
  手动更新、独立编辑会话与 Scene Tree 到资源目录的创建流程。
- 非目标：Detach、跨 Provider Variant、自动或批量更新、任意实例内部结构编辑、Page Slot 合并、
  ComposeDocument v7、超过八层的继承或组件嵌套。

## 决策

### First-class Group

Core 公开唯一 Group seed 工厂。Group 具有 `Composition.presetId: "group"`、Transform、LayoutItem、
GeometryConstraints、Visibility、Lock 与 Hierarchy，不具有 Renderer、Appearance、Clip 或 Layout；
它可移动、不可缩放、不可旋转并隐藏于 Palette。创建时持久化选区包围并集和保持世界几何的局部坐标；
后续 Stage 命中、吸附和选框使用可见后代动态并集，空 Group 才回退到持久化 frame。

Group 只接受同一直接父级下的顶层 Absolute 选择。Ungroup 只接受 first-class Group；为兼容 main
已经产生的文档，`presetId: null` 且精确匹配旧 Group 结构的 Entity 仍可 Ungroup，但不自动改写。

### Component Asset v1

组件文件媒体类型为 `application/vnd.compose-ui.component+json`，后缀为 `.component.json`。
`schemaVersion: 1` 文件必须以 `kind` 判别 Base 或 Variant。Base 保存稳定 componentId、名称、
Group 单根 ComposeDocument v6 和暴露属性；Variant 保存同 Provider 的直接 parentRef、从 Base 到
直接父源的 appliedLineage、规范语义操作和 resolvedSnapshot。旧草案中缺少 `kind` 的 v1 文件由
显式纯迁移转换为 Base，Parser 不静默接受。

Parser 只验证当前文件和保存快照。Resolver 负责读取父链、检测 revision、循环、scope、继承深度和
操作合法性，并返回 `resolved`、`orphaned`、`invalid` 或 `pending-update`。Variant 继承与组件递归渲染
分别以八层为硬上限；orphaned 可以使用保存快照，invalid 只能显示可访问错误状态。

Variant 操作以稳定 Entity ID、Component Key、字符串字段路径、parentId 与 beforeEntityId 表达。
支持字段 set/remove、非基础 Component add/remove、Entity 子树 add/remove、reparent/reorder；数组按
包含它的完整字段原子处理。根不可删除或 reparent，基础 Component 不可删除，最终文档必须通过 v6
校验。Variant 工作区保存时比较直接父快照与当前文档生成规范操作，不持久化 DocumentPatch 数组索引。

### 创建组件与关联实例

一个或多个来源必须是同父级、Absolute、未锁定的顶层规范化选择。提取器始终产生 Group 根：单节点
也包入 Group，已有 first-class Group 则在内存克隆中规范化而不重复嵌套。根坐标归零、输出采用当前
Layout Snapshot 世界包围并集且透明，所有后代的世界几何、旋转和 sibling 顺序保持不变。

创建期间只构造虚拟候选。Store 写入成功后，Editor 才以一个事务删除源子树并在最小原 sibling index
插入 `component-instance`。实例保存引用、appliedLineage、resolvedSnapshot 和 propertyOverrides；
尺寸使用 Hug 与快照 fallback，可移动/旋转但不可缩放，内部 Entity 不进入宿主 Scene Tree 或 Stage 命中。
Undo/Redo 只处理场景替换，不删除或重建资源文件。

资源写入失败时场景不变。若资源写入后文档 revision 改变或场景事务失败，保留资源、保持场景不变并
报告 partial success；系统不得删除可能已被外部观察的资源。

### Unity 风格 Variant 工作流

Base 编辑器可以定义暴露属性；Variant 继承属性定义且 v1 不可重定义。场景实例只能覆盖稳定 property ID
对应的 JSON 值，结构编辑只发生在 Base/Variant 独立 TransactionRuntime 中。从实例创建 Variant 时，
将实例属性覆盖转换为稳定字段操作。

Resolve 顺序固定为 Base → 从根到叶的 Variant → 实例 propertyOverrides。Apply 支持单项或全部，只写入
直接父源：父源是 Base 时更新 Base 文档，父源是 Variant 时合并其操作。先写父源，再消费发起层覆盖；
第二步失败时不回滚父源，保留本地覆盖以维持视觉并标记 partial success。Revert 只删除当前层操作；
删除新增子树及其依赖操作前必须预览确认。更新永不自动发生；用户保留旧快照，或确认丢弃列出的冲突后
一次提交新 lineage、快照、兼容覆盖和尺寸。

### UI 与包边界

`@compose-ui/component-library` 包含无 DOM 领域 Store/Resolver 和 React 目录面板，可依赖 core、assets、
component-registry、components、ui-context，不依赖 editor、stage、scene-tree 或 asset-browser。
materials 对 layout-engine 的使用扩展为 Page Slot 和组件实例嵌套 Runtime。

SceneTree 只发布注册 type、普通 payload、nodeIds 与指针生命周期；普通行在树内 drop 时继续移动，在
注册的外部目标 drop 时由 Editor 创建组件。Asset Browser 可以依赖 assets 并接收宿主注册的外部
drop type，但不得读取 ComposeDocument 或 Component Store。Editor 持有两者桥接、文档 revision 检查、
命名流程和资源副作用。

Group、Container、Base Component 与 Variant 使用形状不同且非纯颜色的图标，并提供 accessible name。
Context Menu、Stage 菜单和 Command Panel 提供键盘可达的“创建组件…”等价入口。

## 风险/权衡

- 快照增加文档和资源体积：换取离线、历史与 Undo/Redo 的确定性；v1 不去重。
- 两次 Provider 写入无法原子化：固定父源优先顺序并显式报告 partial success，不执行破坏性回滚。
- 动态 Group 选框与持久化 frame 不完全相同：持久化 frame 保持坐标稳定，动态范围只服务编辑反馈。
- 嵌套 Runtime 增加资源消耗：复用现有取消、订阅、测量与 dispose 约束，并限制为八层。

## 迁移计划

ComposeDocument 继续是 v6。新 Group 只影响后续 Group 命令；历史 Group 兼容结构保持可 Ungroup。
旧 Component Asset 草案只通过显式迁移读取。未配置 Component Store 的宿主继续获得现有 Registry
Preset 组件库，不出现项目组件、Variant 或组件工作区。
