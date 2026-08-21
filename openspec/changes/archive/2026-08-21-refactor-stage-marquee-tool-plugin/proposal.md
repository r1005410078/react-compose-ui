# 变更：把框选工具入口拆成交互插件，并建立共享框选会话

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 3 按优先级自上而下的第八刀
（`marquee-tool`，1100）。

前七刀都是「一个分支一个插件」。框选不是：它有**三个入口**，在优先级表里分散于 1100（marquee
工具）、800（容器体收敛）与 100（默认兜底），中间夹着 draw(1000)、move-axis(900)、
entity-select-move(700)、resize(600)、guide(400/300)、rotate-fallback(200) 等六类尚未抽取的
分支。抽取顺序不变量要求已抽取集合始终是优先级表的前缀，因此**三个入口不能一次抽完**——
把 800 提到 legacy(0) 之前，就等于把它插到了仍在 legacy 里的 draw(1000) 前面。

于是这一刀只落地 1100 这一个入口，同时把三个入口共用的会话工厂建好，让后两刀各自在自己的
位次上复用它而不是复制它。

## 变更内容

- 新增 `marquee-plugin.ts`：`createStageMarqueeSession`（共享会话）、`claimStageMarquee`
  （共享的接管收尾：首帧快照 + 指针捕获）与 `createStageMarqueeToolPlugin`（1100 入口）。
  三个入口只在**何时接管**上不同，差异全部落在 `originEntityId` 一个参数上。
- `marqueeDirection`、`marqueeCombine` 与新的 `resolveMarqueeCommit` 进入 `marquee-selection.ts`。
  `resolveMarqueeCommit` 把「起框容器及其祖先排除」从 `finish` 里提出来——那段逻辑是提交语义的
  一部分，legacy 与插件都要用。
- `rectFromPoints` 从 controller 私有函数提升为 `geometry.ts` 的公开函数：框选、绘制与端点
  预览都要用它，`draw`(1000) 与 `resize`(600) 抽取时同样需要。
- legacy 只删掉 1100 这一个 claim 分支；marquee 的 `Gesture` 变体、`startMarquee`、update 与
  finish 分支**保留**，供仍在 legacy 里的 800 与 100 入口使用，但 finish 改为调用共享的
  `resolveMarqueeCommit`，因此不存在两份实现。

## 影响

- 受影响的规范：`stage-engine`（框选工具与选区布尔组合）
- 受影响的代码：`interaction-kernel/marquee-plugin.ts`（新增）、`marquee-selection.ts`、
  `geometry.ts`、`interaction-kernel/extracted-plugins.ts`、`interaction-kernel/index.ts`、
  `interaction-controller.ts`
