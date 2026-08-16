# 变更：动画模式、属性面板打点与真实数据时间线

## 原因

`add-scene-animation-model` 交付了文档侧的动画事实来源，但没有任何入口能产生或消费它：
动画面板仍显示硬编码演示数据，属性面板没有打点入口，播放头不驱动画布。本变更把三者接起来，
形成"打开动画标签 → 属性面板打点 → 画布实时预览"的最小可用闭环。

## 变更内容

- `property-panel` 新增通用的 `renderFieldAdornment` 插槽，在字段标签后渲染宿主提供的装饰节点，
  并新增稳定 DOM 契约 `data-property-part="adornment"`。插槽不含任何动画语义。
- `animation-panel` 新增 `onAction` 语义化动作回调，让受控宿主不必从整快照 diff 反推用户操作。
- **BREAKING** `animation-panel` 放宽会话数据模型：`ComposeAnimationKeyframe.value` 支持
  数值与二维向量，`interpolation` 改为与文档模型同构的 `hold` / `linear` / `cubic` 判别联合，
  `ComposeAnimationPropertyTrack` 新增 `valueKind`。包仍不依赖 `@compose-ui/core` 或
  `@compose-ui/animation`，只是类型形状对齐。
- **BREAKING** 吸收 `update-animation-panel-foundation`：`ComposeAnimationClip.trackId` 必填、
  删除按 label 猜测归属的启发式、删除内置演示文案映射、双栏共用同一条垂直滚动、
  基础控件改用 `@compose-ui/components`、主题色 token 化。
- `editor` 新增动画模式：底部动画标签为活动标签时进入该模式，播放头驱动画布与属性面板；
  时间线数据由文档动画映射而来；属性面板可动画字段显示三态菱形按钮；
  开启自动记录时，画布与属性面板的编辑改写为关键帧命令。
- **BREAKING** 删除"默认关键帧演示时间线"需求：文档没有动画时，时间线显示空状态与创建引导，
  非受控且未提供 `defaultValue` 时不再回退到内置 `Fault / 背景填充` 演示数据。
- `preview` 的预览对话框新增动画播放控件。

## 影响

- 受影响规范：`property-panel`、`animation-panel`、`editor-workspace-layout`、`compose-preview`
- 受影响代码：`packages/property-panel/src/property-tree.tsx` 与
  `property-panel/compose-property-panel.tsx`、`packages/animation-panel/src/**`、
  `packages/editor/src/animation-mode/`（新增）、
  `packages/editor/src/inspector/entity-inspector.tsx`、
  `packages/editor/src/editor-controller/controller.tsx`、
  `packages/editor/src/workspace-layout/workspace-panels.tsx`、
  `packages/editor/src/compose-editor/compose-editor.tsx`、
  `packages/preview/src/preview-dialog/`
- `packages/editor` 与 `packages/preview` 新增 `@compose-ui/animation` 依赖；
  `AGENTS.md` 的对应架构边界条目同步
- 依赖 `add-scene-animation-model` 先落地
- 本变更对 `animation-panel` 的三条既有需求写 MODIFIED（本地交互、可访问视觉结构、
  编辑器动画区），并 REMOVED 一条（默认演示时间线）；它们来自已归档的
  `add-animation-panel-prototype`
- 完成后归档 `update-animation-panel-foundation`（其五项需求已被本变更逐条吸收）
