# CAD 复用页面画布的网格与标尺

## Why

两个画布各画了一套网格，而页面那套严格更好：

| | 页面 Stage | CAD |
|---|---|---|
| 画法 | CSS 多层 gradient，零 DOM 节点 | 每条线一个 SVG `<line>` |
| 层级 | 主线 + 细线 | 只有一级 |
| 抽稀 | 二次幂 stride 自适应 | **没有——间距不足 8px 直接整片消失** |
| 两轴 | `stepX`/`stepY` 与各自 offset 独立 | 单一 step，没有 offset |
| 设备像素 | 按 DPR 取整，线不跨列模糊 | 不处理 |

第三行是真缺陷而不是风格差异：CAD 图缩到 0.8 倍以下网格**整块不见了**，而这恰恰是画总图时
最常用的缩放区间。AutoCAD 的 `GRIDDISPLAY` 在这里做的也是自适应抽稀而不是隐藏。

标尺那边情况更好：[stage-ruler/](packages/stage/src/stage-ruler/) **已经是一个 Pattern 了**
——刻度是 props 传进去的，连「从标尺往下拖生成辅助线」的 `onPointerDown` 也是 props 传进去
的，组件里一点 Stage 语义都没有，只剩下 DPR、ResizeObserver、从 CSS 自定义属性读调色板、以及
用命令式接口更新光标线避免 pointermove 触发重渲染——全是那种重写一遍必然写歪的琐碎正确性。
它甚至**已经在画指针游标线**了。

依赖层面这次搬家不需要动任何边界：`components` 已经依赖 `core`，`cad-canvas` 已经同时依赖
`core` 与 `components`。

## What Changes

- 点阵与刻度求解（`createAxisLattice` / `createRulerTicks` / 刻度类型）下沉到 `core`，
  入参去掉 `StageViewport` 改为普通数字。`stage-engine` 保留转导，Stage 行为不变。
- 标尺画笔与 React 外壳下沉到 `components`，成为不含业务语义的 `ComposeRuler` Pattern。
- CAD 图面的网格改由同一点阵求解并按 CSS 多层 gradient 绘制，获得主/细两级、自适应抽稀与
  DPR 对齐；SVG 网格线节点全部删除。
- CAD 画布加上上/左标尺与原点角，刻度、指针游标与选择集区间条与页面画布一致。

## Impact

- Affected specs: `cad-document`、`components`
- Affected code: `@compose-ui/core`、`@compose-ui/stage-engine`、`@compose-ui/components`、
  `@compose-ui/stage`、`@compose-ui/cad-canvas`
- Stage 是**纯重构**：行为一字不改，既有需求与用例原样通过。
