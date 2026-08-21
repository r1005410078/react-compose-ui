# 任务

## 1. 泛型契约

- [x] 1.1 在 `kernel-types.ts` 定义 `InteractionKernelProfile`（context / index / event /
      claimEvent / effect / snapshot），并约束 event 满足 `{ readonly pointerId?: number }`
- [x] 1.2 把 `StagePluginContext` / `StageSession` / `StageClaimResult` /
      `StageInteractionPlugin` 改写为对 profile 泛型的 `Interaction*` 契约
- [x] 1.3 移除 `kernel-types.ts` 对 `../interaction-controller` 与 `../hit-testing` 的 import

## 2. 泛型仲裁器与注册表

- [x] 2.1 `session-arbiter.ts` 改为泛型，移除 stage 专有 import
- [x] 2.2 `plugin-registry.ts` 改为泛型，移除 stage 专有 import
- [x] 2.3 `StageArbiterBeginResult` 保持非泛型

## 3. Stage 绑定

- [x] 3.1 新增 `stage-kernel-profile.ts`：定义 `StageKernelProfile` 与七个既有名称的别名
- [x] 3.2 `interaction-kernel/index.ts` 同时导出泛型契约与 Stage 别名
- [x] 3.3 确认 `stage-engine/src/index.ts` 对外导出的名称集合未变

## 4. 边界守卫

- [x] 4.1 `dependency-boundary.test.ts` 增加用例：三个泛型模块不得 import stage 专有模块
- [x] 4.2 Red：先让守卫在泛型化之前失败，确认它真的在检查

## 5. 验证

- [x] 5.1 `bun run lint`
- [x] 5.2 `bun run typecheck --force`
- [x] 5.3 `bun run test --force`（stage-engine 318 项全绿，`interaction-controller.test.ts` 未改）
- [x] 5.4 `bun run build --force`
- [x] 5.5 `bun run test:e2e`（99/99，黄金图 41 张逐像素一致）

## 6. 实施中的偏离记录

- [x] 6.1 `plugin-registry.ts` 的重复 id 错误文案由「Duplicate **Stage** interaction plugin id」
      改为「Duplicate interaction plugin id」。这是本刀唯一一处文本变化：泛型模块里出现
      `Stage` 字样与本变更自己写下的规范冲突，且守卫用 `/\bStage[A-Z]\w*/` 扫描时会命中。
      同步改了断言该文案的 `plugin-registry.test.ts:33`。
- [x] 6.2 profile 的 event 约束由 `{ readonly pointerId?: number }` 改为 `object`。
      前者只含可选属性，是 TypeScript 的 weak type，不携带 `pointerId` 的事件变体
      （`key.down`、`temporary-pan.*`）会因「没有共同属性」而无法赋值。改为 `object` 后
      指针绑定的读取集中到 `pointerIdOf()` 一个带注释的函数里。
- [x] 6.3 `StageArbiterBeginResult` 在泛型模块内更名为 `InteractionArbiterBeginResult`，
      公共名称由 `stage-kernel-profile.ts` 以别名保留，包入口导出的名称集合未变。
