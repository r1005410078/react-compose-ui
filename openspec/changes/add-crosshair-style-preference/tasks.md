## 1. canvas-kit
- [x] 1.1 `crosshair-model.ts`：`ComposeCanvasCrosshairStyle`、输入与输出上的 `style`（缺席即 `fade`）
- [x] 1.2 `compose-canvas-crosshair.tsx`：渐隐渐变与晕圈底线；晕圈线不带 `crosshair-line` 标记
- [x] 1.3 `styles.css`：渐变 stop 与晕圈画笔的 token
- [x] 1.4 用例：两种样式各自的可观察差异、缺席即渐隐、四条线计数不变

## 2. stage
- [x] 2.1 `ComposeStageProps.crosshairStyle` 透传，默认 `fade`；浅色主题的晕圈 token
- [x] 2.2 用例：宿主传 `halo` 时图面画晕圈

## 3. editor
- [x] 3.1 `ComposeEditorPreferences.crosshairStyle`、默认值与规范化
- [x] 3.2 controller：`crosshairStyle` / `setCrosshairStyle` 进 `stageProps`
- [x] 3.3 compose-editor：偏好同步进 controller
- [x] 3.4 设置对话框：「画布」导航项、「十字光标」单选卡、搜索匹配与占位文案；中英文案
- [x] 3.5 用例：规范化、设置对话框切换、搜索命中

## 4. 验证
- [x] 4.1 `openspec validate add-crosshair-style-preference --strict`
- [x] 4.2 `bun run lint && bun run typecheck && bun run test && bun run build`
- [x] 4.3 `bun run test:e2e`（322 条全通过；`editor-preferences-dark.png` 落在既有容差内，未更新）
