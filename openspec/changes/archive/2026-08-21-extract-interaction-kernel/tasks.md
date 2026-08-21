# 任务

## 1. 建包

- [x] 1.1 `packages/interaction-kernel/`：package.json（`dependencies` 为空）、tsconfig、
      vite.config、vitest.config、README
- [x] 1.2 搬迁 `kernel-types.ts`、`plugin-registry.ts`、`session-arbiter.ts`，内容不变
- [x] 1.3 公共入口 `src/index.ts` 带 `@packageDocumentation`
- [x] 1.4 边界用例：依赖清单为空、源码不出现 React/DOM/`@compose-ui/*`

## 2. 内核自己的测试

- [x] 2.1 用中性 profile 重建注册表与仲裁器的行为测试（原测试走的是 Stage 绑定）
- [x] 2.2 覆盖三态 claim、同时至多一个会话、commit 前吃终点、重入不重复提交
- [x] 2.3 覆盖 `isCompatibleWith` 自检与 `release` 幂等

## 3. Stage 侧接线

- [x] 3.1 `stage-engine` 增加依赖，`stage-kernel-profile.ts` 改为从新包导入
- [x] 3.2 删除搬走的三个文件与它们在 `interaction-kernel/index.ts` 中的转导
- [x] 3.3 公共入口逐字不变：泛型契约继续从 `@compose-ui/stage-engine` 转导
- [x] 3.4 `dependency-boundary.test.ts`：正则守卫换成「依赖清单只有两项」——边界改由包承载
- [x] 3.5 保留一份走 Stage 绑定的仲裁用例，证明别名仍然可用

## 4. 登记

- [x] 4.1 AGENTS.md：新增 `@compose-ui/interaction-kernel` 与漏登记的 `@compose-ui/cad-canvas`
      两条架构边界，并把 interaction-kernel 加进第 1 层列表
- [x] 4.2 根 `package.json` 的 `pack:dry-run` 补上两个包

## 5. 验证

- [x] 5.1 `bun run lint`
- [x] 5.2 `bun run typecheck --force`
- [x] 5.3 `bun run test --force`
- [x] 5.4 `bun run build --force`
- [x] 5.5 `bun run test:e2e`

## 6. 实施中的发现与偏离

- [x] 6.1 **搬迁的两份测试原来是走 Stage 绑定写的**，不是中性的。在新包里按中性 profile 重写，
      Stage 侧只留一份「绑定接得上」的用例。分工是：仲裁语义由内核包锁定，绑定是否退化由
      Stage 锁定——后者才是抽包最容易出的错（工厂直接转导泛型函数时空数组推不出参数）。
- [x] 6.2 `plugin-registry.test.ts` 里其实是两件事：注册表排序（通用）与 `STAGE_GESTURE_PRIORITY`
      优先级表（Stage 专有）。前者随内核走，后者留下并改名 `gesture-priority.test.ts`，文件名
      终于和内容一致。
- [x] 6.3 **原来的用例根本没测 `revalidate`**。搬迁时才发现：`isCompatibleWith` 的行为只有
      `interaction-controller.test.ts` 间接覆盖，仲裁器这一层是空的。新包补齐了自检的四种情形
      与 `consumesTemporaryPan`。抽包的附带收益，不在计划内。
- [x] 6.4 **AGENTS.md 里 `@compose-ui/cad` 的依赖写的是「只能依赖 core 与 assets」，但它从步骤 5
      起就依赖 `commands`** 了。顺手改正。没有预先把 `interaction-kernel` 写进去——那是下一刀
      真正接线时才该登记的事。
- [x] 6.5 边界守卫**换了守的东西而不是删掉**。包依赖拦得住「import 一个改名后的文档类型」，
      拦不住「Stage 侧又写一份仲裁」。因此 Stage 一侧留下一条更窄的断言：内核目录里不得出现
      第二个 `createInteraction*` 实现。
- [x] 6.6 e2e 在两次满负载运行中各掉了一个**不同**的用例（`stage-interactions` 的绘制预览、
      `auto-layout` 的交叉轴填充），单独重跑都通过，第三次满量跑 103/103 全绿。两条都是对时序
      敏感的布局断言，与本刀无关——本刀不改任何行为。
