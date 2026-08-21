# 变更：抽完最后五个入口并删除 legacy 单体

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 3 的收尾。剩下的
`legacy-rotate-hit`(500)、`guide-create`(400)、`guide-move`(300)、
`rotate-tool-fallback`(200)、`marquee-fallback`(100) 全部又小又互不牵连，因此**一次抽完**——
抽取顺序不变量要求已抽取集合是优先级表的前缀，「全部」是最平凡的前缀。

抽完之后 legacy 单体没有任何分支可接，绞杀式重构随之完成。

## 变更内容

- 新增 `guide-plugin.ts`（400 与 300）与 `fallback-plugins.ts`（500、200、100）。三个 fallback
  各自只有一两行判定，但它们**必须存在**：删掉 legacy 之后没有兜底，任何一类命中无人接管就是
  功能消失，而不是退化。
- `marquee-fallback` 是框选的第三个也是最后一个入口，与工具入口、容器体收敛共用同一个
  `claimStageMarquee`——四刀之前建的共享工厂在这里收官。
- guide 两个会话补上 `captureStageSpatialBaseline`：辅助线落盘要解析活动 Frame 与它的世界原点，
  两者都随文档与布局变化，legacy 原本也会在这些变化上中止它们。
- **删除 legacy 单体**：`Gesture` 联合类型、`updateGesture`、`begin`、`finish`、
  `createLegacySession`、`legacyClaim`、`legacyPlugin` 与 `STAGE_LEGACY_MONOLITH_PRIORITY` 全部
  移除。`reset()` 换成 `abortActiveSession()`，转调 `arbiter.cancel`——会话自己知道该还原什么。
- `updateContext` 里最后一处按手势分类的 `incompatible` 判定消失，全部交给 `arbiter.revalidate`。

## 不变量升级

抽取期间的守卫是「已抽取集合必须是优先级表的**前缀**」——因为 legacy 永远排最后兜底，跳号会让
仍在 legacy 里的高优先级分支被挤到后面询问。legacy 删除后没有兜底了，不变量随之升级为
「注册表必须**逐项覆盖**整张表」：漏一项不再是顺序反转，而是一类命中彻底无人接管。

## 影响

- 受影响的规范：`stage-engine`（Stage 交互插件仲裁、Headless 交互 Controller）
- 受影响的代码：`interaction-kernel/guide-plugin.ts`（新增）、
  `interaction-kernel/fallback-plugins.ts`（新增）、`interaction-kernel/gesture-priority.ts`、
  `interaction-kernel/extracted-plugins.ts`、`interaction-kernel/index.ts`、
  `interaction-controller.ts`、`index.ts`
