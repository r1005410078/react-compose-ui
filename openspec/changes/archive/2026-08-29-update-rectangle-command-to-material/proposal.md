# 变更：RECTANGLE 产出矩形物料

## 原因

`RECTANGLE` 今天产出一条闭合四顶点的 `Curve` 折线。而搭大屏时画的矩形绝大多数是外框与底板——
下一步要填色、调圆角、往里塞东西，这些 `Curve` 全都做不到（只画 `solid`、没有 bulge 因此没有
圆角、没有内容盒）。

同时，删 `draw-rectangle` 工具值时的判据「制图几何一律由命令产出」本身没错，但它顺手把**矩形
物料的拖拽入口**也带走了：Rectangle Preset 今天只能从物料面板点击添加，没有任何按尺寸画出来
的办法。

SDD 3.2 已确认（方案 B）：`R` 产出矩形物料。

## 变更内容

- **BREAKING**（对 `StageDraftingEffect` 的消费者）：新增 `boxes` 效果字段；`RECTANGLE` 的
  预览与提交都改用它，不再产出 `curves`。
- 宿主按 `boxes` 用 Registry 的 `rectangle` Preset 落地 Entity，复用既有的
  `entityFromDrawingSeed` / `boundsInParentSpace`，不另写一份「盒 → Entity」。
- 绘图覆盖层的预览轮廓认识 `boxes`。

## 影响

- 受影响的规范：`stage-engine`、`stage`
- 受影响的代码：
  - `packages/stage-engine/src/drafting/drafting-types.ts`
  - `packages/stage-engine/src/drafting/shape-commands.ts`
  - `packages/stage/src/drafting/drafting-entity.ts`
  - `packages/stage/src/drafting/use-stage-drafting.ts`
