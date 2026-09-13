## 1. 取景

- [x] 1.1 `defaultFitForTargetKind` 的场景档由 `contain` 改为 `cover`，TSDoc 写下取舍与代价
- [x] 1.2 `fit` 生效时 `ComposePreview` 根节点撑满宿主盒子（宿主自己的 `style` 仍覆盖它）

## 2. 用例

- [x] 2.1 端到端：1280 × 720 的场景在 1675 × 996 视口里两条边都不留台面、等量溢出、被裁掉
      （两轴比例刻意不同；等比时 cover 的两个候选相等，那样断不出问题）

## 3. 文档

- [x] 3.1 AGENTS.md 的预览 `fit` 段落改写，并记下「量 fit 的盒子必须真的是宿主盒子」

## 4. 验证

- [x] 4.1 `bun run lint` / `bun run typecheck` / `bun run test`
- [x] 4.2 `bun run test:e2e`
