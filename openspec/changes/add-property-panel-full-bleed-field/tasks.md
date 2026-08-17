## 1. property-panel：贴边布局

- [x] 1.1 `PropertyPanelRendererLayout` 增加 `'full-bleed'`，补 TSDoc 说明适用范围与限制
- [x] 1.2 `property-tree.tsx` 的布局解析接受新取值，全宽渲染分支按布局追加
      `property-panel__editor--full-bleed` / `property-panel__control--full-bleed` modifier
- [x] 1.3 `styles.css` 把贴边内容区的左右内缩归零，纵向内缩、分隔线与背景保持不变
- [x] 1.4 组件测试：贴边字段的 `data-property-layout` 与 modifier 类；既有 full-width 字段不受影响

## 2. editor：两个可视化字段 opt-in

- [x] 2.1 缓动曲线字段改用 `full-bleed`
- [x] 2.2 页面脚本返回成员字段改用 `full-bleed`
- [x] 2.3 同步两处未归档变更增量中关于 full-width 的措辞

## 3. 测试与验证

- [x] 3.1 Playwright：缓动曲线画布与返回成员列表的内容盒左右边界与所在行一致（±1px）
- [x] 3.2 `bun run lint && bun run typecheck && bun run test && bun run build && bun run test:e2e`
- [x] 3.3 `openspec validate add-property-panel-full-bleed-field --strict`
