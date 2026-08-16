## 1. Stage Engine 判定协议

- [x] 1.1 在 `geometry.ts` 补 `containsRect(outer, inner)` 并补齐 TSDoc 与单测
- [x] 1.2 新增 `src/marquee-selection.ts`：`StageMarqueeMode` 类型与
      `resolveMarqueeSelection({ index, document, area, mode, direction, base, combine })` 纯函数
- [x] 1.3 写 `marquee-selection.test.ts`：三种模式、方向切换、hidden/locked 排除、
      替换/并集/差集三种组合、退化空框
- [x] 1.4 `index.ts` 导出模式类型与纯函数

## 2. Stage Engine 手势接入

- [x] 2.1 `StageInteractionTool` 增加 `marquee`
- [x] 2.2 受控 context 增加 `marqueeMode`，未传入时回退 `intersect`
- [x] 2.3 `marquee` 工具下命中节点也走起框分支；`select` 维持空白起框
- [x] 2.4 marquee 手势记录起止点方向，`finish` 改为调用 `resolveMarqueeSelection`
- [x] 2.5 snapshot 暴露当前生效判定，供 Overlay 区分实线/虚线
- [x] 2.6 补 `interaction-controller.test.ts`：从节点上起框、Shift/Alt 组合、模式透传

## 3. Stage 适配层

- [x] 3.1 `types.ts` 增加 `marqueeMode` 受控 prop 与 TSDoc（`onMarqueeModeChange` 未落地：
      Stage 没有切换模式的 UI，回调会是死 API，spec 已同步改为只读受控值）
- [x] 3.2 `compose-stage.tsx` 把模式传进 controller context，把生效判定传给 Overlay
- [x] 3.3 `stage-overlay.tsx` 给 marquee rect 加 `data-marquee-mode`，`styles.css` 区分实线/虚线
- [x] 3.4 补 `compose-stage.test.tsx`：包含模式下部分重叠节点不入选、marquee 工具从节点起框

## 4. 编辑器工具栏与快捷键

- [x] 4.1 `stage-toolbar-icons.tsx` 增加三个模式图标
- [x] 4.2 `default-stage-toolbar.tsx` 按形状工具范式加框选 split button 与模式菜单，
      主按钮图标跟随当前模式
- [x] 4.3 editor 持有模式状态并传给 Stage
- [x] 4.4 `editor-i18n.ts` 补中英文案（工具名、三个模式名、`stage.marqueeTool` 动作名）
- [x] 4.5 `preferences.ts` 注册 `stage.marqueeTool`、默认 `KeyB`、归入 stage 分类
- [x] 4.6 `action-catalog.ts` 接线并加入动作列表
- [x] 4.7 补 `default-stage-toolbar.test.tsx`：菜单键盘导航、切模式不换工具、图标跟随模式

## 5. 验证

- [x] 5.1 `bun run lint`
- [x] 5.2 `bun run typecheck`
- [x] 5.3 `bun run test`
- [x] 5.4 `bun run build`
- [x] 5.5 `bun run test:e2e`（46 passed / 1 failed；失败的
      `integration.spec.ts:564` 在本分支基线 c1912a7 上同样失败，与本变更无关）
- [x] 5.6 `openspec validate add-stage-marquee-modes --strict`
