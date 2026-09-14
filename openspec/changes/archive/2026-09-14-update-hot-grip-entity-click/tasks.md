## 1. 引擎

- [x] 1.1 `drafting.point` 效果携带 `hit`

## 2. Stage

- [x] 2.1 `resolvePointerHit` 报告 `snapped`（与捕捉标记同一份事实）
- [x] 2.2 `handlePoint`：热夹点 + 别的 Entity + 没吸上 → 取消会话、选中它

## 3. 端到端

- [x] 3.1 点亮 A 的夹点后点 B 的线身：A 几何不变、B 选中，再双击进 B 的顶点模式
- [x] 3.2 点亮后在 B 的端点处点击（吸上）：A 的顶点落到那个端点

## 4. 收尾

- [x] 4.1 `openspec validate --strict`；`AGENTS.md` 补一句
- [x] 4.2 `bun run lint` / `typecheck` / `test` / `build`；`test:e2e`
