# 变更：增加 Hug Content 与 Renderer 测量

## 原因

Fixed/Fill 仍要求作者预先知道尺寸，Text、Image、SVG、Page Slot 与 Auto Layout 容器无法根据内容
自然尺寸参与排版。直接测量已渲染 Scene DOM 会形成反馈循环并破坏 headless Layout Engine。

## 变更内容

- 为 v6 LayoutItem axis sizing 增加 `hug`。
- 在 core/Registry 定义同步 Measure + 可选异步 Prepare/Baseline 的公共 Renderer measurement 协议。
- Layout Runtime 接受 measurement port，以 fallback 先布局并在资源/font revision 变化后增量重排。
- 为 Text、Image、SVG、Page Slot 提供第一方测量；无 intrinsic measurer 时使用 value 并发布诊断。
- Resize Hug axis 原子转 Fixed；测量变化不创建文档事务。

## 影响

- 依赖变更：必须在 `add-auto-layout-interactions` 完成后实施。
- 受影响规范：compose-document、layout-engine、component-registry、basic-materials、compose-preview、stage。
- 受影响代码：core measurement 协议、Registry definitions/adapter、layout-engine measure callbacks、
  Materials measure definitions、Stage/Preview Runtime attachment 与 Page Slot 嵌套测量。

