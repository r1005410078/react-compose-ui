## 1. animation-panel：缓动预设与曲线编辑器

- [x] 1.1 新增 `packages/animation-panel/src/easing-editor/` 功能目录：`easing-presets.ts`
      （预设表、1e-6 容差匹配、控制点解析/格式化为 `0.5, 0, 0.5, 1`）+ 纯函数单元测试（Red → Green）
- [x] 1.2 实现 `easing-curve-editor.tsx`：受控 `value`/`onChange`，曲线画布 + 两个控制柄
      （指针拖拽、x 钳制 `[0,1]`、y 不钳制）、方向键 ±0.01 / Shift ±0.1、本地化 accessible name
- [x] 1.3 实现预设选择与 Custom bezier 落态；单行控制点输入解析失败回滚
- [x] 1.4 共置样式（语义 token）、Testing Library 测试（预设/拖拽/键盘/非法输入）与 Story
- [x] 1.5 从包公共入口导出组件、预设表与相关类型，补 TSDoc

## 2. animation-panel：移除弹簧标签与修正出向语义

- [x] 2.1 **BREAKING** 从 `types.ts` 删除 `ComposeAnimationPanelValue.easingEditor`，从
      `animation-panel-provider.tsx` 删除 `setEasingEditor`，同步 `default-value.ts` 与 Story
- [x] 2.2 `compose-animation-panel.tsx` 的 `ComposeAnimationInspector` 改用新曲线编辑器，
      删除 curve/spring tablist 与四个独立控制点输入
- [x] 2.3 修正插值区间为「本帧 → 下一帧」（`compose-animation-panel.tsx:1311` 取反）
- [x] 2.4 曲线段点选改为选中该段**起点**关键帧，更新相关测试
- [x] 2.5 更新包内既有测试与快照

## 3. editor：画布动画 Section 的缓动区

- [x] 3.1 `use-animation-mode.ts` 删除 `easingEditor` 会话字段；暴露选中关键帧的解析结果
      （entityId / path / keyframeId / 当前插值 / 是否末帧 / 下一帧时间）
- [x] 3.2 新增 `packages/editor/src/animation-mode/keyframe-easing-field.tsx`：属性面板自定义
      渲染器（`metadata.editor: 'animation-easing'`、`layout: 'full-width'`），内嵌曲线编辑器与末帧说明
- [x] 3.3 `page-animation-scope-panel.tsx` 在 `currentTimeMs` 之后按条件追加关键帧标识行、
      缓动预设行与曲线行；未选中关键帧时不产出这些字段
- [x] 3.4 派发 `animation.keyframe.interpolation.set`：拖拽共享
      `mergeKey = animation-easing:<keyframeId>`，预设与数值提交各自独立成事务
- [x] 3.5 `editor-i18n.ts` 补中英文案（缓动、预设名、控制点、末帧说明、关键帧标识行）
- [x] 3.6 `styles.css` 补缓动区样式，保持与 Section 其它行的列宽一致

## 4. 测试与验证

- [x] 4.1 Vitest：预设匹配/解析/格式化、末帧判定、选中关键帧解析
- [x] 4.2 Testing Library：Section 三行的出现与消失条件、预设选择派发命令、非法数值回滚
- [x] 4.3 Playwright（`e2e/animation.spec.ts`）：动画模式 → 打两个关键帧 → 点画布空白 →
      选中首帧 → 选 Ease in and out → 曲线更新 → 撤销回到 Linear → 改为 hold 后播放头中点取值不变
- [x] 4.4 黄金图无需刷新：缓动区只在动画模式且选中关键帧时出现，既有黄金图场景不含该状态
- [x] 4.5 `bun run lint && bun run typecheck && bun run test && bun run build && bun run test:e2e`
- [x] 4.6 `openspec validate add-keyframe-easing-editor --strict`
