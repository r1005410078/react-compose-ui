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
  - 复现证据（`add-animation-timeline-zoom` 落地后用户实测反馈触发）：用 Playwright 在临时
    6 轨道诊断 Story 上实测，`.track-list`（左栏轨道名）与 `.scale-scroll`（右栏关键帧车道）是
    两个独立的纵向滚动容器；只滚动左栏后，左栏各行的 `getBoundingClientRect().top` 整体从
    `[803,871,939,1007,1075,1143]` 变为 `[723,791,859,927,995,1063]`（上移 80px，与滚动量一致），
    右栏对应行的位置完全不变，两栏彻底错开。滚轮缩放功能上线后用户更容易触碰到这个已知限制，
    实测数据可以直接作为本任务 Red 测试的断言基准。

## 6. 验证

- [ ] 6.1 运行包内 lint / typecheck / test / build 与仓库根全量验证。
- [ ] 6.2 运行 `bun run test:e2e`。
- [ ] 6.3 `openspec validate update-animation-panel-foundation --strict`。
