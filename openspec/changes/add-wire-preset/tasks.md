# 任务

## 1. 物料

- [x] 1.1 在 `packages/materials/src/curve/defaults.ts` 新增 `DEFAULT_WIRE_PROPS`：展开
      `DEFAULT_CURVE_PROPS` 后**只覆盖 `strokeWidth: 2`**，颜色不动。TSDoc 要写清两件事——
      为什么不靠颜色区分（一次接线图里红/绿被合闸/分闸占着、色相另被电压等级占着，颜色留给
      数据绑定），以及这与 `DEFAULT_CURVE_PROPS` 上「2 明显偏粗」那条注释为什么不冲突
      （那条的前提是所有线一起加粗）。
- [x] 1.2 在 `definition.tsx` 的 `curvePreset` 列表里加入第四个起点 `wire`，
      `hiddenInPalette` 为 true，几何与 `curve` 相同，图标沿用线的图标。
- [x] 1.3 导出 `DEFAULT_WIRE_PROPS` 与 `DEFAULT_COMPOSE_WIRE_PRESET`，并把 `curve.presets`
      的元组类型从三元扩到四元。
- [x] 1.4 Vitest：`wire` seed 的 `strokeWidth` 大于 `curve` seed、`stroke`/线帽/marker 相同；
      `wire` 不出现在默认 Palette 中；四个起点的 Renderer 类型相同。

## 2. 落地

- [x] 2.1 `packages/stage/src/drafting/drafting-entity.ts` 的 `createStageDraftingCurveCommand`
      按 `wire ? 'wire' : arrow ? 'arrow' : 'curve'` 挑 Preset；更新那段注释，把「箭头走另一个
      Preset」扩成「箭头与导线各走自己的 Preset」。
- [x] 2.2 Vitest：`WIRE` 落地的 Entity `presetId` 是 `wire`；`LINE` 的仍是 `curve`；
      `wire` Preset 缺失时返回 null 而不回退。

## 3. 端到端

- [x] 3.1 e2e：`W` 画一条导线、`L` 画一条线，断言两者的 `stroke-width` 不同。
      注意视口——图面只有 566×537，落点必须留在 500×450 内。

## 4. 文档

- [x] 4.1 `docs/drafting-interaction-sdd.md` §6 待确认第 3 条改写：导线不靠颜色区分这件事
      已定，剩下的是「近白默认色 vs 透明场景背景」这条对**所有**制图几何都成立的问题。
- [x] 4.2 `AGENTS.md` 导线那一段补：导线有自己的 Preset，与普通曲线的差别是**线宽**而不是
      颜色——一次接线图里颜色被运行状态（红合绿分）与电压等级占着，默认色宣称状态会让「还没
      绑」与「绑了、此刻是这个状态」分不开，因此颜色留给数据绑定，区分沿用一次回路粗实线的
      制图惯例。

## 5. 验证

- [x] 5.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 5.2 `bun run test:e2e`（先 `bun run build`——e2e 跑的是预构建产物）
