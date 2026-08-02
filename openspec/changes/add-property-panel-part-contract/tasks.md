## 1. property-panel 发布 Part 契约

- [ ] 1.1 Red: 断言 toolbar、separator、fields、ungrouped、field、label、editor、actions、control
  各自输出对应的 `data-property-part`；记录失败证据。
- [ ] 1.2 Green: 在 property-tree 与 compose-property-panel 的结构容器上输出该属性。
- [ ] 1.3 Refactor: 在包 TSDoc 与 `styles.css` 顶部说明这是唯一受支持的结构选择器契约。

## 2. materials 迁移到新契约

- [ ] 2.1 Red: 加护栏测试断言 materials 样式表不含 `property-panel__` 前缀；当前应失败（12 处）。
- [ ] 2.2 Green: 把 `flex-layout/styles.css` 与 `material-inspector-kit/styles.css` 的 12 处选择器
  改写为 `data-property-part`，保持选择器特异性不变（属性选择器与类选择器同级）。
- [ ] 2.3 Refactor: 重跑 Inspector 相关 E2E 黄金图，逐张确认无像素回归。

## 3. 验证

- [ ] 3.1 运行 `openspec validate --strict`、lint、typecheck、test、build。
- [ ] 3.2 运行 `bun run test:e2e`，Inspector 黄金图全部通过且未更新快照。
