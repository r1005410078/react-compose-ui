# 任务：SVG 导入为可二次编辑的组件

## 1. core：贝塞尔进 `Curve`

- [x] 1.1 `curve-geometry.ts` 新增三次贝塞尔的求值、极值点（一元二次求根）与自适应拍平，
      与 `flattenComposeArc` 同族同签名；单测覆盖 S 形段的紧包围盒不等于控制点凸包
- [x] 1.2 `curve.ts` 新增 `ComposeCubicSegment` / `ComposeSubpath` / `ComposePathCurve` 类型与
      校验（段必须是三次贝塞尔、子路径非空、点为有限数、`fillRule` 只接受 `evenodd`）
- [x] 1.3 `path` 接进既有的 10 个 kind 分派点：`composeCurvePoints`、`isComposeClosedCurve`
      （全部子路径闭合即为真）、`composeCurveBounds`、`translateComposeCurve`、
      `normalizeComposeCurveGeometry`、`composeCurveViewBox`、`projectComposeCurveToBox`
      （精确仿射，无等比分流）、`distanceToComposeCurve`、`composeCurveSegments`、
      `isPointInsideComposeCurve`
- [x] 1.4 `isPointInsideComposeCurve` 改为按 `fillRule` 分派（缺席即非零绕数）；用例钉住既有
      `polyline` / `arc` 的判定结果逐点不变
- [x] 1.5 `validateComposeDocument` 对 `path` 给出稳定机器码；既有文档校验结果逐字不变的用例

## 2. materials：渲染 `path`

- [x] 2.1 curve renderer 新增 `path` 分支：一个 `<path>`，全部子路径写进同一个 `d`，闭合子
      路径以 `Z` 收尾；`fill-rule` 由 `fillRule` 推出，缺席不写属性
- [x] 2.2 命中层同形加宽 `<path>`，`stroke-linecap` 仍为 `butt`
- [x] 2.3 Inspector 对 `path` 不呈现逐点几何字段，描边与填充分组照常

## 3. stage-engine / stage：`path` 的顶点与控制手柄

- [x] 3.1 夹点派生对 `path` 产出顶点方块，两侧控制点走既有切线通道；id 是顶点 id 加侧别后缀
- [x] 3.2 求解：拖顶点平移该点两侧控制点；拖控制点默认保持另一侧共线等长，`Alt` 只动被拖的
      那个；不存平滑/尖角标志位
- [x] 3.3 控制点复用可编辑路径既有的手柄与连杆呈现，会话期间全部画出（覆盖层零改动）。
      **只画作用中那一个的做法被实现推翻**：点亮会吃掉按向手柄的那一下，手柄因此永远按不到
- [x] 3.4 写入走 `entity.curve.set`，撤销一步回到原几何
- [x] 3.5 非 100% 缩放下 `path` 的点选与框选走几何的用例（空角不命中）

## 4. 新包 `@compose-ui/svg-import`

- [x] 4.1 建包：无 React、无 DOM，只依赖 `core`；引入 `fast-xml-parser` 与 `svgpath`；
      架构边界用例确认它们不出现在公共 API 类型里
- [x] 4.2 解析层：XML → 元素树；剥掉 `<script>` / `<foreignObject>` / 事件属性 / SMIL /
      外部 `href` 并计入诊断
- [x] 4.3 归一化层（样式）：`<style>` 的 `tag` / `.class` / `#id` 与逗号组求值，叠加呈现属性、
      继承与内联 `style`；不支持的选择器诊断跳过；CSS 命名色表
- [x] 4.4 归一化层（变换）：祖先链矩阵合成，`svgpath.abs().unshort().matrix()` 烘进路径数据，
      含曲率时再 `unarc()` 展开成三次贝塞尔；`stroke-width` 取两轴几何平均。
      **纯旋转未分解进 `Transform.rotation`**（规范里是 MAY）：v1 连旋转一起烘死，形状永远
      正确，代价是导入那一刻的旋转不再是活属性
- [x] 4.5 映射层（几何）：按最窄 kind 产出 `Curve`——`rect`（含 `rx` → `cornerRadius`）、
      等比下的 `circle` → 360° 弧、`ellipse` 与非等比下的圆 → `path` 的**精确贝塞尔**
      （不是拍扁的多段线：`path` 落地之后「非等比就拍扁」那条规则的前提不再成立）、
      `line`/`polyline`/`polygon`、`path`（含子路径与 `fillRule`）
- [x] 4.6 映射层（结构）：`<svg>` → 根 Frame（尺寸取 `viewBox`）、`<g>` → first-class Group、
      `<use>` 就地展开、`<defs>` / `<symbol>` / `<title>` / `<desc>` 不产出 Entity、
      `id` → Entity 名称
- [x] 4.7 映射层（外观）：`fill` → `Appearance.backgroundPaint`、`stroke` 系列 → Renderer
      props、渐变降级成中位色标纯色并诊断、`stroke-dasharray` 取最接近档位并诊断
- [x] 4.8 映射层（图片）：`<image>` 的 data URI 带出成待写资源；尺寸取位图或 `width`/`height`，
      都取不到则跳过并诊断；外链 `href` 已在解析层丢弃
- [x] 4.9 映射层（文字）：`<text>` → 文字物料，Hug 盒，锚点按估算比例换算成盒左上角，
      `text-anchor` → 三种对齐，`<tspan>` 定位诊断
- [x] 4.10 属性级降级：`filter` / `mask` / `clip-path` / `pattern` 忽略但保留几何并诊断
- [x] 4.11 诊断按 `{ subject, count }` 聚合；导入计划类型与公共入口 TSDoc

## 5. 编辑器接线

- [x] 5.1 `packages/editor/src/svg/import-svg-as-component.ts`：写待写资源 → 回填图片引用 →
      写组件文件；失败不回滚已写文件。**不在这里实例化**——导入之后要做的是改这个符号（组件
      文档里做），摆到图上是另一件事，组件库的拖放入口已经做了
- [x] 5.2 `.svg` 上下文菜单项「导入为组件」，只在 `.svg` 上可见；导入后打开组件文档；
      诊断压成一行提示
- [x] 5.3 i18n 文案

## 6. 验收

- [x] 6.1 端到端：导入一份刀闸 SVG → 场景树里选中刀身 → 改描边色 → 只有刀变色
- [x] 6.2 端到端：给刀身打 `Transform.rotation` 关键帧、`pivot` 设在铰点 → 播放时绕铰点摆动
- [x] 6.3 端到端：给组件根挂 `Ports`、用 `LINE` 接上 → 移动符号导线端点跟随

> 6.2 与 6.3 验的是**别的能力在导入产物上仍然成立**，导入这条链上没有为它们新增任何分支——
> 而「导入产物与手画的走完全相同的编辑路径」正是这次变更的主张，因此它们与 6.1 一起承担它。
> 两条都与既有用例配对：6.2 对 `rotation-pivot.spec.ts`（那一条画一条线），6.3 对
> `symbol-wires.spec.ts`（那一条给手画的矩形挂端口），同一句断言换一个起点。
>
> 6.2 的判别性在**转 180°**：绕盒中心转 180° 把盒映射回它自己（线在屏幕上逐像素不变、位置也
> 不变），绕铰点转则把盒整个搬到铰点另一侧，因此一条等式同时挡掉「没转」与「绕中心转」。
> 6.3 的判别性在**两端各断一次**：只断绑定端跟随的用例，在一个把整条线一起平移的实现上同样
> 会绿。

- [x] 6.4 导入一份含滤镜与渐变的设计稿型 SVG → 元素齐全、提示列出诊断
- [x] 6.5 端到端：对导入来的 `path` 走 `VERTEX` → 拖一个控制手柄 → 对侧共线等长，`Alt` 断开
- [x] 6.6 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
