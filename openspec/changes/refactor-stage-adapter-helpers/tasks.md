# 任务：把 Stage 适配层的纯助手迁出 compose-stage

- [x] 1.1 `stage-preview-document.ts`：预览文档与布局快照烘焙、两点图形端点几何
- [x] 1.2 `stage-pointer-geometry.ts`：surface 矩形冻结、屏幕点、按键与修饰键
- [x] 1.3 `stage-asset-drop.ts`：落点排布、绘制 Preset、并发上限的并行解析
- [x] 1.4 `stage-shortcuts.ts`：动作表、默认键位、匹配判定
- [x] 2.1 `compose-stage.tsx` 3088 → 2647 行
- [x] 2.2 lint、typecheck、test、build 全绿；e2e 99/99 含 41 张黄金图
- [x] 3.1 记录 `lockGestureParent` 保留的理由，撤销路线图里删除它的计划
