## 1. 规范与测试

- [x] 1.1 为页面模式不创建固定 Canvas、启动自动打开首页补充编辑器测试（Red）。
- [x] 1.2 记录 Red 测试失败证据：`bun run --cwd packages/editor test -- src/workspace-layout/workspace-layout.test.ts src/pages/page-workspace.test.tsx` 在 2026-08-09 失败；固定 Canvas 仍被创建，标记首页也未自动创建页面标签。

## 2. 实现

- [x] 2.1 让工作区初始化按页面模式省略固定 Canvas，但保留中央组和单文档兼容行为。
- [x] 2.2 在目录解析后仅尝试一次打开有效标记首页，并保持首页缺失的非阻断状态。
- [x] 2.3 运行对应测试并记录 Green 证据：`bun run --cwd packages/editor test -- src/workspace-layout/workspace-layout.test.ts src/pages/page-workspace.test.tsx` 通过（29 tests）；`bun run test:e2e -- --grep "启动时打开标记首页"` 通过（1 test）。

## 3. 验证

- [x] 3.1 运行 OpenSpec strict validation、lint、typecheck、test、build、E2E 与 `git diff --check`：全部通过。`bun run test:e2e` 内含全仓 build（35 tests passed）；`bun run test` 在允许本地端口后通过（含 44 Storybook tests）。
