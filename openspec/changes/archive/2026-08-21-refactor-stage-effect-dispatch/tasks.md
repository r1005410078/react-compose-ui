# 任务：把效果分派与滚轮导航切成独立 Hook

- [x] 1.1 `use-stage-effect-dispatch.ts`：分派、三个命令规划器、中止清理与状态播报
- [x] 1.2 `use-stage-wheel-navigation.ts`：非 passive 滚轮监听
- [x] 2.1 资源拖入的六条播报文案进 `stage-i18n`（zh-CN / en-US 逐字不变）
- [x] 2.2 `compose-stage.tsx` 接线，1621 → 1097 行；`latestRef` 移除
- [x] 2.3 修正 `messages` 进依赖数组导致的回调不稳定（7 条用例失败后定位）
- [x] 3.1 既有测试与 e2e 一行不改仍全绿
- [x] 3.2 lint、typecheck、test、build、e2e 五道门槛
- [x] 3.3 更新路线图步骤 5 进度
