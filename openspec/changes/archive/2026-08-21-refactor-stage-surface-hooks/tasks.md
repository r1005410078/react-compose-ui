# 任务：抽出适配层剩余的四处独立关注点

- [x] 1.1 `use-stage-hidden-entities.ts`：两层记忆化及其约束进 TSDoc
- [x] 1.2 `use-stage-surface-size.ts`：零尺寸与同值两处判定就近说明
- [x] 1.3 `stage-screen-model.ts`：纯函数视图模型（刻意不是 Hook）
- [x] 2.1 预览变换合成折进 `useStagePreviewDocuments`，宿主减两个中间值
- [x] 2.2 加载提示改走 `stage-i18n`（第三处硬编码 chrome 文案）
- [x] 3.1 `compose-stage.tsx` 800 → 714 行
- [x] 3.2 lint、typecheck、test、build、e2e 五道门槛；黄金图零差异
