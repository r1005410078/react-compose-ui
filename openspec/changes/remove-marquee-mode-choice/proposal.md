# 判定模式菜单删掉，方向就是唯一的切换器

## Why

上一刀把默认判定改成「方向决定」之后，那个三选一菜单剩下的价值只有「把某一种判定钉死」。
它站不住，理由是内部的，不是 AutoCAD 那边怎么做。

### 一、它是一个全局模式，而全局模式已经被判过一次

判定模式改变的是**同一个拖拽手势意味着什么**。路线图决策 10 写的是「模式必须是对象作用域
且有明确的进出」——绘图模式因为这条被删，`marquee` / `move` / `pan` / `draw-line` 四个工具值
因为「与既有手势完全重复」被删。

这个菜单比它们更弱：**方向本身就是切换器**。一次拖拽就选好了，比开菜单快，也不残留状态。
留着它等于给同一件事造第二个入口，而那个入口更慢。

### 二、它只有一个消费者，就是它自己

`app/` 从来没设过 `marqueeMode`；整个仓库里唯一会改它的就是这个菜单。删掉菜单之后，
`policy.marqueeMode` 是一个零消费者的旋钮——正是「没有消费者的字段不进协议」那一条。

## What Changes

- **删掉工具栏的判定模式菜单**，连同它的文案、图标与 split button 结构。选择工具回到一个
  普通按钮（形状工具那套 split button 不受影响）。
- **删掉 `policy.marqueeMode` 与 `ComposeStageProps.marqueeMode`**，引擎恒按拖拽方向解算。
  只删菜单会留下一个没人调的 prop 和一条「Stage 只消费该值」的规范，读代码的人还得先搞清
  它是不是活的。
- **`StageMarqueeMode` 改名 `StageMarqueeHitTest`，取值收成 `contain | intersect`。**
  `contain` / `intersect` **不消失**——它们是方向的**归约结果**，命中与覆盖层都要读；
  消失的是「可选的模式」这个东西。名字跟着语义走：它不再是一个模式。
- `resolveMarqueeHitTest(direction)` 只收方向；`resolveMarqueeSelection` 的查询不再收 `mode`。

## Impact

- 规范：`stage-engine`「框选判定模式协议」MODIFIED（改名与收窄）、`stage`「选择与框选」与
  「Stage 注入面聚合」MODIFIED（去掉 `policy.marqueeMode`）、`editor-workspace-layout`
  「框选工具与判定模式菜单」REMOVED 且「平铺式默认画布工具栏」MODIFIED、
  `editor-preferences`「框选工具快捷键」REMOVED（见下）。
- 代码：`packages/stage-engine`、`packages/stage`、`packages/editor`。
- **破坏性**：`ComposeStageProps.marqueeMode` 与 `ComposeStageMarqueeMode` 从公共入口删除。
  宿主若设过 `marqueeMode` 会编译失败——这是有意的，静默忽略一个仍然写着的 prop 更糟。

## 顺带修一条陈旧规范

`editor-preferences` 的「框选工具快捷键」描述的是 `stage.marqueeTool` 动作与 `marquee` 工具，
**两者都在「工具集只保留没有别的入口的动作」那一刀里删掉了**，仓库里今天一个引用都没有。
它剩下的那半句「不改变当前框选判定模式」在本刀之后同样失去指称。一条 MUST 同时指向两个不
存在的东西，留着比删掉更容易误导下一个人，因此随本刀 REMOVED。

## Non-Goals

- **不改判定本身。**左→右包含、右→左相交，以及两种判定的分色与虚实，全部照上一刀不动。
- **不动形状工具的 split button。**那一套的菜单项各自是独立动作（矩形/箭头/圆），不是同一个
  动作的参数，因此不适用本刀的判断。
- **不为「总是相交」保留任何逃生口。**目标用户更可能来自 Figma（一直是碰到就选），这是一次
  真实的手感变化且没有退路。判断的理由是**两种判定都常用，而方向是它们之间最快的切换**——
  不是「AutoCAD 这么做」，那条早已被推翻。真有宿主需要钉死一种，届时按实际需求重新立项。
