# 变更：把剩余派生与呈现层切出适配层

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 5 的收尾。前六刀切走的是「能力」，
这一刀切的是剩下的两类残留：**可独立求值的派生**（选区约束、屏幕几何）与**纯呈现的片段**
（世界底图、生命周期、根元素事件接线）。

## 变更内容

纯函数，附单测（新增 15 条）：

- `stage-selection-derivations.ts` — 选区约束、缩放手柄的两个集合、可旋转/可编辑判定。
- `stage-screen-geometry.ts` — 世界矩形换屏幕、逐块场景边界、手柄锚点、辅助线合并、可见世界矩形。

Hook 与组件：

- `use-stage-preview-documents.ts` — 预览文档烘焙与 resize 实时求解。
- `use-stage-instance-drilldown.ts` — 双击逐层进入实例内部，含内部选中框的 DOM 测量。
- `use-stage-root-handlers.ts` — 根元素事件接线。
- `stage-world-underlay.tsx` — Scene 之下的场景锚点、原点轴线与原点图标。
- `stage-lifecycle.ts` — Controller 与测量适配器的 StrictMode 安全释放。

`compose-stage.tsx` 1097 → 800 行。

## 两处刻意没有抽走的

**`controller.updateContext` 留在宿主。** 它的参数列表**就是**上下文本身；抽成 Hook 只是把
同一批二十个名字换个地方写，不产生任何新的边界。我试着抽了一次，看到结果之后放回去了。

**JSX 树没有再拆。** 把 `<div className="compose-stage__surface">` 那棵子树做成组件需要约
35 个 props，而它只有一个调用方——那是用一个长文件换一个宽契约。Overlay 那一刀已经记过同一条
教训：预先算一个共享包会让每加一层就往里塞几个字段，最终又变回一个谁都不敢改的大对象。

## 关于 < 600 行这个目标

**没达到，停在 800，而且我认为该停。**

这个数字是我在步骤 5 开始时写下的，当时 `ComposeStageReady` 有 2300 行、里面什么都有，
「小于 600」是个合理的方向指示。现在文件的构成变了：113 行导入、38 行加载态门、约 410 行
**几乎全是 Hook 调用与它们的参数对象**、236 行 JSX 树。继续压只有两条路——把参数对象重新
折叠成聚合引用（前六刀一直在拆的正是这个），或者把 JSX 拆成宽契约的单调用方组件。两条都
让代码更难读。

目标该随认识更新。真正要达成的是「适配层只做适配」，这一点已经达成了。

## 影响

- 受影响的规范：`stage`（适配层组织）
- 受影响的代码：`stage-surface/compose-stage.tsx`、七个新增模块
- 用户可见行为：无。148 项单测（新增 15）与 99 条 e2e 全绿，黄金图零差异。
