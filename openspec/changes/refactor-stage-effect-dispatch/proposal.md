# 变更：把效果分派与滚轮导航切成独立 Hook

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 5 的第六刀。内核不碰 DOM、不碰
文档，它只产出效果；`connectSurface` 的 `applyEffects` 是这些效果**唯一的落地点**，加上它
要用到的三个命令规划器（两点图形端点提交、绘制提交、外部拖入）共 446 行，占 `ComposeStageReady`
剩余篇幅的一半。

这一刀还顺手拆掉了宿主里那个 13 字段的 `latestRef`——它是「最新值」聚合引用的原型，也是前
几刀反复要求新 Hook 不要接收的东西。搬完之后它在宿主里没有消费者了。

## 变更内容

- 新增 `use-stage-effect-dispatch.ts`（559 行）：效果分派、`createDroppedAssets`、
  `createDrawing`、`commitSegment`、资源拖入的中止清理与状态播报。
- 新增 `use-stage-wheel-navigation.ts`：滚轮平移与缩放。它必须手动装非 passive 原生监听，
  因为 React 把 wheel 作为 passive 委托，SyntheticEvent 上的 `preventDefault` 拦不住页面滚动。
- `compose-stage.tsx` 1621 → 1097 行，`latestRef` 就此消失。

## 又一处平行的 i18n

资源拖入的六条播报文案走的是内联 `resolvedLocale === 'en-US' ? … : …` 三元，**绕过了
`stage-i18n` 与宿主的 `formatMessage`**——宿主无法覆盖，也只支持内建的两种语言。这与上一刀
在右键菜单里修掉的是同一类问题，只是这次伪装成了「看起来已经做了国际化」。六条一并进
`stage-i18n`，zh-CN 与 en-US 文案逐字不变。

## 第三次撞上同一条约束

回调引用稳定的问题**这一刀又出现了**，形状与上一刀一模一样：`createDroppedAssets` 的依赖
数组里写了 `messages`，而 `getStageMessages` 每次渲染返回新对象，于是 `connectSurface` 每帧
重新注册，同样的七条用例同样失败。

第一次（文字编辑）是宿主传入的内联箭头，这次是每帧新建的派生对象。**判据不是「它是不是
函数」，而是「它每帧是不是新的」**——是就必须从 latest ref 读，不进依赖数组。

## 影响

- 受影响的规范：`stage`（适配层组织、chrome 文案）
- 受影响的代码：`stage-surface/compose-stage.tsx`、`stage-i18n.ts`、两个新增 Hook
- 用户可见行为：zh-CN 无变化；en-US 下资源拖入播报此前已是英文，现在还可被宿主覆盖。
