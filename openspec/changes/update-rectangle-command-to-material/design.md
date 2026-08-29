## 上下文

`StageDraftingEffect` 今天只有 `curves` 一种「新建几何」的表示，宿主用它走
`createStageDraftingCurveCommand`（Preset `curve` / `arrow`）。拖拽绘制那条路另有一套
`entityFromDrawingSeed`（Preset `container` / `text`），输入是一个 `StageRect`。

## 目标/非目标

- 目标：`R` 画出来的是带完整 `Appearance` 的矩形物料。
- 非目标：`EXPLODE`（盒 → 折线的显式转换，SDD 3.3，待确认）、`Shift` 约束正方形
  （需要命令看见修饰键，是另一条协议改动）。

## 决策

**决策：新增 `boxes` 效果字段，而不是让 `RECTANGLE` 继续产出 `curves` 再由宿主识别。**
按 kind 识别（「闭合的四顶点折线就当矩形物料」）会把一条**表示**当成**意图**：`PLINE` 画四个
点按 `C` 也会得到闭合四顶点折线，而那时用户要的确实是折线。意图必须由命令显式说出。

**决策：`boxes` 只是世界坐标的矩形，引擎不认识 Preset id。**
与 `wire` / `arrow` 两个标记是同一条既有边界——引擎说「这一步产出一个这么大的盒」，挑哪个
物料由持有 Registry 的宿主决定。

**决策：预览与提交都用 `boxes`。**
让预览回折线、提交回盒会产生一处只有实现者知道的不对称，覆盖层还要为它多认一种形状。

**决策：宿主复用 `entityFromDrawingSeed` 与 `boundsInParentSpace`。**
它们已经是「一个盒 + 一个 Preset → 一个 Entity」的唯一实现（拖拽绘制容器与文字走的就是
它）。另写一份的症状是「命令画的矩形与拖出来的容器在 `positioning`、最小尺寸或 Hug 处理上
差一点」，而那种差别要等到有人对比两者时才会发现。

**决策：落点父级与曲线完全一致**——盒中心所在的容器，不在任何容器里时落进激活场景。
Rectangle Preset 没有 `Hierarchy`，因此按「根层落点按类型分流」它不升格成新场景。

## 风险/权衡

- **旧文档不迁移**：此前用 `RECTANGLE` 画出来的闭合折线仍然是折线，照旧可选、可编辑几何。
  这是对的——它们就是当时画出来的东西，改写它们等于替用户改文档。
- **`boxes` 是新字段，既有效果消费者不受影响**：字段可选，不实现就没有盒可落地。

## 迁移计划

无数据迁移。宿主如果自己消费 `StageDraftingEffect`（当前只有 Stage 一处），需要处理新字段，
否则 `RECTANGLE` 会变成「取完两点什么都没发生」。

## 待解决问题

- `Shift` 约束正方形：命令看不见修饰键。留给动态输入那一刀一起解决。
