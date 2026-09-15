- [ ] 1.1 `stage-i18n.ts`：`booleanFlattened(count)` 中英各一份
- [ ] 1.2 `boolean-plan.ts`：`StageBooleanPlanOptions` 加一条 `flattened`，
      `planStageFlatten` 成功时把它填进 `notice`；区域运算那一支的 `notice` 仍为 null
- [ ] 1.3 `compose-stage.tsx` 与 `use-stage-drafting.ts`：把这条文案接到既有的 notice 通道上
- [ ] 1.4 单测（判别性）：拍平一个与拍平四个各报对个数；`planStageBoolean` 的 `notice` 仍是 null
- [ ] 1.5 端到端：拍平之后命令行读得到这句话；并集之后读不到
- [ ] 1.6 门禁：lint、typecheck、单测、构建、端到端
