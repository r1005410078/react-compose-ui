# 变更：`RECTANGLE` 产出闭合多段线而不是矩形物料

## 原因

**画完的矩形双击进不了顶点编辑**，而这不是缺陷，是当初那条决定的直接后果：`RECTANGLE`
产出的是**矩形物料**（带 `Appearance` 的盒），身上没有 `Curve`，而几何编辑的准入谓词读的
正是 `getComposeCurve(entity)`。

当初的判据是「用户画完之后想对它做什么」，答案取的是「填色、调圆角、往里塞东西」。这个
答案对**大屏底板**成立，对**接线图**不成立——这个产品的用户画矩形是在画设备外框、柜体轮廓
与分区框，画完之后想做的是**改形状**：把某个角对到某根导线的端点上、把某条边整体挪一格。
而这三件事 `Curve` 全都做得到，盒一件也做不到。

代价还不对称：盒填了色，画在别的东西上面就把它盖住了；而外框在接线图上恰恰是套在符号外面的。

## 变更内容

### 修改

- `RECTANGLE` 的预览与提交都改为产出 `{ kind: 'polyline', vertices: 四个角, closed: true }`，
  落地走 `curve` Preset。默认外观因此是 `transparent`——**不填充**这件事不需要额外改动，
  它是 `DEFAULT_CURVE_APPEARANCE` 本来的取值。
- 两个对角点在任一轴上重合时仍以 `rejected` 拦下，会话不结束。

### 删除

- `StageDraftingEffect.boxes`：`RECTANGLE` 是它唯一的产出者，改完之后没有任何命令再产出盒。
- Stage 侧的盒落地实现（`createStageDraftingBoxCommand`）与预览覆盖层里那段「盒的四个角
  闭合回起点」的换算——曲线自己就是闭合折线。

`entityFromDrawingSeed` 与 `boundsInParentSpace` **保留**：拖拽绘制容器与文字还在用它们。

## 非目标

- **不做 `EXPLODE`。**盒下钻到自由几何仍然需要一条显式命令，本变更不提供，也不把双击
  改造成那条通道。
- **不删 `rectangle` Preset。**需要背景、边框、圆角与子级时，从物料面板添加 Rectangle 的
  那条入口一个字节不动。
- **不动圆角。**多段线顶点仍然没有任何圆角/bulge 字段，圆角是紧随其后的一份独立变更。

## 影响

- 受影响的规范：`stage`、`stage-engine`
- 受影响的代码：
  - `packages/stage-engine/src/drafting/shape-commands.ts`（矩形会话）
  - `packages/stage-engine/src/drafting/drafting-types.ts`（删 `boxes`）
  - `packages/stage/src/drafting/drafting-entity.ts`（删盒落地命令）
  - `packages/stage/src/drafting/use-stage-drafting.ts`（删盒落地循环与预览换算）
  - `e2e/rectangle-material.spec.ts`（重写为曲线与顶点模式）
- **既有文档不受影响**：本变更不碰协议，已经画出来的矩形物料仍然合法、仍然照常渲染。
