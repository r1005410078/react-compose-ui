# 变更：把 Stage 适配层的纯助手迁出 compose-stage

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 5 的第一刀。`compose-stage.tsx`
3088 行里，前 500 行是与 React 无关的纯函数——预览文档烘焙、指针几何归一化、资源落点排布、
快捷键匹配。它们和 2300 行的 `ComposeStageReady` 挤在同一个文件里，既读不出边界，也测不动。

先搬纯函数是这一轮的低风险起点：它们没有 Hook、没有 ref、没有闭包依赖，搬动只改导入。

## 变更内容

按职责拆成四个同目录模块：

- `stage-preview-document.ts` — 把手势预览烘焙进临时文档与布局快照（`transformDocument`、
  `transformLayoutSnapshot`、两点图形的端点几何、`bootstrapSelectionBounds`）。
- `stage-pointer-geometry.ts` — surface 矩形冻结、屏幕点换算、按键与修饰键归一化。
- `stage-asset-drop.ts` — 资源落点排布、绘制工具到 Preset 的映射、带并发上限的并行解析。
- `stage-shortcuts.ts` — 快捷键动作表、默认键位与匹配判定。

`compose-stage.tsx` 3088 → 2647 行。

## 关于 `lockGestureParent`

路线图原计划在这一步删除它（BREAKING）。**现在不删，并且改主意有具体理由**：

那条计划写在插件内核落地之前，当时它是 Stage 的一个裸 prop。步骤 2 之后它已经住在
`ComposeStagePolicy` 里——一个语义单一、有文档、服务于真实产品需求（动画模式禁止跨父级挂载）
的策略位。删掉它意味着宿主要自行组装插件集合才能表达同一件事：API 面更大、宿主更复杂，换来的
只是少一个布尔。

留着它是更小的接口，不是欠下的债。

## 影响

- 受影响的规范：`stage`（适配层组织）
- 受影响的代码：`stage-surface/compose-stage.tsx`、四个新增同目录模块
- 用户可见行为：无。e2e 99/99，含 41 张黄金图。
