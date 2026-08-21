# 变更：把移动预览与提交规划抽成纯函数

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 3 的 `move-axis`(900) 无法像前几刀
那样直接抽：它与 `entity-select-move`(700)、`resize`(600) 共用 `startTransform` 工厂，而移动
会话本身的推进（吸附 + 落点求解）与提交（reparent batch / 纯几何）合计约 120 行。

这是 rotate 那一轮走过的形状：先把提交侧与预览侧的**纯函数**抽出来，插件本体再单独一刀。
移动还多一层——它和 marquee 一样有多个入口（900 与 700 都创建 move 手势），因此这些纯函数
从一开始就要能被 legacy 与将来的插件同时调用，避免出现两份吸附与落点规则。

## 变更内容

- 新增 `move-planning.ts`：
  - `planMovePreview` — 求解预览变换、吸附参考线与落点，含「位移不足以激活」的早退。
  - `resolveCommittableDropTarget` — 提交前复核落点仍然成立，由 controller 私有闭包改为接收
    document 的纯函数。
  - `planMoveCommit` — 落点成立走 reparent/reorder，否则退回与 resize/rotate 共用的
    `planTransformCommit`。原本 `finish` 里的两条 move 分支合并成这一个入口。
- 激活阈值原本是 `updateGesture` 里一个裸的 `< 2`，现在是具名常量并写明它按**屏幕**像素判定
  （所以要乘 zoom），缩小视图下同样的世界位移在屏幕上更小。
- controller 随之卸掉 `BUILTIN_COMMAND_TYPES`、`createReparentCommand`、`resolveStageDropTarget`、
  `describeEntityTargets`、`snapTranslation`、`translationMatrix`、`transformedSelection` 七个导入。

本变更**不改变任何行为**，也不引入插件：legacy 的 move 手势照常工作，只是把求解交给纯函数。

## 影响

- 受影响的规范：`stage-engine`（画布拖拽 reparent 会话）
- 受影响的代码：`move-planning.ts`（新增）、`interaction-controller.ts`
