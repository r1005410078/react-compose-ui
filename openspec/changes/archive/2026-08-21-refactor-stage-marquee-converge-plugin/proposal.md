# 变更：把容器体收敛入口拆成交互插件

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 3 的 `marquee-converge`(800)，
框选三个入口中的第二个。

`refactor-stage-marquee-tool-plugin` 已经把共享会话工厂建好，因此这一刀只需把**接管条件**
搬过去：`shouldConvergeToMarquee` 与它的 `isTopLevelEntity` 判定随插件迁出 controller，
并入 `marquee-plugin.ts` 与 1100 入口同住——它们属于同一个手势的不同入口，分开放会让「哪些
命中会起框」这件事散在两个文件里。

## 变更内容

- `marquee-plugin.ts` 新增 `createStageMarqueeConvergePlugin`（800 入口）与导出的
  `shouldConvergeToMarquee`；两个入口共用已有的 `createStageMarqueeSession` 与
  `claimStageMarquee`，差异仍然只是 `originEntityId`。
- `isTopLevelEntity` 不再是独立函数：它只有一行 `rootIds.includes()`，独立存在时反而掩盖了
  「顶层判定必须与标题标签的渲染范围一致」这条约束，因此内联并把约束写在调用处。
- legacy 删掉 800 分支与两个私有 helper，随之卸掉 `getComposeHierarchy`、`isComposeGroupEntity`
  两个导入。
- 收敛判定成为导出的纯函数，其防御性分支（Group、空容器、嵌套容器、不存在的 Entity）改用直接
  单测覆盖——这些情形在 v7 下经由 controller 不可达，`rootIds` 只接受 Frame。

## 影响

- 受影响的规范：`stage-engine`（容器标题标签与命中收敛）
- 受影响的代码：`interaction-kernel/marquee-plugin.ts`、`interaction-kernel/extracted-plugins.ts`、
  `interaction-kernel/index.ts`、`interaction-controller.ts`
