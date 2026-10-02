# 变更：把场景导出成 QML（第一期：静态基础图形）

## 原因

实施工程师在编辑器里搭出来的大屏，现场要跑在 Qt 程序里，而不是浏览器里。现在唯一的渲染出口是
`ComposePreview`（React + DOM）。本变更提供第二个出口：把一块场景转换成 Qt Quick 能直接加载的
`.qml`。

第一期只做**静态基础图形**：容器、矩形、曲线（线 / 弧 / 多段线 / 路径）、文字、Group、
组件实例。脚本与数据绑定在 `add-qml-page-script`，前置的 Qt 环境与像素验收链路在
`add-qt-runtime-foundation`。

## 变更内容

- 新增 **`@compose-ui/qml-export`**：无 React、无 DOM 的纯函数包，**只依赖 `core`**，形态与
  `dxf`、`svg-import` 相同——产出的是**导出结果**（QML 文本 + 诊断），不写盘。
- **导出的是求解之后的结果，不翻译布局语义**：输入是 `resolveComposeDocumentLayout` 给出的
  「已解算文档 + 布局快照」，也就是 Preview 正在渲染的那一对。每个对象在 QML 里都是
  `x / y / width / height` 绝对定位。Qt Quick 的 `RowLayout` / `GridLayout` 与 Yoga 在 gap、
  Hug、换行、最小/最大尺寸上的算法都不同，翻译过去的症状是「到处差几个像素」而且无从查起；
  场景本来就是定尺寸的大屏 Frame，绝对定位没有损失。导线端点、填充跟随这些派生几何也因此
  白拿——它们已经在布局求解里算好了。
- 几何换算**不另写一份**：曲线投影走 `projectComposeCurveToBox`，圆角多段线走
  `composePolylineOutline`，填充读 `getComposeCurveFill`，旋转基点读 `getComposeTransformPivot`。
  命中、渲染与导出读同一个入口，下一个改几何语义的人不会只改到其中一处。
- 不能表达的内容**降级并出诊断，元素不丢**（与 `svg-import` 同一条规则）：渐变取中位色标的纯色、
  阴影忽略、图片 / SVG / 图表物料落成同尺寸的占位矩形；动画按第 0 帧的静态姿态导出；被绑定的
  Renderer prop 第一期写入文档里的当前值。
- 组件实例在第一期**内联展开**（每个实例展开成一棵子树）；映射成独立的 `.qml` 组件留到后续。
- 输出**确定**：同一输入逐字节相同的 QML；QML `id` 由 Entity ID 推出，可读且稳定。
- 编辑器提供「导出为 QML」动作：导出当前激活场景，布局求解使用与 Preview 相同的文字测量端口，
  结果下载为 `.qml` 文件并在命令行 / 通知里列出诊断。
- 用 `add-qt-runtime-foundation` 的像素对比链路做验收：每类基础图形一份夹具。

## 影响

- 受影响的规范：新增 `qml-export`
- 受影响的代码：
  - 新增 `packages/qml-export/`
  - `packages/editor/`：「导出为 QML」动作（进动作目录，可从命令面板与应用菜单触发）
  - `native/qt/fixtures/`、`e2e/qt-reference.spec.ts`：基础图形验收夹具
  - `scripts/check-architecture`（或等价边界检查）：`qml-export` 只能依赖 `core`
  - `AGENTS.md`：新增包的架构边界
- 依赖：`add-qt-runtime-foundation` 先落地。
