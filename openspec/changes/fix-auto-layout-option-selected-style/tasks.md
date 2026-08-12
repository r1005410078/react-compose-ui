# 任务

## 1. 样式修正

- [x] 1.1 确认 `component-inspectors.test.tsx` 中断言 `data-initial-value` 存在的既有用例不受影响
- [x] 1.2 合并 `packages/materials/src/flex-layout/styles.css` 里
      `[aria-checked="true"][data-initial-value]` 与
      `[aria-checked="true"]:not([data-initial-value])` 两条规则，统一使用强调色
- [x] 1.3 人工核对 direction / wrap / justify-content / align-items 四个默认值选项的选中态可清楚辨认
- [x] 1.4 更新覆盖该面板的既有 e2e 黄金截图

## 2. 验证

- [x] 2.1 `bun run lint && bun run typecheck && bun run test && bun run build`
- [x] 2.2 `bun run test:e2e`
- [x] 2.3 `openspec validate fix-auto-layout-option-selected-style --strict`
