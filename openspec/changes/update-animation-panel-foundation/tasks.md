## 1. 主题

- [ ] 1.1 Red：为 light 主题下的关键前景色写组件测试或 Storybook 双主题故事。
- [ ] 1.2 Green：把 `styles.css` 的硬编码前景色替换为 `--compose-*` token。

## 2. 片段归属

- [ ] 2.1 Red：为多轨道各自渲染片段、选择片段联动轨道写模型与组件测试。
- [ ] 2.2 Green：给 `ComposeAnimationClip` 增加必填 `trackId`，删除 label / 前缀启发式。
- [ ] 2.3 更新 `createDefaultComposeAnimationPanelValue` 与 Storybook 夹具。

## 3. 文案归属

- [ ] 3.1 Red：为宿主自定义 label 在 en-US 下的显示写测试。
- [ ] 3.2 Green：删除 `displayTrackLabel` / `displayPropertyLabel` 及相关 messages。

## 4. 复用共享组件

- [ ] 4.1 给 `packages/animation-panel/package.json` 增加 `@compose-ui/components` 依赖并在 vite 外置。
- [ ] 4.2 Green：按钮、数值输入与颜色字段改用共享 Primitive。
- [ ] 4.3 用 `ComposeContextMenu` 重新提供轨道与属性行的"更多操作"菜单。

## 5. 滚动对齐

- [ ] 5.1 Red：为超出可视高度的多轨道滚动对齐写测试。
- [ ] 5.2 Green：重排双栏结构，共用同一条垂直滚动。

## 6. 验证

- [ ] 6.1 运行包内 lint / typecheck / test / build 与仓库根全量验证。
- [ ] 6.2 运行 `bun run test:e2e`。
- [ ] 6.3 `openspec validate update-animation-panel-foundation --strict`。
