## 上下文

Registry Preset 是代码注册的 Entity 创建模板；Asset Provider 是文件事实来源。两者需要在组件库 UI 中聚合，但不能合并底层协议。关联实例还必须在 Provider 离线时保持确定渲染，并避免把内部 Entity 展开为宿主场景可编辑节点。

## 目标/非目标

- 目标：项目组件文件、混合目录、单根子树保存、独立源文档编辑、显式属性覆盖、提示后更新和离线快照渲染。
- 非目标：自动或批量更新、任意内部覆盖、Slot、Detach、运行时仅存引用、ComposeDocument 版本升级。

## 决策

- Component Document 使用独立 v1 包装格式，内部保存单根 ComposeDocument v6 和属性定义。
- 组件实例是隐藏 Preset 创建的叶子 Renderer Entity；props 保存引用、applied revision、源快照和 overrides。
- 项目组件继续通过既有 `assets` 外部拖入意图进入 Stage，不扩展 stage-engine 协议。
- 实例内部使用嵌套 Layout Runtime 渲染；编辑态不命中内部节点，Preview 保留交互。
- Store 只标记 revision 变化；用户确认后以一个 transaction 更新快照、有效 overrides 和尺寸。
- 实例只能编辑显式属性以及位置、旋转；宽高始终跟随主组件输出。

## 风险/权衡

- 快照增加文档体积：换取离线和历史确定性；首期不做去重。
- 嵌套渲染增加 Runtime 数量：复用页面槽位的 8 层限制、取消和释放策略。
- 暴露属性 Schema 必须可序列化：首期只接受可映射到稳定编辑器描述的叶子字段。

## 迁移计划

新增能力全部可选。未配置 Component Store 的宿主继续使用现有 Palette；旧 ComposeDocument 无需迁移。
