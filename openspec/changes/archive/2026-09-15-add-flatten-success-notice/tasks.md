- [x] 1.1 `stage-i18n.ts`：`booleanFlattened(count)` 中英各一份
- [x] 1.2 `boolean-plan.ts`：`StageBooleanPlanOptions` 加一条 `flattened`，
      `planStageFlatten` 成功时把它填进 `notice`；区域运算那一支的 `notice` 仍为 null
- [x] 1.3 `compose-stage.tsx` 与 `use-stage-drafting.ts`：把这条文案接到既有的 notice 通道上
- [x] 1.4 单测（判别性）：拍平一个与拍平两个各报对个数；`planStageBoolean` 的 `notice` 仍是 null

      > Green command: `bun run test --filter @compose-ui/stage`
      > Green result: 445 passed

- [x] 1.5 端到端：拍平之后命令行读得到这句话；并集之后读不到

      > 这一条的 Red 是**既有用例自己给的**：两条拍平用例原先断的是拍平之后命令行写着
      > 「命令：」，而这句说明把它顶掉了，加完文案两条当场变红（`unexpected value
      > "已拍平 4 个对象，顶点已换成控制手柄"`）——正说明这句话真的出现在用户看的那个位置上。
      > 并集那一条补了一句 `not.toContainText('已拍平')`，钉住「不推广成每条命令都报一句」。
      >
      > Green command: `bun run test:e2e -- e2e/curve-boolean.spec.ts`
      > Green result: 10 passed
- [x] 1.6 门禁：lint、typecheck、单测、构建、端到端

      > 五项全绿，一次过：`bun run lint` 0、`bun run typecheck` 0、`bun run build` 0、
      > `bun run test` 0、`bun run test:e2e` 0（368 passed）。这一轮没有出现前几次那种
      > 并行满载下的超时。
