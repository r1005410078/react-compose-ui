# 曲线几何跟随盒

## Why

**选中一条弧，右下角根本没有手柄。**曲线的 Preset 里写着
`GeometryConstraints: { resize: 'none' }`，注释给的理由是「盒缩放该不该等比缩放几何点要与
端点夹点一起决定，在此之前提供一个语义未定的手势只会产生用户无法预期的结果」——**这一刀就是
那个答案**。

而关掉手柄只挡住了手势那一条路径。把曲线放进 Auto Layout 容器，Yoga 照样给它算出新盒，
画出来的还是原来那条——`GeometryConstraints` 管不到布局求解。

根因是曲线的 SVG **没有 `viewBox`**：几何是绝对用户单位，而 `.compose-material` 是盒的
100%×100%。今天之所以不显眼，是因为盒的**唯一**来源就是几何自己的紧包围盒
（`normalizeComposeCurveGeometry`）——一旦别人（resize 手柄、布局求解）动了盒，两者当场分家。

这条不只是外观错。它挡住了后面三刀：

- **步骤 10（几何编辑）**明说依赖它——「盒与几何的关系要先定下来，否则『拖盒手柄』与
  『拖顶点』各干什么说不清」。
- **步骤 8b（物料统一）**要把 Shape 的圆搬进 `Curve`。而今天的 `shape/circle` 是按
  `rx="50%" ry="50%"` 画的，**天然参与布局**；不先修这条就搬，等于用一个不跟随盒的椭圆
  换掉一个跟随盒的椭圆——**搬一次退一步**。
- 决策 8 的那句「**所有形状都参与 Auto Layout**」就是这一刀。

## What Changes

- **`materials`**：曲线 Preset 去掉 `GeometryConstraints.resize: 'none'`，盒手柄回来。
  曲线 SVG 加 `viewBox`（等于几何的紧包围盒）与 `preserveAspectRatio="none"`，
  盒因此可以独立于几何伸缩。描边加 `vector-effect: non-scaling-stroke`——否则非等比盒会把
  线宽一起拉扯成「横细竖粗」。
- **不变量改写**：从「盒尺寸是几何的派生」改成「**`viewBox` 恒等于几何的紧包围盒，盒自由**」。
  `entity.curve.set` 仍然归一化几何；**是否同时写盒由调用方的意图决定**——新建与绘制写，
  布局求解不写。
- **`core`**：新增盒 → 几何变换与它的逆，作为**唯一**的换算入口；`entity.curve.set` 的载荷
  仍是 parent 局部坐标，命令内部经它映射进几何空间。
- **`stage-engine`**：命中（`entityAtPoint`）与捕捉（`findStageFeaturePoint`）应用同一个变换。
  弧按缩放是否**等比**分流——等比仍走闭式解，非等比拍扁成线段，与 `cad` 侧块内弧的既有判断
  一字不差。
- **`stage`**：DOM 命中路径由浏览器完成 viewBox 变换，因此不需要改；但它与索引路径 MUST 给出
  一致答案，用例按这条断言。

## Non-Goals

- **不删 `shape/`，不动矩形归属，不加椭圆与端点 marker。**那是步骤 8b：词汇搬家。本刀只改
  「盒与几何的关系」，一行不碰物料种类。
- **不做顶点编辑。**双击进几何编辑、拖顶点、盒手柄隐藏是步骤 10。本刀让拖**盒手柄**产生
  正确的视觉结果，仅此而已。

## 为什么这样切

原计划的步骤 8 是「物料统一」一整刀。按那个次序做，中间会**交出一个回归**：`shape/circle`
今天按百分比画、跟着盒走，搬进不带 `viewBox` 的 `Curve` 之后就不跟了。倒过来切没有这个问题
——先让曲线跟随盒，再把形状搬进来，搬进来就已经是对的。

代价是步骤 8 变成两刀。收益是每一刀都有自己那条必然红的断言，且中间态不比现在差。

## Impact

- Specs：`compose-document`（MODIFY 1、ADD 1）、`basic-materials`（ADD 1）、
  `stage-engine`（ADD 1）、`stage`（ADD 1）
- 包：`core`、`materials`、`stage-engine`、`stage`
- 破坏性：`Curve` 协议**不变**，不需要迁移——改的是渲染与命中怎么读它。
