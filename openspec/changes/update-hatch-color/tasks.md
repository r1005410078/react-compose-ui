## 1. 第三支：改一块已有填充的颜色（stage-engine）

- [x] 1.1 `stageCurveToParent` / `stagePointToParent` 从 `stage` 下沉到 `stage-engine`，
      `stage` 转调（跟随、过期判定与这一支读同一条换算）
- [x] 1.2 `resolveStageHatchRegion` 多一支 `recolor`：重求出来的几何与某块已有填充逐位相同
- [x] 1.3 次序：`recolor` 排在 `fill` 之前
- [x] 1.4 已有填充锁定时拒绝，不退回新建
- [x] 1.5 单测：再点一次即改色、劈成两半之后两半都新建、盖着完整矩形时改的是填充、锁定即拒绝

## 1b. 同一块面，从哪儿点都写出同一个环（core）

写 1.5 的判别性用例时发现的：环从射线第一次穿过的那条边起手，而射线是从落点射出去的，
因此换个位置再点一次会写出起点不同的同一个环——逐位比较说「不是同一块」，于是又叠一块。

- [x] 1b.1 `resolveComposeCurveRegion` 把环的起点归一到字典序最小的顶点，岛同理
- [x] 1b.2 单测：同一块**凹**形的面从三处各求一次，三次逐位相同（凸形是假用例）
- [x] 1b.3 判据连**归一化偏移**一起比：全等的左右两半 `Curve` 逐位相同，只比几何会让右半永远填不上

## 2. 落地与提示（stage）

- [x] 2.1 `planStageHatch` 受理 `recolor`：写那块填充的 `Appearance.backgroundPaint`
- [x] 2.2 第三句提示文案（中英），悬停与落地读同一份解算
- [x] 2.3 单测：三支各产出什么命令

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
