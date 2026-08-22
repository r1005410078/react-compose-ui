# 曲线 Entity：页面世界的第一个 CAD 词汇

## Why

统一路线（Figma 的身份模型 + AutoCAD 的手感）的第一刀。产品结论已经对齐：**CAD 借的是
画法，对象世界归页面**——刀闸要能进场景树、有属性面板、打关键帧、被脚本控制，而这些能力
全部长在「页面 Entity」这个身份上，不长在任何面板里。因此第一步不是做绘图模式，而是让
「一条线」成为合法的页面 Entity。

这一刀结束时：线出现在场景树里、属性面板里，能点选（按**点到线段的距离**而不是包围盒）、
能移动、能撤销、能在预览里渲染、能打位置与旋转关键帧——旋转关键帧正是刀闸分/合要的原语。
整个统一论题用最小代价验证：如果曲线在这条路上接不顺，损失止于一刀。

**读代码修正了口头方案：不需要 v8，不需要去掉 `LayoutItem`。** 位置的事实来源本来就在
`LayoutItem.offset`——动画位置轨道的路径就是 `['LayoutItem','offset']`，move 插件写的也是
它，`Transform` 只有 `rotation`。去掉盒等于把移动、动画、场景树、布局每条既有轨道都 fork
一遍，那才是「第二份实现」。Figma 的 vector node 也是这个模型：**盒 + 盒内几何**。

## What Changes

### core：可选 `Curve` 内建 Component

`kind: 'line'` 起步（union 为弧/多段线留位），几何点是**盒局部坐标**。组合规则：Curve 必须
与 Renderer 组合、不得与 Hierarchy 组合（曲线不是容器）。协议 `schemaVersion` **不变**：
实测校验器不拒绝 Entity 上的未知 Component key（`Animation` 就是既有先例），曲线 Entity 的
五个必备 Component 一个不少，它本来就是一个合法的 v7 Entity。

### core：几何写入漏斗

端点编辑更新 `Curve` 并**重算紧包围盒**（`LayoutItem` 尺寸校验要求正数，退化轴——水平线的
高——钳到 1；几何不受影响，因为渲染与命中都读几何而不读盒），一条命令一个事务。量化走
`roundComposeGeometry`，与 `toComposeTransform` 同一条规矩。

### stage-engine：距离窄相位命中

盒仍是宽相位（框选候选、裁剪判定不变）。带 `Curve` 的 Entity 点选改为**点到线段的距离**加
屏幕容差：`entityAtPoint` 的 `contains` 已经把点换算进 Entity 局部坐标，窄相位在那里追加一个
距离判定即可——因此旋转后的线命中自动正确。容差是屏幕像素除以 zoom，非 100% 缩放必测。

### materials：`curve` 物料

Preset、SVG Renderer（`overflow: visible`，几何可以贴着退化盒的边画）、Component Definition
（端点编辑 + 描边 props）。**描边住在 Renderer props**（颜色、线宽、线型），与 `shape` 物料
同一条轨道——Inspector、绑定、未来的 `FLOW` 外观轨道全是既有机制。`shape` 物料**不动**：
它是「盒 + 方向」语义，服务设计场景；曲线是「坐标」语义，两者不是同一个东西。

### stage / editor：点击添加

工具栏新增「线」，点击添加一条默认斜线，落进激活场景。点击添加没有落点意图，不走升格，
与既有根层分流规则一致。

## Impact

- `@compose-ui/core`：`Curve` Component、校验、写入漏斗命令。协议版本不变，既有文档不受影响。
- `@compose-ui/stage-engine`：`entityAtPoint` 窄相位。
- `@compose-ui/materials`：`curve` 物料。
- `@compose-ui/stage` / `@compose-ui/editor`：工具栏项与点击添加。
- 场景树、动画、预览、撤销**零改动**——曲线是普通 Entity，这正是本刀要证明的。

## 本步刻意不做

- **弧、多段线、文字**：`kind` union 已留位，逐刀扩展，与 CAD 线的节奏相同。
- **绘图模式**（命令行、捕捉、正交、十字线）：下一刀。本刀的创建路径只有点击添加。
- **CAD 框选语义**（左窗口右交叉、点选累加）：属于绘图模式。页面模式的框选仍按盒，不改变
  已有手感。
- **盒的 resize 手势**：v1 曲线的 `GeometryConstraints` 设为不可 resize。盒缩放该不该等比
  缩放几何点，要等端点夹点（绘图模式）一起答，现在答会答错。
- **端点几何关键帧**：位置与旋转轨道当天可用；端点轨道等组件片段那一刀。
- **端口、导线、DXF、删除 `cad`/`cad-canvas` 包**：路线后段。CAD 标签页在迁移完成前保持可用。
