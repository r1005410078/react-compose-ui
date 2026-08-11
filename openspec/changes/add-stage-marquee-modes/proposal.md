# 变更：Stage 框选判定模式与独立框选工具

## 原因

当前框选只有一条写死的判定规则——与节点世界 AABB 相交即选中，且只能从空白处起框。用户在
密集画布上既无处下手，也无法表达「只要完全被框住的节点」这类常见诉求。

## 变更内容

- 新增 `marquee` Stage 工具：该工具下从任意位置按下都起框，包括压在节点上。
- 新增框选判定模式协议 `StageMarqueeMode`：`intersect`（默认）、`contain`、`directional`。
  `directional` 按拖拽方向决定：从左往右等价 `contain`，从右往左等价 `intersect`。
- 框选判定从 `interaction-controller` 抽出为 `stage-engine` 内的纯函数，可独立单测。
- 框选支持与已有选区的布尔组合：无修饰键替换、Shift 加选、Alt 减选。
- `select` 工具的空白拖拽框选保留，并共用同一个模式设置。
- 编辑器工具栏新增框选主按钮与 chevron 下拉模式菜单，复用现有形状工具的 split button 范式。
- 新增可配置快捷键 `stage.marqueeTool`，默认 `B`。
- marquee Overlay 携带当前判定模式，`contain` 用实线、`intersect` 用虚线区分。

## 影响

- 受影响的规范：`stage-engine`、`stage`、`editor-workspace-layout`、`editor-preferences`
- 受影响的代码：
  - `packages/stage-engine/src/marquee-selection.ts`（新增）
  - `packages/stage-engine/src/geometry.ts`、`interaction-controller.ts`、`index.ts`
  - `packages/stage/src/types.ts`、`stage-surface/compose-stage.tsx`、`stage-overlay.tsx`、`styles.css`
  - `packages/editor/src/stage-toolbar/default-stage-toolbar.tsx`、`stage-toolbar-icons.tsx`
  - `packages/editor/src/editor-i18n.ts`、`editor-preferences/preferences.ts`、`editor-controller/action-catalog.ts`
