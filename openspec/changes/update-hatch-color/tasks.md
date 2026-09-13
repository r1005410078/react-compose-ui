## 1. 第三支：改一块已有填充的颜色（stage-engine）

- [ ] 1.1 `stageCurveToParent` / `stagePointToParent` 从 `stage` 下沉到 `stage-engine`，
      `stage` 转调（跟随、过期判定与这一支读同一条换算）
- [ ] 1.2 `resolveStageHatchRegion` 多一支 `recolor`：重求出来的几何与某块已有填充逐位相同
- [ ] 1.3 次序：`recolor` 排在 `fill` 之前
- [ ] 1.4 已有填充锁定时拒绝，不退回新建
- [ ] 1.5 单测：再点一次即改色、劈成两半之后两半都新建、盖着完整矩形时改的是填充、锁定即拒绝

## 2. 落地与提示（stage）

- [ ] 2.1 `planStageHatch` 受理 `recolor`：写那块填充的 `Appearance.backgroundPaint`
- [ ] 2.2 第三句提示文案（中英），悬停与落地读同一份解算
- [ ] 2.3 单测：三支各产出什么命令

## 3. 颜色面板（components / editor）

- [ ] 3.1 `ComposeColorPicker.embedded` 从 `@internal` 升为公开，TSDoc 说清它是哪一档
- [ ] 3.2 工具栏 `▾` 打开的面板：色板行（单选组）+ 内嵌取色器
- [ ] 3.3 容器从 `role="menu"` 换成 `role="dialog"`；键盘（Escape 关闭、焦点归还触发器）跟上
- [ ] 3.4 组件测试：挑一个图上没用过的颜色、色板仍在、Escape 归还焦点

## 4. 端到端

- [ ] 4.1 对同一块面填两次：颜色变了，而 Entity 数量**不变**
- [ ] 4.2 悬停时命令行说「将改变这块填充的颜色」
- [ ] 4.3 劈成两半之后点任一半都新建
- [ ] 4.4 从工具栏面板挑一个新颜色，填出来就是它
- [ ] 4.5 用例 MUST 在非 100% 缩放下断言

## 5. 收尾

- [ ] 5.1 `bun run lint && bun run typecheck && bun run test && bun run build`
- [ ] 5.2 `bun run test:e2e`
- [ ] 5.3 按需同步 `AGENTS.md`（三支、面板不是菜单）
