## 1. 红

- [x] 1.1 单测：空心矩形作为**普通容器**的子级、已选中，从盒内部拖动（命中容器体）
      → 断言移动的是矩形。当前实现会选中并移动容器，用例必须先红。
- [x] 1.2 单测：同一位置原地按下并松开 → 断言选区不变、无任何 `selection.change` 效果。
      当前实现会发 `selection.change: []`，用例必须先红。

## 2. 绿

- [x] 2.1 守卫加第三条：命中目标是这个空心曲线的祖先时同样接管，沿 index 的 `getParentId`
      上溯，不引入第二份父链上溯。
- [x] 2.2 保留 `surface` 与 `shouldConvergeToMarquee` 两条，并在注释里说明为什么不因「祖先
      涵盖了顶层容器体」把收敛那一支删掉（它还覆盖锁定容器与 Group）。
- [x] 2.3 一步没动的分支：按**画不画盒**分流。第一版无条件保留选区，端到端抓到一条真回归
      （选中的对角线点它包围盒空角不再取消选中），因此判据收成 `isComposeClosedCurve`——与
      Stage 决定画盒还是画轮廓同一个谓词。开放几何照旧清空选区，另补一条单测钉住。

## 3. 回归

- [x] 3.1 既有用例全绿：未选中时不接管、Shift 起手仍框选、填过色不走这条路、
      场景空白上拖动照旧。
- [x] 3.2 补一条判别性用例：命中**排在它前面的兄弟**（填色矩形画在外框之上）时不接管——
      这是「不放宽成绘制次序」那条决定的判别性用例，MUST NOT 省略。
- [x] 3.3 端到端：容器里的空心矩形，选中后从盒内部拖动 → 矩形跟着走，容器没动。
      在**非 100% 缩放**下断言。

## 4. 验证

- [x] 4.1 `bun run lint && bun run typecheck && bun run test && bun run build`
- [x] 4.2 `bun run test:e2e`（涉及编辑器交互）
- [x] 4.3 `openspec validate update-hollow-interior-gestures --strict`

## 5. 落地记录

- 单测 `stage-engine`：500 条全绿（新增 4 条，改 1 条）。
- 端到端：281 passed / 7 failed；同一套 7 条在 clean main（`bb5b96d6`）上逐条同名同样红，
  **零回归**。新增用例做过红检：回退守卫并重新构建后，它红在「容器被拖走了 62px」上。
- `lint` / `typecheck` / `build` 全绿；`bun run test` 只剩既有的 storybook `Basics Only`
  一条，在 clean main 上同样红。
