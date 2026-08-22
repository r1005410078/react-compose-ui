# 设计

## 为什么不是「CAD 依赖 Stage」

`cad-canvas` 不得依赖 `stage` 与 `stage-engine`，这条边界是对的：Stage 的命中单位是矩形
（`getWorldBounds` 返回 `StageRect`），CAD 的直线没有盒模型，命中判据是点到线段的距离。
两者不是同一件事。

但**视口数学与标尺画笔跟这条差异毫无关系**。判据是「它认识文档吗」——点阵只吃
`step / offset / viewportOffset / zoom / minScreenSpacing` 一串数字。它待在 `stage-engine`
只是历史位置，不是边界要求。

## 分两处落地，避免依赖倒置

一个包同时装无 React 的数学与 React 的 Hook，会逼出一条倒置：`stage-engine` 是 headless 的，
它内部的 `createRulerTicks` 用着点阵，如果点阵搬进以 React 为 peer 的 `canvas-kit`，headless
包就得依赖一个 React 包。

因此按「有没有 React」切开：

- **`core`**：视口模型、轴点阵、标尺刻度、视口适配几何。无 React、无 DOM。
  `stage-engine`、`canvas-kit`、`cad-canvas` **全都已经依赖它**，不新增任何依赖边。
  网格配置 `ComposeCanvasSettings` 本来就住在这里，点阵与它同处一包是自然的。
- **`canvas-kit`**：滚轮导航 Hook、图面尺寸 Hook、标尺组件、自定义滚动条。React 为 peer。

## 为什么不放进 `components`

`components` 只接收 Primitive 与 Pattern。标尺勉强算 Pattern，但滚轮与尺寸是 Hook 不是组件，
而滚动条需要一条视口映射才能工作。真正的理由是：**`components` 不该学会「视口」是什么**。
一旦它认识 offset 与 zoom，下一个带视口的东西就会继续往里堆。

`canvas-kit` 的内聚点正是视口——里面每一样东西离开视口都没有意义。这比按 Primitive/Pattern
分类更能说明它为什么是一个包。

## 边界：什么**不能**进去

写清楚比写进去更重要，否则这个包会长成垃圾桶。以下三类 MUST NOT 进入：

- **命中测试**：Stage 是矩形、CAD 是点到几何距离。这正是两者不能互相复用的根本原因，把它
  塞进来等于把那条差异变成包内的 if。
- **场景渲染**：DOM 节点 vs SVG 图元。
- **手势语义**：Stage 点击替换选择，CAD 点击累加（AutoCAD 约定）。两者相反且都是刻意的。

判据统一成一句：**它认识文档或选择集吗？认识就不进。**

## 视口形状的差异是三行适配

`StageViewport` 是 `{ x, y, zoom }`，`CadViewport` 是 `{ offset: {x,y}, zoom }`，同样的信息
换了个壳。下沉后的入参只收 `viewportOffset: number` 与 `zoom: number`，两边各自取值，谁也
不需要认识对方的视口类型。CAD 的 Y 轴同样屏幕向下，不存在翻转。

缩放钳制范围**不统一**：Stage 是 0.1–8（页面画布有确定尺寸），CAD 是 0.02–256（无限图纸要
能看总图也要能看一个端子）。范围由调用方给，不写进共享函数。

## CAD 的网格设置不进文档

页面网格来自 `ComposeCanvasSettings`，它住在 `ComposeDocument` 里。`CadDocument` **不引入**
对应字段：CAD 是无限图纸，不带任何画布设置，网格是会话级视图状态——就像 F7 开关本来就是
会话状态。宿主给默认值，需要持久化时再单独提案。

## 标尺默认开，但这是一处有意偏离 AutoCAD

AutoCAD 没有标尺——无限图纸上钉在视口边缘的标尺不如坐标读数加网格有用。但我们的用户是从
页面编辑器过来的实施工程师而不是 AutoCAD 老手，两个画布行为一致的价值更高。因此默认开启，
并留开关让宿主关掉。

## Stage 必须是零行为变更，黄金图是判据

Stage 的既有需求写得很细：刻度与网格落在同一条 1 CSS px 带、DPR 为 1/2/3 时不跨列模糊、
抽稀不改变实际 snap step。这些用例**一条都不放宽**。

**如果搬完之后黄金图出现像素级漂移，那不是可以更新基线的偏差，那说明搬的不是同一份实现。**
这是本次变更唯一的验收判据，也是分步落地的理由：先搬数学、Stage 全绿，再搬标尺、Stage 全绿，
最后才接 CAD。任何一步红了都能立刻定位到是哪一层搬歪了。
