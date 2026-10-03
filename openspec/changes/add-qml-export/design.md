## 上下文

`ComposeDocument v7` 是 ECS 文档：几何来自 `LayoutItem` 与 Yoga 求解，外观来自 `Appearance`，
内容来自 `Renderer`，曲线几何来自 `Curve`。Preview 渲染的是「已解算文档 + 布局快照」这一对。
目标运行时是 Qt 6.8 的 Qt Quick（`QtQuick`、`QtQuick.Shapes`）。

## 目标 / 非目标

- 目标：静态场景在 Qt 中与 Preview 像素级接近（在 `qt-runtime` 声明的容差内）；输出可读、确定。
- 非目标：脚本与绑定（`add-qml-page-script`）、动画、页面跳转、图表 / 图片 / SVG 物料、阴影、
  渐变的精确还原、导出后 Qt 侧的响应式布局、QML → 文档的反向导入。

## 决策

### 输入与包边界

```ts
exportComposeSceneToQml(input: {
  document: ComposeDocument          // 已解算的那份
  snapshot: ComposeLayoutSnapshot    // 与之成对的快照
  frameId: string                    // 导出哪一块场景
}): { qml: string; diagnostics: ComposeQmlExportDiagnostic[]; fontFamilies: string[] }
```

- 包只依赖 `core`。布局求解不在包内做：求解需要文字测量端口，而测量只有浏览器给得出来——
  在纯 Node 里求解，Hug 文字的盒子会与 Preview 不同。因此由编辑器求解、导出器只消费结果。
- 非法输入（场景不是根 Frame、快照里没有它）抛 `ComposeQmlExportError`；其余一律降级并给诊断。
- **组件实例第一期是占位**。最初设想由宿主把每个实例的嵌套解算结果传进来（`instances` 字段），
  落地时发现宿主拿不出这份数据：实例在预览里要经过覆盖、动画采样、根尺寸对齐、内容缩放与翻转，
  再跑一次嵌套 Yoga，整条管线在 `materials` 内部。为导出复制一份就是两处实现；先把它提取成可复用
  入口是另一个变更。

### 映射

| 文档           | QML                                       | 说明                                                                                 |
| -------------- | ----------------------------------------- | ------------------------------------------------------------------------------------ |
| 场景 Frame     | 根 `Item`，`width/height` 取 `Frame.size` | 导出单位就是一块场景，与预览 / 导出单位一致                                          |
| 容器 / 盒物料  | `Rectangle` + 边框覆盖层                  | `color`、`radius`、`opacity`；边框见下；`Clip` 存在且裁剪 → `clip: true`             |
| Group          | `Item`                                    | 只承载层级，不画任何东西                                                             |
| `Curve`        | `Shape` + `ShapePath`                     | 见下                                                                                 |
| 文字           | `Text`                                    | 见下                                                                                 |
| 组件实例       | 同尺寸占位 + 诊断                         | 内联展开另起变更（见上）                                                             |
| WidgetSwitcher | 只导出活动子项                            | 与 Preview 的规则一致                                                                |

层序照搬预览：底色 → Renderer 内容 → 子级（`resolveComposeRenderedChildIds`）→ **边框覆盖层**。
QML 后声明者在上，与 DOM 一致，不写 `z`。预览的边框是压在子级之上的独立一层，而 Qt `Rectangle`
自己的 `border` 画在子级下面——写成同一个 `Rectangle` 会让贴边的子级盖住边框。叶子在预览里恒为
`overflow: hidden`，因此非曲线的叶子写 `clip: true`。

### 曲线

- 几何按预览同一个 `viewBox` → 盒的逐轴仿射映射到盒坐标再写进 `ShapePath`。**不走
  `projectComposeCurveToBox`**（这是对最初设想的修正）：它在非等比时把弧拍扁成折线，那是命中与
  捕捉的近似；预览画的是被 `viewBox` 拉扁的真椭圆弧。照搬仿射之后弧映射成 `radiusX`/`radiusY`
  各自缩放的 `PathArc`，与 SVG 一致。
- 因为坐标已在盒空间，描边不再被缩放——这正好等价于 Preview 的 `non-scaling-stroke`。
- 线帽、斜接要**显式写出 SVG 的缺省值**（`FlatCap`、`MiterJoin`、`miterLimit: 4`）：Qt 的缺省是
  方头、斜切、上限 2。线宽 0 写成透明描边：Qt 的线宽 0 是一像素的 cosmetic 线。
- `line` / `polyline` → `PathLine` 序列（`PathPolyline` 在 6.8 可用但逐段写更易读，二选一在实现时
  按输出体积定）；带 `cornerRadius` 的走 `composePolylineOutline` 得到直段与角弧，弧段 → `PathArc`。
- 整圆 → 两段半圆 `PathArc`（与 SVG 一样，起终点重合的单段弧画不出来）。
- `path` → `PathMove` + `PathCubic`；`fillRule: 'evenodd'` → `ShapePath.OddEvenFill`，缺席 →
  `WindingFill`。
- 填充读 `getComposeCurveFill`；空心 → `fillColor: "transparent"`。
- 虚线：**Qt 的 `dashPattern` 以线宽为单位**，SVG 是绝对长度；预览的图案本身就是线宽的倍数
  （`8 4` → 4w 2w、`1 4` → 0 2w 配圆头），换算之后是与线宽无关的常数 `[4, 2]` / `[0, 2]`；
  `strokeDashoffset` 除以线宽。
- 端点箭头：Qt 没有 marker，按预览 marker 的定义（`viewBox 0 0 6 6`、参考点 `(5,3)`、
  `markerUnits=strokeWidth`、`auto-start-reverse`）在几何空间求出三角形再映射，作为额外一条
  填充 `ShapePath`。
- `Shape.preferredRendererType: Shape.CurveRenderer`，保证细线抗锯齿。

### 文字

- `font.pixelSize`（**不用 pointSize**，后者随 DPI 变）、`font.family`、`font.weight`（数值直传，
  关键字映射到 Qt 的 100–900）、`font.letterSpacing`。
- `lineHeight` 缺席 → 引擎默认行高；有值（px）→ `lineHeightMode: Text.FixedHeight`，并**按垂直对齐
  补偿半行距**。CSS 把多出来的行距 L 上下各分一半，每一行都是；Qt 的 `FixedHeight` 把字贴在行顶，
  且**最后一行不带多出的行距**，整块因此比 CSS 矮 L。三种对齐的补偿因此不同：

  | 对齐 | Qt 相对预览 | 补偿（`Text.y`） |
  | --- | --- | --- |
  | 顶 | 字高 `floor(L/2)` | 下移 `floor(L/2)` |
  | 居中 | 块矮 L、居中后下沉 L/2，正好抵消 | 不补 |
  | 底 | 字低 `ceil(L/2)` | 上移 `ceil(L/2)` |

  L 照搬 Blink 的取整：`lineHeight − round(ascent) − round(descent)`。用 `y` 而不是 `topPadding`：
  后者参与垂直居中的计算。实测记录：最初设想的「一律 `topPadding: (lh − FontMetrics.height)/2`」
  在 28px 上碰巧对（1.017% → 0.247%），换成 16px 段落每行低 1px、居中与底对齐低 3–4px；按上表并
  照搬取整之后 28px 降到 0.028%，三种对齐的墨迹位置与预览一致。
- 盒子写死为快照里的宽高；换行一律 `Text.WrapAtWordBoundaryOrAnywhere`，照搬预览的
  `white-space: pre-wrap` + `overflow-wrap: anywhere`（先在词边界，放不下才任意字符）。Hug 文字的
  盒正好装得下它，因此不会被断开——不需要为 Hug 另写 `NoWrap`。`textFormat: Text.PlainText`。
- `textAlign` → `horizontalAlignment`（含 `Justify`），`verticalAlign` → `verticalAlignment`。
- 字体不打包：诊断里列出用到的字体族，部署方负责安装。

### 变换

- 旋转用 `transform: Rotation { origin.x; origin.y; angle }`，原点 = `pivot × 盒尺寸`。
  `transformOrigin` 只有九个枚举值，接不住自由基点（基点允许落在盒外）。

### 颜色

- `#rrggbbaa` 在 QML 里是 `#aarrggbb`，转换集中在一个函数里。`transparent` 原样输出。

### 标识与确定性

- QML `id` = `e_` + Entity ID 中非 `[A-Za-z0-9_]` 字符替换为 `_`；冲突时追加 `_2`、`_3`（按文档
  遍历顺序，因此确定）。同时用 `objectName` 写原始 Entity ID，便于在 Qt 侧按文档 ID 查找。
- 数值统一走 `formatComposeNumber`（两位精度、整数不补零），与属性面板显示一致，也避免
  `82.96874999999991` 这类浮点残渣进入产物。

### 编辑器入口

- 动作 `document.exportQml` 进动作目录（命令面板可搜），应用菜单里放一条；不进工具栏货架。
- 不另起一次求解：读编辑器布局 Runtime 已经交出的「已解算文档 + 快照」（控制器在动作上下文里新增
  可选的 `layoutDocument`，与既有的 `layoutSnapshot` 成对）。那正是画布在画的一对，因此含未保存的
  改动、文字盒用的也是同一个测量端口。布局未就绪时动作列出但不可用（`layoutPending`）。
- 场景取激活场景（`resolveTargetFrameId(document, [], activeFrameId)`），不跟选区——它是发布目标。
- 诊断按类聚合成一行，经编辑器既有的提示条（`setPageNotice`，DXF / SVG 导入也走它）呈现，并列出
  目标机需要安装的字族；不另造 UI。
- 应用菜单里它单独成组：与「返回页面库」（去处）和设置 / 命令面板（应用设置）是三类事。

## 考虑过的替代方案

- **把 Auto Layout 翻译成 Qt Layouts**：产物可自适应，但两套布局算法的差异会变成无法定位的像素
  偏差。等到真的需要 Qt 侧响应式时再评估。
- **导出 SVG 交给 QtSvg**：QtSvg 只支持 SVG Tiny 1.2，且后续脚本、绑定、动画都无处安放。
- **Qt WebEngine 套 Preview**：零转换，但目标是可能带不动 Chromium 的嵌入式设备。

## 风险 / 权衡

- 文字度量：Qt 与浏览器的字形前进宽度不同，写死盒子之后可能出现截断或提前换行 → 拉丁文字夹具
  实测水平方向逐像素一致。**中文尚未覆盖**：随附的 DejaVu Sans 没有 CJK 字形，需要再随附一款
  开源中文字体（如思源黑体子集）才能验收中英文混排。
- 小字号的字形光栅化：16px 段落的残余差异集中在每个字形的左边缘（两套光栅化器的亚像素起点取整
  不同），`text-styles` 夹具在本机为 0.467%，离 0.5% 的上限很近；Linux 验收环境的数字以 CI 为准。
- `CurveRenderer` 与 Preview 的抗锯齿不同 → 由 `qt-runtime` 的容差承担。
- 组件实例第一期是占位：接线图里的符号大多是组件实例，这一期导出的接线图会是一片占位 → 实例
  准备管线提取与内联展开是紧接着的下一个变更。

## 待解决问题

- 图片物料与图片背景的资源打包方式（随 `.qml` 输出资源目录，还是由宿主 Resolver 提供 URL）。
- 渐变：`QtQuick.Shapes` 支持线性 / 径向 / 锥形渐变，是否在第二期改为精确还原。
