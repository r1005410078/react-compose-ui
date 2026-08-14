# 变更：WidgetSwitcher 物料

## Why

编辑器目前只有 Container 与 Group 两种组合型物料，都会同时渲染全部子项。实施工程师要做
Tab 内容区、分步向导或状态面板这类「一组互斥页面、同一时刻只显示其中一个」的结构时，只能手工
逐个切 `Visibility`：没有索引语义，运行期无法切换，子项增删后还要重新对齐可见性。

对标 UE5 UMG 的 `UWidgetSwitcher`——它是一个 panel widget，会构造全部子项，但只显示
`ActiveWidgetIndex` 指向的那一个；设计器里在层级树中选中某个子项，画布会临时切到该子项以便编辑。
本次按仓库 v6 ECS 模型引入对等能力。

## What Changes

### 1. `WidgetSwitcher` Component（core）

- `COMPOSE_BUILTIN_COMPONENT_KEYS` 新增可选 Component `WidgetSwitcher`，字段只有
  `activeIndex: number`。它是**可选** Component，既有实体不受影响，文档版本不变、无需迁移。
- 新增纯函数：活动子项解析（索引钳制、空容器）与「文档中应被隐藏的 Entity 集合」计算。
  这是 Stage、Preview、嵌套 Runtime 与 SceneIndex 共用的唯一事实来源，不允许各入口自行判断。

### 2. WidgetSwitcher Preset 与能力（materials）

- 新增 `widget-switcher` Preset：Components 与 Container 一致，额外带
  `WidgetSwitcher: { activeIndex: 0 }`。
- 新增 `widget-switcher` 内建能力，允许给任意已有容器就地追加切换语义。
- 注册带 Inspector 的 `WidgetSwitcher` Component 定义：编辑活动索引，并显示子项数量。

### 3. 只渲染活动子项

Stage 场景层、Preview、Component Instance 与 Page Slot 的嵌套文档 Runtime 都 MUST 跳过非活动
子项；SceneIndex 同步把它们标记为不可见，保证命中测试、拖拽落点与所见一致。

**布局不变**：`layout-engine` 仍求解全部子项，对齐 UE5「全部构造、只显示一个」的语义——切换索引
不触发重排，子项尺寸稳定。

### 4. 选中即预览（编辑期表示层）

选中 switcher 的任一后代时，Stage 临时把该分支显示出来以便编辑；这是纯表示层派生，**不写文档、
不发命令、不进 Undo**，取消选择后自动回到 `activeIndex`。Preview 不参与该覆盖。

## 首期边界

- 不复刻 `WidgetSwitcherSlot`：不引入 switcher 专属的 padding/对齐/强制填满，子项沿用现有
  `LayoutItem`，可绝对定位也可配 Auto Layout。
- 不做切换动画（对应 UE5 CommonUI 的 Animated Switcher）。
- 不提供按名称切换或运行期脚本 API；首期只有 `activeIndex` 与 Inspector 编辑。
- Scene Tree 不新增 switcher 专属呈现，非活动子项在树中照常列出。
