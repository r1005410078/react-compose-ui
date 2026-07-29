# 变更：Paint v5 与 Stage 直接编辑

## 原因

字符串颜色无法保存渐变几何，导致 Stage 不能提供可信的画布控制柄或图层采样。浏览器原生吸管也不是全浏览器能力，需要在不破坏无 DOM Stage Engine 边界的前提下提供明确降级。

## 变更内容

- **BREAKING** ComposeDocument 只支持 schema v5，以结构化 `Appearance.backgroundPaint` 取代 `backgroundColor`。
- 新增 Core Paint 协议、共享 Stage/Preview Paint layer、Color/Paint picker、会话颜色历史与浏览器 EyeDropper 适配。
- 新增 Stage Engine 的 paint edit/sample session、SVG 画布手柄、图层颜色求值与一次事务提交。
- 通过 Registry inspector port 把 Materials 背景填充、Editor 和 Stage 连接，不建立反向包依赖。

## 影响

- 受影响规范：compose-document、command-transaction、component-registry、components、property-panel、basic-materials、stage-engine、stage、editor-workspace-layout、compose-preview、editor-preferences。
- 受影响包：core、stage-engine、components、component-registry、stage、materials、property-panel、editor、preview。
