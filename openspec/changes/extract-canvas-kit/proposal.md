# 抽出无限画布基础包 `@compose-ui/canvas-kit`

## Why

页面画布与 CAD 画布各自实现了同一套底座，而其中一份严格更好。

**绕锚点缩放的代数写了两遍**，只有钳制范围不同：

```
zoomViewportAt(viewport, screenPoint, zoom)   stage-engine   钳制 0.1–8
cadZoomViewport(viewport, factor, anchor)     cad-canvas     钳制 0.02–256
```

**滚轮导航的三个坑被独立踩了两次**：手动挂原生非 passive 监听（React 的合成 wheel 是 passive
委托，`preventDefault` 拦不住页面滚动）、用 latest-ref 让监听只注册一次（进依赖数组会在滚动
中丢帧）、指数换算保证放大与缩小对称。两边**各写了一份注释解释这三个坑**——同一组坑被独立
发现两次并各自留下说明，是重复最硬的证据。

网格那边不是风格差异而是真缺陷：

| | 页面 Stage | CAD |
|---|---|---|
| 画法 | CSS 多层 gradient，零 DOM 节点 | 每条线一个 SVG `<line>` |
| 层级 | 主线 + 细线 | 只有一级 |
| 抽稀 | 二次幂 stride 自适应 | **间距不足 8px 直接整片消失** |
| 两轴 | `stepX`/`stepY` 与各自 offset 独立 | 单一 step，无 offset |
| 设备像素 | 按 DPR 取整，线不跨列模糊 | 不处理 |

CAD 图缩到 0.8 倍以下网格整块不见，而那恰是画总图最常用的缩放区间。

标尺则是现成的：[stage-ruler/](packages/stage/src/stage-ruler/) 已经是一个 Pattern——刻度是
props 传进去的，连「从标尺往下拖生成辅助线」的 `onPointerDown` 也是 props 传进去的，组件里
一点 Stage 语义都没有，剩下的全是 DPR、ResizeObserver、从 CSS 自定义属性读调色板、以命令式
更新游标线这类**重写一遍必然写歪**的琐碎正确性。

两个消费者已经在场，因此这不是提前抽象。

## What Changes

- **无 React 部分下沉到 `core`**：视口模型（`offset + zoom`、世界↔屏幕、平移、绕锚点缩放）、
  轴点阵、标尺刻度、视口适配几何。入参去掉各自的视口类型，只收普通数字。
- **新建 `@compose-ui/canvas-kit`**（层级 2）承载画布的 React 底座：滚轮导航 Hook、图面尺寸
  Hook、标尺组件、自定义滚动条。依赖 `core` 与 `ui-context`，React 为 peer。
- `stage` 与 `cad-canvas` 改为消费两者。`stage-engine` 保留既有导出名的转导。
- CAD 网格改用共享点阵并按 CSS 多层 gradient 绘制，获得主/细两级、自适应抽稀与 DPR 对齐；
  SVG 网格线节点全部删除。CAD 画布加上上/左标尺与原点角。

## Impact

- Affected specs: `canvas-kit`（新增）、`cad-document`
- Affected code: `@compose-ui/core`、`@compose-ui/stage-engine`、`@compose-ui/stage`、
  `@compose-ui/cad-canvas`、新增 `@compose-ui/canvas-kit`
- **Stage 是纯重构**：行为一字不改，既有需求、用例与黄金图原样通过。
