# 任务

## 1. 先红

- [x] 1.1 新增 `e2e/curve-pick-tolerance.spec.ts`：离线身 5px 处点击不选中
- [x] 1.2 同文件：沿线身越过端点 4px 不选中
- [x] 1.3 同文件：空角里的窗交框不选中斜线
- [x] 1.4 同文件：穿过线身的窗交框仍然选中（改前应绿，防矫枉过正）
- [x] 1.5 新增 `e2e/geometry-editing-entry.spec.ts`：双击进入后十字线就在双击点上
- [x] 1.6 同文件：命令行启动且不动鼠标时不画十字光标
- [x] 1.7 同文件：几何编辑空闲档悬停另一条线的端点不出捕捉标记
- [x] 1.8 同文件：点亮一个顶点后，同一条曲线的其他顶点仍可捕捉（改前应绿，防回归）
- [x] 1.9 跑 1.1–1.3 与 1.5–1.7，确认**都红**，并记录失败输出（改前必红是这一刀的判别性所在）

## 2. core

- [x] 2.1 新增 `COMPOSE_CURVE_PICK_TOLERANCE = 3`，TSDoc 写明单位、出处与「住这里」的理由
- [x] 2.2 从 `packages/core/src/index.ts` 导出

## 3. materials

- [x] 3.1 `curve/renderer.tsx`：删掉 `MIN_HIT_WIDTH`，命中宽度改由常量推出
- [x] 3.2 命中层 `strokeLinecap` 改 `butt`，注释写清为什么与描边层的 cap 不同
- [x] 3.3 单元用例断言命中层的 cap 与宽度来源

## 4. stage-engine：框选按几何

- [x] 4.1 `core/curve-geometry.ts` 新增曲线与轴对齐矩形的相交判定，含单元用例
- [x] 4.2 `resolveMarqueeSelection` 按 Entity 类型分流：盒模型仍用 AABB，曲线走几何
- [x] 4.3 填充分支复用 `getComposeCurveFill` 与 `isPointInsideComposeCurve`
- [x] 4.4 修 Scenario「判定按拖拽方向切换」里残留的 `directional` 字样与那条空 Scenario

## 5. stage

- [x] 5.1 `pickRadius` 默认值改由常量派生
- [x] 5.2 更新 `types.ts` 的 TSDoc：删掉「没有全局的那个数」，改写两档框各自诚实的理由
- [x] 5.3 跟踪停止时清掉指针位置（`use-stage-drafting.ts` 的 `pointer`）
- [x] 5.4 双击进入几何编辑时用该事件的位置播种
- [x] 5.5 捕捉标记改读 `gripTarget`：空闲档不绘制，拖动与点亮期照旧
- [x] 5.6 单元/组件用例覆盖清除、播种与标记三条

## 6. 文档

- [x] 6.1 `AGENTS.md` 补上四条：容差量级、不越过端点、框选按几何、十字光标位置的新鲜度
- [x] 6.2 `docs/drafting-unification-roadmap.md` 记一条踩过的坑

## 7. 五道门

- [x] 7.1 `bun run lint`
- [x] 7.2 `bun run typecheck`
- [x] 7.3 `bun run test`
- [x] 7.4 `bun run build`
- [x] 7.5 `bun run test:e2e`（含 1.1–1.3 与 1.5–1.7 转绿、1.4 与 1.8 仍绿）

## 8. 观察项

- [x] 8.1 三条既有用例变红，逐条判断结果：
      - `drafting-chrome` 两条把旧容差的具体数（半宽 6）写进了下限，而它们真正断的是
        「放大前后触达不变」与「盒没把描边裁没」——下限改成只挡零值，并写明理由。
      - `snapping-angles` 那条观察的正是被删掉的空闲档标记，观察点改到点亮之后。
      没有为了让用例绿回去而调大常量。
- [x] 8.2 改用例时踩到一处**假绿**：点亮与随后的拖动落在同一个夹点、同一个双击窗口里被算成
      连击（夹点上的第二击是顶点开关），手势根本没开始，于是几条「不该出现标记」全部通过。
      已跨过双击窗口再按下。

## 9. 交付记录

- 五道门全绿：lint / typecheck / test（53 tasks）/ build（28 tasks）/ e2e **156 passed**。
- 提案里「小尺寸曲线退化成盒」那段证据在实现前已更正：那条曲线是矩形，几何本就跑在盒的四条
  边上，命中区填满它是正确行为。容差那一项因此改由「离线身 5px」钉住。
- `editor` 包的单元用例在一次全量跑里红过一次，单跑与重跑均绿；与本刀无关，是既有的
  `page-workspace.test.tsx` 抖动。
