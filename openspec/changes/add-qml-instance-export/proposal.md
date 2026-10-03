# 变更：组件实例导出为内联的 QML 子树

## 原因

`add-qml-export` 第一期把组件实例导出成同尺寸占位。接线图里的符号（刀闸、断路器、变压器）几乎
全是组件实例，因此这一期导出的接线图是一片占位框——对目标场景来说，它是 QML 出口最大的缺口。

占位不是因为难，而是因为**实例在预览里的处理链住在 React 组件内部**：读快照与覆盖 → 应用实例
覆盖 → 按播放头采样动画 → 把根锚到原点 → 按实例盒对齐根尺寸 → 嵌套 Yoga 求解 → 内容缩放与翻转。
前五步是纯数据变换，却写在 `ComponentInstanceRenderer` 的 `useMemo` 里；导出器拿不到，在导出器里
另写一份就是两处实现，而两处实现的症状是「预览里对、导出的不对」，且只在用过某个覆盖或动画的
实例上出现。

## 变更内容

- **把实例准备管线提取成一个纯函数**：`prepareComposeComponentInstance(props, hostBox)`，放在
  `@compose-ui/materials` 的 `component-instance/` 下、**不含 React**，返回「可直接求解的嵌套文档 +
  内容适配方式与比例 + 翻转」或一个可判别的失败（快照无效 / 覆盖无效 / 循环引用 / 嵌套过深）。
  `ComponentInstanceRenderer` 改为调用它——预览与导出读同一份实现，这是本变更成立的前提。
- **编辑器负责求解**：导出时对场景里的每个实例调用准备函数，再用编辑器已有的测量端口
  （`createComposeRendererMeasurementAdapter`）对嵌套文档求解，递归处理嵌套实例。求解只能在
  浏览器里做（文字测量），这与第一期「导出器不求解」的边界一致。
- **导出器多一个可选输入** `instances`：按实例的**复合地址**（`实例ID/内部ID`，与编辑期下钻
  寻址同一套）索引的「嵌套文档 + 快照 + 适配 + 翻转」。导出器仍然**只依赖 `core`**：它消费的是
  数据，不认识物料包。
- **映射**：实例盒内一层裁剪的 `Item`（预览的实例内容恒为 `overflow: hidden`）；翻转绕盒中心
  `Scale`；`contentFit: scale` 时内层按根的自然尺寸摆放、以原点为基准整体 `Scale`；其下是嵌套
  文档的子树，规则与页面一级完全相同。
- 缺失嵌套结果、准备失败时**仍然**导出占位并给出诊断——第一期的占位变成兜底，而不是常态。
- 验收：新增一份含实例的夹具（带实例覆盖、`contentFit: scale`、翻转、嵌套一层实例），走既有的
  预览 vs Qt 像素对比。

## 影响

- 受影响的规范：`basic-materials`（实例准备管线成为可复用的纯函数）、`qml-export`（实例内联展开）
- 受影响的代码：
  - `packages/materials/src/component-instance/`：新增 `prepare.ts`，`renderer.tsx` 改为调用它
  - `packages/materials/src/index.ts`：公开准备函数及其结果类型
  - `packages/qml-export/`：`instances` 输入与实例映射
  - `packages/editor/src/qml/`：导出前逐实例准备、求解（异步）
  - `apps/example/src/QtReferencePreview.tsx`、`native/qt/fixtures/`：实例夹具
- 依赖：`add-qml-export` 先落地。归档 `add-qml-export` 之后，其「组件实例第一期导出为占位」需求
  改写为本变更里的兜底条款。
