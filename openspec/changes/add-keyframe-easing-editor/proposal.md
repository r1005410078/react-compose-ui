# 变更：选中关键帧后在画布动画属性里编辑缓动曲线

## 原因

文档协议早就支持每个关键帧的 `hold / linear / cubic(control[4])` 出向插值，采样器
（`packages/animation/src/animation-sampler.ts:41`）与命令
`animation.keyframe.interpolation.set`（`packages/animation/src/animation-commands.ts:473`）
也已完整，但编辑器没有任何入口能改它：时间线选中关键帧后右侧属性区毫无变化。
`@compose-ui/animation-panel` 里那个从未被挂载的 `ComposeAnimationInspector`
（`packages/animation-panel/src/animation-panel/compose-animation-panel.tsx:1278`）提供的
是四个裸控制点输入与一个装饰性的「弹簧」标签——协议里根本没有 spring 插值，这个标签只切换
一条硬编码 SVG 路径。用户需要 Figma 式的缓动编辑：预设列表 + 可拖控制柄的曲线画布 + 单行
控制点数值。

## 变更内容

- 在 `@compose-ui/animation-panel` 新增受控的缓动曲线编辑器组件与缓动预设表：Hold、Linear、
  Ease in / out / in and out、Ease in / out / in and out back，与任一预设都不匹配时显示
  Custom bezier；两个控制柄可拖拽、可键盘调节，控制点以单行 `0.5, 0, 0.5, 1` 文本提交。
- **BREAKING** 删除面板里的「弹簧」标签及其会话字段：`ComposeAnimationPanelValue.easingEditor`
  与会话上下文的 `setEasingEditor` 一并移除。协议不含 spring 插值，保留一个只切图的假标签比
  没有更糟；spring 留待独立提案连同 `ComposeKeyframeInterpolation` 扩展一起做。
- **BREAKING** 关键帧属性面板的 cubic 控制点编辑从四个独立数值输入改为单行逗号分隔输入。
- 修正插值方向语义：插值挂**出向段**，因此点选两帧之间的曲线段 MUST 选中该段的**起点**关键帧，
  属性区显示的区间从「上一帧 → 本帧」改为「本帧 → 下一帧」。当前实现两处都取反了。
- Editor：动画模式下时间线选中关键帧时，画布 Inspector 的「动画」Section 在「当前时间」下方
  追加只读的关键帧标识行、缓动预设行与曲线编辑器；修改派发
  `animation.keyframe.interpolation.set`，一次拖拽经 `mergeKey` 合并为一步撤销。
- 轨道末帧的出向段不参与求值，但仍照常可编辑并显示一条说明（拖动改变前后顺序后该数据仍然有效）。

## 影响

- 受影响的规范：`animation-panel`、`editor-workspace-layout`
- 受影响的代码：
  - `packages/animation-panel/src/animation-panel/`（新增 `easing-editor/` 功能目录、
    `compose-animation-panel.tsx`、`types.ts`、`animation-panel-provider.tsx`、`default-value.ts`）
  - `packages/editor/src/animation-mode/`（新增缓动 Section 渲染器、`use-animation-mode.ts`）
  - `packages/editor/src/inspector/canvas-inspector.tsx`、`packages/editor/src/editor-i18n.ts`
  - 文档协议（`@compose-ui/core`、`@compose-ui/animation`）不变
