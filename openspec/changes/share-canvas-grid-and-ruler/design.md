# 设计

## 为什么是「下沉」而不是「CAD 依赖 Stage」

`cad-canvas` 不得依赖 `stage` 与 `stage-engine`，这条边界是对的：Stage 的命中单位是矩形，
CAD 的直线没有盒模型，两者不是同一件事。但**点阵数学与标尺画笔跟这条差异毫无关系**——它们
只吃 `step / offset / viewportOffset / zoom / minScreenSpacing` 一串数字。

判据是「它认识文档吗」。点阵不认识，所以它待在 `stage-engine` 只是历史位置而不是边界要求。

## 分两层落地，两层互不依赖

- **数学进 `core`**：无 React、无 DOM，`stage-engine` 与 `cad-canvas` 都已经依赖它。
- **画笔与外壳进 `components`**：刻度类型在 `components` 里**自己声明一份**
  `{ value, screen, major, label? }`，不从 `core` 导入。结构类型让 `core` 算出的刻度直接
  可赋值，而画的人不需要认识算的人——标尺该能画任何来源的刻度。

## 视口形状的差异是三行适配

`StageViewport` 是 `{ x, y, zoom }`，`CadViewport` 是 `{ offset: {x,y}, zoom }`，同样的信息
换了个壳。下沉后的入参只收 `viewportOffset: number` 与 `zoom: number`，两边各自取值，谁也
不需要认识对方的视口类型。CAD 的 Y 轴同样是屏幕向下，不存在翻转。

## CAD 的网格设置不进文档

页面网格来自 `ComposeCanvasSettings`，它住在 `ComposeDocument` 里。CAD 文档**不引入**对应
字段：`CadDocument` 是无限图纸，不带任何画布设置，网格是会话级视图状态（就像 F7 开关本来
就是会话状态）。宿主给默认值，需要持久化时再单独提案。

## 标尺是可选的，默认开

AutoCAD 没有标尺——无限图纸上钉在视口边缘的标尺不如坐标读数加网格有用。但我们的用户是从
页面编辑器过来的实施工程师而不是 AutoCAD 老手，两个画布行为一致的价值更高。因此默认开启，
并留一个开关让宿主关掉。

## Stage 必须是零行为变更

Stage 的既有需求写得很细（刻度与网格落在同一条 1 CSS px 带、DPR 1/2/3 下不跨列模糊、抽稀
不改变实际 snap step）。这些用例**一个都不放宽**：如果搬家之后它们仍然全绿，就证明搬的是
同一份实现而不是重写了一份像的。
