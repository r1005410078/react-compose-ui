# 变更：SVG 导入为可二次编辑的组件

## 原因

今天的 `svg` 物料把一份 SVG 当作**一个不透明 Entity**：整块 markup 净化后内联，对外只有
整份文件级的 `overrideFill` / `fillColor` / `overrideStroke` / `strokeColor`。于是刀闸的
**刀**改不了色、转不了、也接不上线——想动一个部件就得整份重画，而现场实施最贵的一段工作
恰恰是手工绘制元件。

改色、打关键帧、挂端口这三件事在协议里**已经全部具备**：Entity 自己的 `Renderer.props.stroke`
与 `Appearance.backgroundPaint` 是既有 Inspector 字段，`['Transform','rotation']` 是既有轨道
路径，`Transform.pivot` 是**不钳制到 `[0,1]` 的归一化盒坐标**（刀闸的铰点常落在刀身盒外），
`Ports` 能挂在任意 Entity 上。缺的只有「SVG → Entity 树」这一段转换，以及承载贝塞尔的那一种
曲线 kind。

## 变更内容

- 新增 `@compose-ui/svg-import`：无 React、无 DOM 的三层纯函数导入器（解析 → 归一化 → 映射），
  产出**组件导入计划**；Preset seed 与 ID 工厂由调用方注入。包边界与产出计划而不是直接写盘
  这两条逐条照抄 `@compose-ui/dxf`。
- `Curve.kind` 新增 `path`：三次贝塞尔子路径序列加可选 `fillRule`。既有文档**一个字节不改**、
  `schemaVersion` 不变、不需要迁移。
- `core` 新增贝塞尔的拍平、紧包围盒极值与按 `fillRule` 分派的内部判定；命中、框选、捕捉与
  投影沿用既有下游，一行不改。
- `curve` 物料按 `kind` 分派新增 `path`（一个 `<path>`），命中层同形。
- `path` 在几何编辑会话里出**顶点方块与控制手柄**：手柄是小圆加一根连到顶点的杆，默认拖动
  保持另一侧共线等长，`Alt` 断开对称。平滑与尖角 MUST NOT 存成标志位——共线与否从控制点本身
  读得出来。
- `<image>` 映射为图片物料：内嵌 data URI 由计划带出、宿主写成资源文件后回填引用，与「组件
  文件先写、实例后建」是同一条次序。
- 编辑器在资源浏览器 `.svg` 的上下文菜单上提供「导入为组件」：写一份 Component Asset v2，
  并在当前激活场景落一个引用它的实例。

## 影响

- 受影响的规范：新增 `svg-import`；修改 `compose-document`、`basic-materials`、`stage-engine`
- 受影响的代码：新增 `packages/svg-import`；`packages/core/src/curve.ts` 与 `curve-geometry.ts`；
  `packages/materials/src/curve`；`packages/stage-engine/src/geometry-editing`；
  `packages/stage/src/geometry-editing` 覆盖层；`packages/editor/src/svg`
- 不在本变更内、各自单开：容器缩放时子树跟随（`add-subtree-scaling`）、顶点增删
  （`add-vertex-insert-delete`）、镜像与对齐（`add-mirror-and-align`）
- 新增第三方依赖：`fast-xml-parser`（XML 分词）、`svgpath`（路径数学），均为 MIT、零运行时依赖
