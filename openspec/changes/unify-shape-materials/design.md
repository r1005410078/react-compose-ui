# 设计：形状搬进曲线

## 1. 椭圆不新增 `kind`

路线图给 8b 列的「椭圆（两个半径）」是 8a 之前写的，**现在不用做了**。

整圆是 `sweep` 为 ±360 的弧，几何空间里它是正圆；`viewBox` 等于紧包围盒（一个正方形），
盒是宽 200 高 120 时，`preserveAspectRatio="none"` 把它按 200/120 拉成椭圆。命中侧
`projectComposeCurveToBox` 在非等比下已经把弧拍扁成多段线，拍出来的正是同一条椭圆。

这与「整圆是扫掠 ±360 的弧」「矩形是四顶点的闭合多段线」是同一条判断的第三次应用：
**新类型要能带来别的类型带不来的性质**。椭圆带不来——它就是被非等比盒拉过的圆。

推论：`draw-circle` 保持工具名不改。它今天画的就已经是椭圆（`rx="50%" ry="50%"` 在非正方
盒里），改名买不到任何东西，却要动一个公共联合类型。

## 2. 填充复用 `Appearance.backgroundPaint`，不是新的 Renderer prop

判据是 8a 立下的那条：**命中路径要读的字段是文档级契约，只有渲染与 Inspector 读的才走
Renderer props**。填充要参与命中（第 4 节），因此它不能住在 props 里。

选 `Appearance.backgroundPaint` 而不是往 `Curve` Component 里加字段，是因为它已经是「这个
Entity 的填色」的既有事实来源：外观 Inspector、数据绑定、动画的外观轨道**一样都不用做**。
曲线 Preset 的默认外观本来就是透明的，因此**既有曲线的渲染逐像素不变**，黄金图不动。

代价是曲线的外观分组里仍然有 `borderColor` / `borderWidth` / `borderRadius` 三个对它无意义
的字段。这是既有状态，本刀不扩大也不收窄。

### 宿主盒不能再画背景

`composeEntityAppearanceStyle` 今天把纯色写进宿主 `div` 的 `backgroundColor`。曲线照做的话，
用户改填充看到的是**一块矩形色块**，而不是形状内部。因此曲线走一个分支：宿主盒背景恒为
`transparent`，颜色交给 SVG 的 `fill`。

谓词是 `getComposeCurve(entity)`——与紧邻的 `composeEntityOverflowStyle` 那条曲线例外**同一个
谓词**，理由也一样：「这个 Entity 是不是线状的」是几何问题，按 Renderer 类型枚举每加一种物料
都会漏一处。被它替换掉的 `isCircleShapeEntity`（强制 `borderRadius: 50%` 把矩形背景裁成椭圆）
一并删除——那是没有 `viewBox` 时代的补丁。

共享 Paint Layer 同样跳过曲线：它画的是盒形的渐变层，在曲线上只会是一块矩形。v1 因此
**只支持 `solid`**，非纯色 Paint 在曲线上不填充。

## 3. marker 是几何，跟着 `viewBox` 变形

8a 的规则是「几何参与 `viewBox` 变换，描边不参与」。箭头是画在端点上的一小片**形状**，
因此它参与——非等比盒里的箭头会跟着扁，和它所附着的那条线扁的比例相同。

这不是缺陷，是一致：整个图形被拉扁了，箭头没跟着扁才是错的。SVG 也没有
`non-scaling-marker` 这种开关可用，规则保持一句话没有例外，比为它开一个例外更不容易被改坏。

## 4. 填充参与命中，两条路径都要跟上

未填充的图形只有描边可点——「一条对角线的包围盒里绝大部分是空的」这条理由对空心圆同样成立。
**填过色之后那块面积就是用户看见的墨**，与 `cad` 侧「文字按包围盒命中不是破例，因为文字占满
自己的盒子」是同一条判断。

- **DOM 路径**：命中层（透明加宽 stroke）在填充时同时给 `fill: transparent` 与
  `pointer-events: all`；未填充时保持 `pointer-events: stroke`。`<line>` 没有可填充的面积，
  因此不需要为它开分支——浏览器自己给出空集。
- **索引路径**：`entityAtPoint` 在距离判定不中时，若该 Entity 有可见填充，再做一次点在几何
  内的判定。判定同样在**世界空间**用投影后的几何（第 4 节以外的一切都照 8a 不变）。

`core` 因此新增一个内部判定：把曲线拍平成顶点序列（弧走既有的 `flattenComposeArc`），
按奇偶规则做射线法。**开放几何按 SVG 的隐式闭合处理**——`<polyline fill>` 本来就是这么画的，
渲染与命中因此自动一致，不需要「是否 `closed`」这个前置判断。

## 5. 绘制提交写真实几何

`direction ∈ {-1,0,1}²` 是 Shape 用盒表达方向的编码。曲线不需要它：拖出来的两个世界点换算
进父级局部坐标就是 `Curve.start` / `Curve.end`。

因此 `entityFromDrawingSeed` 的 `direction` 参数换成 `curve`，`directionAxis`、
`shapeDirection`、`localLineEndpoint`、`rotatePoint` 与 `transformDocument` 的 `directions`
形参一起删除。轴对齐（拖成水平）时退化轴由 8a 既有的 `COMPOSE_CURVE_MIN_EXTENT` 钳住，
不需要 Shape 那个「零轴按 0.5px 偏移」的补丁。

`draw-circle` 写的是圆心与半径的整圆；Shift 约束成正方盒的既有逻辑不变，因此按住 Shift
拖出来的就是正圆。

## 6. 端点选区 UI 与它整条手势链一起删除

删除清单：`stage-engine` 的 `segment-resize` 插件、`segment.commit` 效果、`StageSegmentPreview`、
`segment-endpoint` 命中类型、`segment-resize` 手势阶段与它在优先级表里的那一行、
`text-edit-guard-plugin` 里的对应分支；`stage` 的 `lineSelection` 覆盖层、
`lineSegmentForEntity`、`lineSegmentTransform` 与 `commitSegment`。

理由见提案。这里只记一条实现事实：这条链的输入类型是 `{ start, end }` 两个点，
步骤 10 要做的是 N 个顶点加中点插入，**接口本来就要重写**，因此删除不是浪费。

## 7. 公共导出名不变

`DEFAULT_COMPOSE_ARROW_PRESET` 与 `DEFAULT_COMPOSE_CIRCLE_PRESET` 保留原名，Preset id 仍是
`arrow` 与 `circle`——宿主与 `presetForDrawingTool` 因此一行不改，换掉的只是它们的实现。
删除的是真正没有对应物的那几个：`createShapeMaterial`、`DEFAULT_COMPOSE_SHAPE_RENDERER`、
`DEFAULT_COMPOSE_LINE_PRESET`（`draw-line` 工具已经在步骤 6 删除，这个 Preset 没有入口）
与 `ComposeShapeMaterialOptions`。
