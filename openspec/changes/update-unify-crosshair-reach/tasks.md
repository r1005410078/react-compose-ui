## 1. 实现
- [x] 1.1 `DEFAULT_WORKSPACE_SESSION.crosshairSize` 改为 100，删除 `DRAWING_WORKSPACE_SESSION`
- [x] 1.2 controller 的 `crosshairSize` 初值同步改为 100
- [x] 1.3 `e2e/builtin-workspaces.spec.ts`：把「绘图 > 页面 5 倍」改为断言三边相等

## 2. 验证
- [x] 2.1 `openspec validate update-unify-crosshair-reach --strict`
- [x] 2.2 `bun run lint && bun run typecheck && bun run test && bun run build`
- [x] 2.3 `bun run test:e2e`
