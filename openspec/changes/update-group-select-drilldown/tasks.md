## 1. 解算（stage-engine）

- [x] 1.1 `hit-testing/group-selection.ts`：`resolveStageGroupHit`——单击选最外层未进入的 Group、
      双击穿过一层、`deep` 无视门槛、锁定门槛不下钻、复合地址按宿主实例算进入
- [x] 1.2 单测：两层嵌套夹具，覆盖单击 / 双击 / 已进入 / 选中 Group 自己不算进入 / 深选 /
      锁定 / 幽灵 ID
- [x] 1.3 `interaction-kernel/group-hit.ts`：按 `pointer.down` 事件包一层，四个插件共用

## 2. 插件（stage-engine）

- [x] 2.1 `entity-select-move`：读解算结果；`descended` 只改选区并 `consumed`
- [x] 2.2 `marquee-converge`：先解算再判收敛，锁定 Group 的子级同样收敛
- [x] 2.3 `hollow-move-fallback` / `geometry-edit-fallback`：收敛判定读同一个解算结果
- [x] 2.4 单测（`group-hit.test.ts`）：单击选组并起移动、双击进组不移动、进组后兄弟直选、
      穿过门槛不进入编辑、command 深选、Shift 加选加的是 Group、锁定 Group 的子级收敛且不下钻

## 3. Stage 侧入口

- [x] 3.1 实例下钻：实例被未进入的 Group 门着时让位，那一下先进 Group
- [x] 3.2 右键：`useStageRootHandlers` 注入 `resolveHitEntity`，与左键过同一道门槛

## 4. 端到端

- [x] 4.1 `stage-interactions.spec.ts`：单击子级描边选中 Group（选框是并集）→ 双击进组选中子级
      → 单击兄弟直选 → 点空白退出再点回到 Group → ⌘ 点击深选
- [x] 4.2 既有「Ctrl 拖动 Group 子级」用例的注释说明 Control 现在是深选；`editor-workspace` 里
      分组之后点文字改成 ⌘ 深选

## 5. 收尾

- [x] 5.1 规范增量（stage-engine、stage）通过 `openspec validate --strict`
- [x] 5.2 `AGENTS.md` 记下 Group 门槛这条判断
- [x] 5.3 `bun run lint` / `typecheck` / `test` / `build`；完整 `test:e2e`
