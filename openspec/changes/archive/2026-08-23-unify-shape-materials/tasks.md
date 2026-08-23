# Tasks

## 1. 判别性用例先验红

- [x] 1.1 `e2e/curve-vocabulary.spec.ts` 加一条：用工具栏 **arrow** 工具从右下向左上拖出一个
      箭头 → 断言画出来的是曲线物料（`compose-material-curve-*`）且带箭头 marker。
      **先跑确认红**——今天这个工具产出的是 `compose-material-shape-arrow`
- [x] 1.2 同一条继续：切 **circle** 工具拖一个椭圆 → 在外观里设一个不透明纯色 →
      断言 SVG 几何元素以该色填充，且宿主盒的 computed 背景是透明的。今天填色画在宿主盒上
- [x] 1.3 再点一次填充区域内部（远离描边）断言选中；把填充改回透明后同一位置不选中
- [x] 1.4 全部在**非 100% 缩放**下取坐标（`?no-auto-fit`），理由同 8a

## 2. `core`：点在几何内部

- [x] 2.1 新增点在曲线内部的判定：拍平成顶点序列后按奇偶规则射线法；弧复用
      `flattenComposeArc`，MUST NOT 另写一份弧数学
- [x] 2.2 不检查 `closed`——开放几何按隐式闭合，与 SVG 填充规则一致
- [x] 2.3 `line` 恒为假（没有可填充的面积）
- [x] 2.4 单测：闭合多段线内外、整圆圆心、开放三顶点的隐式闭合、直线恒假

## 3. `materials`：曲线补上填充与 marker

- [x] 3.1 Renderer 从 `resolveComposeAppearance` 读 `backgroundPaint`，`solid` 时写进几何
      元素的 `fill`，其余 kind 不填充
- [x] 3.2 命中层在有填充时 `fill: transparent` + `pointer-events: all`，否则保持
      `pointer-events: stroke`
- [x] 3.3 `markerStart` / `markerEnd` props（`none` / `arrow`）与 marker `<defs>`；
      marker **不加** `vector-effect`——它是几何，跟着 `viewBox` 变形
- [x] 3.4 Inspector 增加起点/终点箭头两个字段，复用 Shape 侧既有的 picklist
- [x] 3.5 组件测试：填充跟随几何、默认不填充（既有曲线逐像素不变）、箭头附在终点

## 4. `component-registry`：宿主盒不再为曲线画背景

- [x] 4.1 `composeEntityAppearanceStyle` 对带 `Curve` 的 Entity 输出透明背景；
      谓词与紧邻的 overflow 例外**同一个**，不按 Renderer 类型枚举
- [x] 4.2 删除 `isCircleShapeEntity`（强制 `borderRadius: 50%`）——那是没有 `viewBox` 时代的
      补丁
- [x] 4.3 共享 Paint Layer 跳过曲线：它画的是盒形层，在曲线上只会是一块矩形

## 5. `stage-engine`：填充参与命中

- [x] 5.1 `entityAtPoint` 的曲线分支在距离不中且有可见填充时，再做一次内部判定；
      读 `Appearance` 而不是 Renderer props
- [x] 5.2 单测：同一条闭合多段线，填充与不填充在同一位置给出相反结论

## 6. 换掉 Preset 实现（此时能力已齐，换过去不产生回归）

- [x] 6.1 `arrow` 与 `circle` Preset 改由 `curve` 物料产出，**id 与公共导出名不变**
- [x] 6.2 绘制提交写真实几何：`entityFromDrawingSeed` 的 `direction` 参数换成 `curve`；
      直线写两个端点，整圆写圆心与半径
- [x] 6.3 `presetForDrawingTool` 删掉没有工具的 `draw-line` 死条目

## 7. 删除 `shape/` 与它的六处特判

- [x] 7.1 删除 `packages/materials/src/shape/` 整个目录、`createShapeMaterial`、
      `DEFAULT_COMPOSE_SHAPE_RENDERER`、`DEFAULT_COMPOSE_LINE_PRESET` 与
      `ComposeShapeMaterialOptions`
- [x] 7.2 场景层线状判定去掉 `renderer?.type === 'shape'` 分支，只剩 `Curve` 判定
- [x] 7.3 预览烘焙删掉 `directions` 形参与 `ShapeDirection`、`directionAxis`、
      `shapeDirection`、`localLineEndpoint`、`rotatePoint`
- [x] 7.4 删掉 `lineSegmentForEntity`、`lineSegmentTransform` 与 `commitSegment`
- [x] 7.5 `stage-engine` 删掉 `segment-resize` 插件、`segment.commit` 效果、
      `StageSegmentPreview`、`segment-endpoint` 命中类型、`segment-resize` 手势阶段与它在
      优先级表里的那一行，以及 `text-edit-guard-plugin` 的对应分支
- [x] 7.6 `stage` 删掉 `lineSelection` 覆盖层与三处消费它的图层分支
- [x] 7.7 `materials` 的 Inspector kit 删掉 Shape 专用 schema 与 inspector

## 8. 回归

- [x] 8.1 改写 `e2e/stage-interactions.spec.ts` 两条 Shape 用例（240 与 312 附近）
- [x] 8.2 `bun run lint` / `typecheck` / `test` / `build` 全绿
- [x] 8.3 `bun run test:e2e` 全绿，跑**两轮**且事先确认没有残留的 preview/test-server 进程
- [x] 8.4 黄金图：默认曲线不填充，既有曲线渲染逐像素不变；箭头与圆的黄金图按新物料更新
- [x] 8.5 `AGENTS.md` 更新曲线段落（填充复用 Appearance、marker 是几何、命中含填充），
      路线图回填 8b 实测与「端点 UI 删除不搬」这条反转
