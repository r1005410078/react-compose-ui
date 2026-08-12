## 1. 规格与快捷键裁决

- [x] 1.1 确认 `R` 的快捷键裁决：默认 Rectangle `R`、Rotate `Shift+R`，或由用户指定替代绑定；更新中英文
  名称、tooltip 和 Preferences 冲突测试。
- [x] 1.2 严格校验 `editor-workspace-layout`、`stage`、`stage-engine`、`basic-materials` 与
  `editor-preferences` 增量，建立每个 Scenario 的带 `OpenSpec:` 名称的单测、React 契约与 E2E 映射。

## 2. Headless 工具与绘制会话（Red → Green → Refactor）

- [x] 2.1 Red：在 `stage-engine` 为新 tool union、选择四角/边缘命中、move X/Y 单轴拖动、scale/rotate
  gate、draw preview/commit、snap、Escape/cancel 和一次提交编写纯 controller 测试，记录现有只支持
  `select | pan` 的预期失败。
- [x] 2.2 Green：引入 `StageInteractionTool`、tool-aware interaction state、draw preview 和纯数据
  `drawing.commit` effect；保持 Engine 无 React、DOM、Registry 和 Renderer props。
- [x] 2.3 Refactor：统一工具切换取消活动手势、cursor 提示、GeometryConstraints、Flow/Fix 转换和
  rAF/pointer capture 生命周期，不改变现有 external drag/paint/guide 行为。

## 3. Stage Overlay 与受控协议（Red → Green → Refactor）

- [x] 3.1 Red：增加 `@compose-ui/stage` 合同测试，覆盖四角可见/边缘 cursor、move-only X/Y gizmo、
  scale-only resize、rotate-only handle、容器/图形/文本 preview 与公共 tool/shortcut 受控传递。
- [x] 3.2 Green：扩展 `ComposeStageTool`、shortcut actions 与 Overlay；由 Stage adapter 把
  `drawing.commit` 映射为 Registry seed、父容器和单一 entity-create command。
- [x] 3.3 Refactor：整理 SVG gizmo、透明 edge hit-region、深浅主题 token、ARIA live/tooltip 及缺少
  preset 时的无副作用降级；同步更新公共 API TSDoc 与 Stage README。
- [x] 3.4 为单选 Line/Arrow 接入精确线段 Overlay：仅首尾控制点、长度浮标、无矩形选区，并将端点 commit
  映射为一次 LayoutItem + `direction` 批事务。

## 4. 第一方 Shape materials（Red → Green → Refactor）

- [x] 4.1 Red：为 line、arrow、circle Preset 的合法 v6 seed、正/负向拖拽、Renderer 输出、Inspector
  和 Preview/Stage 一致性编写 `@compose-ui/materials` 测试。
- [x] 4.2 Green：实现 feature-first `shape/` renderer、结构化 props、三个 Preset 与默认 Palette icon，
  并将它们接入 `createComposeBasicMaterials`。
- [x] 4.3 Refactor：抽取 shape geometry/props 的纯模型，复核形状不依赖 Stage/editor、Hug 测量和
  renderer prop contracts 不回归。
- [x] 4.4 补充 Shape 的常用 SVG 线条属性和 Inspector：颜色、粗细、端点形状、线型及首尾箭头；保持旧 Arrow
  文档的默认终点箭头兼容。

## 5. Editor 工具栏、网格、视口与偏好（Red → Green → Refactor）

- [x] 5.1 Red：为默认 toolbar 的精确顺序、无 Card chrome、active `aria-pressed`、shape/grid menu、
  snap master、grid session visibility、grid size transaction、绘制快捷键与自定义 slots 隔离编写 editor
  React/controller/preference 测试。
- [x] 5.2 Green：重写默认 toolbar 图标与分组，增加工具 action/Preferences/i18n；实现网格大小菜单和高级
  canvas 设置入口，将 viewport controls 移到 Stage surface 内的无 Card 行内浮层。
- [x] 5.3 Refactor：隔离纯 toolbar layout/action model，确保每帧 viewport 更新只重渲 Stage 与视口控件，
  不重渲 scene tree、Inspector、command panel；复核 keyboard/menu 焦点恢复与 Escape 规则。

## 6. 浏览器交互与视觉（Red → Green → Refactor）

- [x] 6.1 Red：增加 Playwright，覆盖各工具的 selected canvas feedback、X/Y 轴向移动、四角/边缘 resize、
  旋转、Container/shape/text 绘制、grid/snap、menu keyboard、画布内 zoom/center 和顶栏移除旧控件。
- [x] 6.2 Green：逐项完成 Chromium 交互，验证每个 draw/transform 手势只产生一个正确可撤销事务，纯 viewport
  操作不写 History。
- [x] 6.3 Refactor：人工检查实际/差异截图，再更新经过核对的 toolbar、move gizmo、draw preview 与 canvas
  控件视觉黄金；仅在核对后运行 `bun run test:e2e:update`。
- [x] 6.4 覆盖 Line/Arrow 的端点选择、端点越过、取消和一次提交；验证普通图形仍使用四角缩放。

## 7. 回归与交付

- [x] 7.1 运行 `openspec validate move-stage-viewport-controls --strict`、各受影响包定向测试、`bun run lint`、
  `bun run typecheck`、`bun run test`、`bun run build`、`bun run test:e2e` 与 `git diff --check`，记录真实结果。
- [ ] 7.2 检查最终变更不包含现有无关未跟踪文件；按用户指示提交并推送。
