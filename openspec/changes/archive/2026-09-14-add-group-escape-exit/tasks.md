## 1. 解算（stage-engine）

- [x] 1.1 `resolveStageGroupExit`：共同的最近 Group 严格祖先；复合地址按宿主实例算
- [x] 1.2 单测：单选回上一层、无更外层为 null、多选只认共同的、复合地址与幽灵 ID

## 2. Stage

- [x] 2.1 空闲时 `Escape` 选中那个 Group；手势进行中仍只中止手势

## 3. 端到端

- [x] 3.1 `stage-interactions.spec.ts` 的 Group 用例加 Escape 步：回到 Group、再按不变、能再双击进去

## 4. 收尾

- [x] 4.1 规范增量通过 `openspec validate --strict`；`AGENTS.md` 补一句
- [x] 4.2 `bun run lint` / `typecheck` / `test` / `build`；`test:e2e`
