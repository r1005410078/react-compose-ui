# 任务

## 1. core：点阵与默认值

- [x] 1.1 `latticeLineBand` 的 `width` 从 `1` 改为 `1 / devicePixelRatio`，文档字符串
  「带宽恒为 1 CSS px」跟着改成设备像素
- [x] 1.2 用例 `设备像素比放大时保持整像素宽度` 名实不符（断言的是 1 CSS px，在 dpr=2 下
  正好不是整数个物理像素）——改成断言 `width * dpr === 1`
- [x] 1.3 `snapToDevicePixel` 保持不变；新增导出「满值线最小间距」常量，
  与 `RULER_MIN_TICK_SPACING` 写在一起，两者是同一个数
- [x] 1.4 `createDefaultCanvasSettings` 的 `primaryLineEvery` 8 → 4

## 2. stage：网格渲染

- [x] 2.1 删除 `MIN_VISIBLE_GRID_SPACING`，改为 `GRID_FADE_START = 4`（满值间距 = 它的两倍）
- [x] 2.2 细线产出细档与骨架档两层，细档按 `clamp(间距 / T − 1, 0, 1)` 淡入，
  骨架档按 `(A − a) / (1 − a)` 补足
- [x] 2.3 删除主线那两次 `createVisibleGridAxis` 调用，改为从细档世界步长派生
  `× primaryLineEvery` 与 `× primaryLineEvery²` 两级，满值、不淡入
- [x] 2.4 渐变 stop 从 `1px` 改为 `1 / devicePixelRatio` px
  （落点无需改动：`snapToDevicePixel` 本来就按设备像素取整，此前只是线宽没跟上）
- [x] 2.5 色阶乘 `devicePixelRatio` 补偿墨量
- [x] 2.6 颜色改为每主题一支墨 + 三档 alpha，深色补上缺失的 token
  （今天深色的值只存在于 `var(..., 兜底)` 的兜底里，宿主换不了皮）

## 3. stage：标尺

- [x] 3.1 标尺刻度线宽跟着改为一个设备像素，否则同一世界坐标在标尺上比图面上粗一倍

## 4. 用例

- [x] 4.1 满值的线之间恒 ≥ 8px（扫 5%–400%）
- [x] 4.2 主线间距 ÷ 细档间距 恒等于 `primaryLineEvery`，粗格恒等于它的平方
  （扫一遍缩放；单点断言会错过漂移）
- [x] 4.3 缩放连续变化时骨架线的合成值恒定——唯一能挡住「每隔一根深一档」的断言
- [x] 4.4 `zoom ≥ 1` 时细档满值、骨架档不画，输出与改动前逐字相同
- [x] 4.5 线宽 × `devicePixelRatio` 恒为 1
- [x] 4.6 既有的「只按二次幂抽稀」「与标尺落到同一像素」两条保持通过

## 5. 验证

- [x] 5.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 5.2 `bun run test:e2e`，更新受影响的黄金图

## 实施记录

- 三级层级**不需要动 Schema**：粗格取 `primaryLineEvery` 的平方，`primaryLineEvery` 仍是
  单个正整数。原提案以为要加字段，写规范时发现网格本来就是自相似的，「主线的主线」就是
  层级的定义。因此只改了默认值 8 → 4。
- 既有 e2e 里有三处按固定下标读 `backgroundSize.split(',')[2]` 当作细线间距，并断言图层数
  恒为 4。图层数现在随缩放变化（细档淡到 0 时那一层被丢掉），已改成「取该轴最后一条」。
- `e2e/__screenshots__/stage-workspace-canvas-inspector.png` 与 `stage-workspace-low-zoom-grid.png`
  已重新生成。前者**此前就已过期**——它画的还是改版前的工具栏（带「设计 / 绘图」切换）。
- `stage-drawing-text-preview` 此前一直失败（黄金图早于常驻命令行与场景填充两处改动），
  现在因为网格变淡、差异降到 1% 阈值以下而**碰巧转绿**。它的黄金图内容仍然过期，
  是靠阈值过的、不是靠正确过的。
