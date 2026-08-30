# 画布网格：抽稀判据、层级与线宽

## Why

缩小之后网格发糊，大格子读不出来。量下来是三条各自独立的缺陷，都不是配色问题。

**抽稀问错了问题。** `MIN_VISIBLE_GRID_SPACING = 2` 的注释写着「1px 网格线至少保留 1px
空隙才不会退化为整片填色」——那是**退化的下限**，不是可读的下限。抽稀后间距恒落在
`[阈值, 2×阈值)`，因此细线间距恒在 2–4px 且全画在满不透明度上；25% 缩放时正好是 2px，
1px 线配 1px 缝。标尺细刻度的阈值是 8，两者共用同一个点阵却对「多密算太密」各有一套数。

**主线自己算自己的抽稀。** `createVisibleGridAxis` 被分别调用在 `stepX` 与
`stepX × primaryLineEvery` 上，两条 stride 各走各的，「每 N 格一条主线」这个比例必然漂：
50% 以上是 8 格，20% 变 4 格，10% 变 2 格，5% 时主线与细线**完全重合**——大格子在屏幕上
消失。主线的职责是让人数格子，比例一漂这件事就不成立了，而屏幕上没有任何东西提示它已经
不成立。

**线宽写的是 1 CSS px。** 在 2× 屏上那是两个物理像素，3× 屏上是三个——屏幕越好线越粗。
本规范自己的措辞是「覆盖……那一个**设备像素列**」，实现从一开始就与它不符。

## What Changes

- 细线抽稀判据从「间距 ≥ 2px」换成「**满值的线之间恒 ≥ 8px**」：淡入起点 4px，细档在
  `[4, 8)` 区间内按间距淡入，`2×stride` 的骨架档补足差额使其合成值恒等于满值。
- 主线**派生**自细档而不再独立抽稀，且**不淡入**。层级为 `primaryLineEvery` 的幂：
  细 / 中 / 粗 = `step × 1` / `× primaryLineEvery` / `× primaryLineEvery²`。
- `grid.primaryLineEvery` 的**默认值** 8 → 4（Schema 不变，仍是正整数）。默认层级因此是
  8 / 32 / 128 世界单位。
- 网格线宽从 1 CSS px 改为 **1 个设备像素**，浓度同乘 `devicePixelRatio` 补回墨量。
- 网格颜色从四组互不相干的 hex+alpha 收成**每主题一支墨 + 一条由目标对比度反解的 alpha
  阶梯**（1.25 / 1.50 / 1.80）。深色主题补上此前缺失的 token。
- 删除 `MIN_VISIBLE_GRID_SPACING`，改名为表达新判据的常量。

## Impact

- Specs：`stage`（自适应网格标尺与世界原点）、`canvas-kit`（网格与标尺共用同一点阵）
- 代码：`packages/stage/src/grid-rendering.ts`、`packages/stage/src/styles.css`、
  `packages/core/src/axis-lattice.ts`（`latticeLineBand` 的带宽与其用例名不符）、
  `packages/core/src/canvas-settings.ts`（默认值）
- **不改文档 Schema**：`primaryLineEvery` 仍是单个正整数，粗格由它的平方派生。
- 既有文档：显式存了 `primaryLineEvery: 8` 的文档保持 8，只有新建文档拿到新默认值。
