# 变更：把场景导出成 QML（第一期：静态基础图形）

## 原因

实施工程师在编辑器里搭出来的大屏，现场要跑在 Qt 程序里，而不是浏览器里。现在唯一的渲染出口是
`ComposePreview`（React + DOM）。本变更提供第二个出口：把一块场景转换成 Qt Quick 能直接加载的
`.qml`。

第一期只做**静态基础图形**：容器、矩形、曲线（线 / 弧 / 多段线 / 路径）、文字、Group。脚本与
数据绑定在 `add-qml-page-script`，前置的 Qt 环境与像素验收链路在 `add-qt-runtime-foundation`。

## 变更内容

- 新增 **`@compose-ui/qml-export`**：无 React、无 DOM 的纯函数包，**只依赖 `core`**，形态与
  `dxf`、`svg-import` 相同——产出的是**导出结果**（QML 文本 + 诊断），不写盘。
- **导出的是求解之后的结果，不翻译布局语义**：输入是 `resolveComposeDocumentLayout` 给出的
  「已解算文档 + 布局快照」，也就是 Preview 正在渲染的那一对。每个对象在 QML 里都是
  `x / y / width / height` 绝对定位。Qt Quick 的 `RowLayout` / `GridLayout` 与 Yoga 在 gap、
  Hug、换行、最小/最大尺寸上的算法都不同，翻译过去的症状是「到处差几个像素」而且无从查起；
  场景本来就是定尺寸的大屏 Frame，绝对定位没有损失。导线端点、填充跟随这些派生几何也因此
  白拿——它们已经在布局求解里算好了。
- 几何换算**照搬预览**而不是另起一套：曲线按预览同一个 `viewBox` → 盒的逐轴仿射映射（非等比盒里
  的弧因此是精确的椭圆弧，与 SVG 逐像素一致；`projectComposeCurveToBox` 把它拍扁成折线，那是命中
  的近似），圆角多段线走 `composePolylineOutline`，填充读 `getComposeCurveFill`，旋转基点读
  `getComposeTransformPivot`，子级顺序读 `resolveComposeRenderedChildIds`。
- 不能表达的内容**降级并出诊断，元素不丢**（与 `svg-import` 同一条规则）：渐变取中位色标的纯色、
  阴影忽略、图片 / SVG / 图表物料与组件实例落成同尺寸的占位；动画按文档中的静态姿态导出；被绑定的
  Renderer prop 第一期写入文档里的当前值。
- **组件实例在第一期导出为占位，内联展开另起变更。**实现时发现，实例在预览里要经过实例覆盖、动画
  采样、根尺寸对齐、`contentFit: scale` 与翻转，再跑一次嵌套 Yoga——这条管线住在 `materials` 内部，
  而本包只依赖 `core`。为了内联展开在导出器里复制一份，正是「同一件事两处实现」；正确的做法是先把
  那条实例准备管线提取成可复用的入口，再让预览与导出共用它。
- 输出**确定**：同一输入逐字节相同的 QML；QML `id` 由 Entity ID 推出，可读且稳定。
- 编辑器提供「导出为 QML」动作（命令面板与应用菜单）：导出当前激活场景，读的是编辑器布局 Runtime
  交出的「已解算文档 + 快照」——画布正在画的那一对，因此含未保存的改动；结果下载为 `.qml` 文件，
  诊断按类聚合后经编辑器既有的提示条呈现，并列出目标机需要安装的字体。
- 用 `add-qt-runtime-foundation` 的像素对比链路做验收：夹具的预览截图与导出 QML 来自**同一个**
  布局 Runtime，底座阶段的手写对照 QML 随之删除。

## 影响

- 受影响的规范：新增 `qml-export`
- 受影响的代码：
  - 新增 `packages/qml-export/`
  - `packages/editor/`：「导出为 QML」动作（进动作目录，可从命令面板与应用菜单触发）
  - `native/qt/fixtures/`、`e2e/qt-reference.spec.ts`、示例应用 `?qt-reference`：基础图形验收夹具
  - `native/qt/tools/qml-grab`：`--font` 注册夹具字体（导出的 QML 只写字族名）
  - `packages/qml-export/src/dependency-boundary.test.ts`：`qml-export` 只能依赖 `core`
  - `AGENTS.md`：新增包的架构边界
- 依赖：`add-qt-runtime-foundation` 先落地。
