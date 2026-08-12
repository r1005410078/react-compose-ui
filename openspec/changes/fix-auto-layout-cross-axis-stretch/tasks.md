# 任务

## 1. 修复与回归

- [x] 1.1 红测：容器 `alignItems: stretch`、Hug 交叉轴子级 `alignSelf: auto` 时子级交叉轴被拉伸
- [x] 1.2 红测：子级显式 `alignSelf` 非 `auto` 时优先于父级 `alignItems` 生效
- [x] 1.3 红测：容器 `alignItems` 为非拉伸值时 Hug 子级保持内容尺寸
- [x] 1.4 删除 `layout-runtime.ts` 中 Hug 交叉轴强制 `flex-start` 的覆盖逻辑
- [x] 1.5 跑 `layout-engine`、`materials`、`stage` 既有测试，确认没有测试隐式依赖被删的覆盖行为
- [ ] 1.6 人工核对涉及 Auto Layout 的既有 e2e 黄金截图，按需重新生成

## 2. 验证

- [ ] 2.1 `bun run lint && bun run typecheck && bun run test && bun run build`
- [ ] 2.2 `bun run test:e2e`
- [ ] 2.3 `openspec validate fix-auto-layout-cross-axis-stretch --strict`
