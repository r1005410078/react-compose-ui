# 变更：把 stage-engine 按职责分目录

## 原因

`stage-engine/src` 根目录 32 个文件平铺，与刚整理过的 `stage-surface` 是同一个问题。

**分组依据不用另想——包自己的架构边界那句话已经写好了**：

> `@compose-ui/stage-engine` 是无 React、无 DOM 的**坐标、场景索引、吸附、手势状态机与空间
> 命令**包。

这五个词就是五个目录（吸附与坐标同源，归一处），`interaction-kernel/` 早就是「手势状态机」
那一个。**文档里既有的职责划分优先于我临时想的分类**，也免得目录名和边界描述各说各话。

## 变更内容

| 目录 | 成员 | 对应边界描述 |
| --- | --- | --- |
| `geometry/` | stage-geometry、canvas-geometry、frame-space | 坐标、吸附 |
| `hit-testing/` | scene-index、drop-target、marquee-selection | 场景索引 |
| `gesture-planning/` | transform-planning、transform-preview、move-planning、drawing-tools、paint-geometry | （手势状态机的规划侧） |
| `commands/` | structure-commands、clipboard、component-extraction、entity-placement、transaction-labels | 空间命令 |
| `interaction-kernel/` | 不动 | 手势状态机 |

根目录从 32 个文件降到 5 个：公共入口、`interaction-controller` 及其测试、跨目录共用的
`test-fixtures.ts`、以及扫描全部源文件的 `dependency-boundary.test.ts`。

顺手改掉两处**名字与目录同名因而不携带信息**的文件：`geometry/geometry.ts` →
`stage-geometry.ts`，`commands/commands.ts` → `structure-commands.ts`（后者本就有一个
`ComposeStructureCommandAvailability` 类型，名字是现成的）。

公共 `index.ts` 原本有 15 个 export 块、其中 5 个都指向 `./commands`——那是历史上按文件
逐个转导留下的。现在按目录合并成 6 块，每块一句说明，180 → 172 行。

## 关于 `interaction-kernel/` 为什么不动

它有 34 个文件，看着是这次最该拆的。**但它的 18 个插件是一组形态统一的兄弟**（各约 150 行、
同一个 claim/session 契约、由**一张优先级表**排序），而那张表与守护它的
`extracted-plugins.ts`、`extraction-order.test.ts` 就在同一层。把插件挪进 `plugins/` 子目录
等于**把排序表和它排序的对象分开**——绞杀式重构里吃过亏的正是这条顺序不变量。

文件多不是拆分理由，「谁和谁必须一起看」才是。

## 影响

- 受影响的规范：`stage-engine`（源码组织）
- 受影响的代码：`stage-engine/src` 全目录重排，两处文件重命名，公共入口重组
- 用户可见行为：无。公共 API 逐符号不变，跨包导入只走包入口。
