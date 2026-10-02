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
  instances?: ReadonlyMap<string, { document; snapshot }> // 组件实例的嵌套解算结果
}): { qml: string; diagnostics: ComposeQmlExportDiagnostic[] }
```

- 包只依赖 `core`。布局求解不在包内做：求解需要文字测量端口，而测量只有浏览器给得出来——
  在纯 Node 里求解，Hug 文字的盒子会与 Preview 不同。因此由编辑器求解、导出器只消费结果。
- 组件实例的嵌套文档同理由宿主求解后传入；缺失时该实例落成占位矩形并出诊断。

### 映射

| 文档           | QML                                       | 说明                                                                                 |
| -------------- | ----------------------------------------- | ------------------------------------------------------------------------------------ |
| 场景 Frame     | 根 `Item`，`width/height` 取 `Frame.size` | 导出单位就是一块场景，与预览 / 导出单位一致                                          |
| 容器 / 盒物料  | `Rectangle`                               | `color`、`border.color/width`、`radius`、`opacity`；`Clip` 存在且裁剪 → `clip: true` |
| Group          | `Item`                                    | 只承载层级，不画任何东西                                                             |
| `Curve`        | `Shape` + `ShapePath`                     | 见下                                                                                 |
| 文字           | `Text`                                    | 见下                                                                                 |
| 组件实例       | 内联 `Item` 子树                          | 坐标相对实例盒                                                                       |
| WidgetSwitcher | 只导出活动子项                            | 与 Preview 的规则一致                                                                |

层序：子级按 `Hierarchy` 顺序声明，QML 后声明者在上，与 DOM 一致，不写 `z`。

### 曲线

- 几何先经 `projectComposeCurveToBox` 投影到盒坐标再写进 `ShapePath`，因此 `viewBox` 缩放已经
  烘进坐标；非等比下弧被拍扁成折线这一点与命中、渲染一致。
- 因为坐标已在盒空间，描边不再被缩放——这正好等价于 Preview 的 `non-scaling-stroke`。
- `line` / `polyline` → `PathLine` 序列（`PathPolyline` 在 6.8 可用但逐段写更易读，二选一在实现时
  按输出体积定）；带 `cornerRadius` 的走 `composePolylineOutline` 得到直段与角弧，弧段 → `PathArc`。
- 整圆 → 两段半圆 `PathArc`（与 SVG 一样，起终点重合的单段弧画不出来）。
- `path` → `PathMove` + `PathCubic`；`fillRule: 'evenodd'` → `ShapePath.OddEvenFill`，缺席 →
  `WindingFill`。
- 填充读 `getComposeCurveFill`；空心 → `fillColor: "transparent"`。
- 虚线：**Qt 的 `dashPattern` 以线宽为单位**，SVG 是绝对长度，因此 `'8 4'` → `[8/w, 4/w]`；
  `strokeDashoffset` 同样除以线宽。
- 端点箭头：Qt 没有 marker，按 Preview 的箭头几何额外生成一条填充 `ShapePath`。
- `Shape.preferredRendererType: Shape.CurveRenderer`，保证细线抗锯齿。

### 文字

- `font.pixelSize`（**不用 pointSize**，后者随 DPI 变）、`font.family`、`font.weight`（数值直传，
  关键字映射到 Qt 的 100–900）、`font.letterSpacing`。
- `lineHeight` 缺席 → 引擎默认行高；有值（px）→ `lineHeightMode: Text.FixedHeight`，**并补
  `topPadding: (lineHeight − FontMetrics.height) / 2`**。CSS 把多出来的行距上下各分一半（半行距），
  Qt 的 `FixedHeight` 全放在下面；不补的症状是整行字比预览高几个像素。底座阶段实测
  （DejaVu Sans 28px、行高 40）：不补时差异 1.017%、墨迹整体上移 4px，补上后 0.247%，水平方向
  逐像素一致。
- 盒子写死为快照里的宽高：Hug 宽度 → `wrapMode: Text.NoWrap`；固定宽度 → `Text.WrapAnywhere`，
  对应 Preview 的 `overflow-wrap: anywhere`（中文每个字都是断点）。
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
- 导出前用与 Preview 相同的测量端口求解当前文档（含未保存的改动，与「页面预览必须包含未保存的
  改动」同一条理由）。

## 考虑过的替代方案

- **把 Auto Layout 翻译成 Qt Layouts**：产物可自适应，但两套布局算法的差异会变成无法定位的像素
  偏差。等到真的需要 Qt 侧响应式时再评估。
- **导出 SVG 交给 QtSvg**：QtSvg 只支持 SVG Tiny 1.2，且后续脚本、绑定、动画都无处安放。
- **Qt WebEngine 套 Preview**：零转换，但目标是可能带不动 Chromium 的嵌入式设备。

## 风险 / 权衡

- 文字度量：Qt 与浏览器的字形前进宽度不同，写死盒子之后可能出现截断或提前换行 → 夹具覆盖中英文
  混排；超出容差的情形作为已知限制写进诊断文案。
- `CurveRenderer` 与 Preview 的抗锯齿不同 → 由 `qt-runtime` 的容差承担。
- 内联展开组件实例会让大图纸的 QML 体积膨胀 → 第一期接受，组件映射在后续变更。

## 待解决问题

- 图片物料与图片背景的资源打包方式（随 `.qml` 输出资源目录，还是由宿主 Resolver 提供 URL）。
- 渐变：`QtQuick.Shapes` 支持线性 / 径向 / 锥形渐变，是否在第二期改为精确还原。
