## 1. 默认值

- [x] 1.1 `createDefaultCanvasSettings` 的 `stepX/stepY` 改为 4，并在 TSDoc 里写下取 4 的理由
- [x] 1.2 `DEFAULT_WORKSPACE_SEEDS` 改为 4×4，注释同步（绘图种子不动）

## 2. 文档

- [x] 2.1 README 的「新建种子」段把页面的 8×8 改成 4×4

## 3. 验证

- [x] 3.1 `bun run lint` / `bun run typecheck` / `bun run test`
- [x] 3.2 `bun run test:e2e`（网格线渲染与吸附相关的黄金图与端到端用例）
