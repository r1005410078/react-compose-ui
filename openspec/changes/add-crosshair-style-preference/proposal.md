# 变更：十字光标样式成为编辑器偏好（渐隐默认、晕圈可选）

## 原因

十字光标眼下只有一副样子：1px 均匀实线。绘图工作区把臂长拉到贯穿图面之后，这四条线在
整张接线图上与图纸的墨抢眼；而在页面工作区那截短臂压在红导线或白符号上时又直接消失。两种
场景要的是两种画法，且哪种更好因人而异，因此它是一项**用户偏好**而不是一个定值。

## 变更内容

- `@compose-ui/canvas-kit` 的共享十字光标增加 `style` 输入：`fade`（渐隐：线从中心向远端
  淡出）与 `halo`（晕圈：细线下垫一圈画布底色）。缺席即 `fade`。
- `@compose-ui/stage` 的 `ComposeStageProps` 增加 `crosshairStyle`，透传给共享组件；默认 `fade`。
- `@compose-ui/editor` 的 `ComposeEditorPreferences` 增加 `crosshairStyle: 'fade' | 'halo'`，
  默认 `fade`；规范化时缺席或非法值回落 `fade`。controller 增加 `crosshairStyle` /
  `setCrosshairStyle`，编辑器把偏好同步进 controller 并经 `stageProps` 交给 Stage。
- 「设置」对话框新增导航项**画布**，内含「十字光标」一节：两张单选卡（渐隐 · 默认 / 晕圈）
  与一段说明；搜索匹配集加进「画布」「十字光标」「渐隐」「晕圈」；搜索占位文案改成
  「搜索主题、语言、画布或快捷键」。
- 臂长（`crosshairSize`）**不动**：它仍是工作区会话开关，本变更不给它入口。

## 影响

- 受影响的规范：`canvas-kit`（共享十字光标组件）、`stage`（Stage 十字光标）、
  `editor-preferences`（新增十字光标样式偏好；设置模态弹框的分类）。
- 受影响的代码：`packages/canvas-kit/src/crosshair/*`、`packages/canvas-kit/src/styles.css`、
  `packages/stage/src/types.ts`、`packages/stage/src/stage-surface/compose-stage.tsx`、
  `packages/stage/src/styles.css`、`packages/editor/src/editor-preferences/*`、
  `packages/editor/src/editor-controller/controller.tsx`、
  `packages/editor/src/compose-editor/compose-editor.tsx`、`packages/editor/src/editor-i18n.ts`。
- 端到端快照 `editor-preferences-dark.png` **无需更新**：左栏多出的一行落在该用例既有的
  `maxDiffPixelRatio: 0.01` 容差内。
