# 任务

## 1. 先红

- [x] 1.1 新增 `e2e/curve-selection-outline.spec.ts`：选中斜线不出选区矩形与 Resize 手柄
- [x] 1.2 同文件：轮廓沿几何而不是沿盒（取轮廓采样点，验证包围盒四角处没有轮廓）
- [x] 1.3 同文件：`scale` 工具下矩形与手柄回来（改前应绿，防误删）
- [x] 1.4 同文件：单选矩形 Entity 仍画盒（改前应绿，防扩大）
- [x] 1.5 同文件：多选线加矩形仍画整体框（改前应绿）
- [x] 1.6 跑 1.1 与 1.2，确认**都红**

## 2. stage

- [x] 2.1 宿主派生：单选一条曲线且 `tool === 'select'` 时算 `stageCurveOutline`，其余为 null
- [x] 2.2 `overlay-types` 增一个世界折线输入，TSDoc 写明「覆盖层不认识文档」这条边界
- [x] 2.3 `SelectionLayer`：有轮廓时画折线，没有时照旧画矩形
- [x] 2.4 `ResizeHandlesLayer`：轮廓生效时一并让位（手柄与四条边缘带）
- [x] 2.5 组件用例覆盖三态：曲线 + select、曲线 + scale、矩形 + select

## 3. 文档

- [x] 3.1 `AGENTS.md` 把「盒不是曲线的轮廓」那条从几何编辑扩到普通选中，并写下判据的三个答案
- [x] 3.2 `docs/drafting-unification-roadmap.md` 记一条

## 4. 五道门

- [x] 4.1 `bun run lint`
- [x] 4.2 `bun run typecheck`
- [x] 4.3 `bun run test`
- [x] 4.4 `bun run build`
- [x] 4.5 `bun run test:e2e`（含 1.1/1.2 转绿，1.3–1.5 仍绿）

## 5. 观察项

- [x] 5.1 39 处断言盒或手柄，只有 6 条涉及曲线。逐条判过：
      - `curve-vocabulary` 那条真的在拖盒手柄 → 切到 `scale` 工具（并在后续的点击断言前切回
        `select`，否则 `scale` 下按下的语义是缩放，点什么都不会发生）。
      - 其余五条只是拿盒当选中的证据 → 改断轮廓。
      - 其中两条改完之后变成**恒真**（曲线在 `select` 下本来就没有盒手柄），换成了真正有
        判别力的断言。
- [x] 5.2 踩到两处，都不是缺陷而是断言写错：
      - 几何编辑态的轮廓由**可编辑路径层**画，选区层让位（否则两条重叠出更粗的线）；
        断「轮廓还在」要断那一层的元素。
      - 竖直线的轮廓折线包围盒宽度为零，Playwright 把零面积当作不可见，断它必须用
        `toHaveCount` 而不是 `toBeVisible`。

## 6. 交付记录

- 五道门全绿：lint / typecheck（54）/ test（53）/ build（28）/ e2e **159 passed**。
- 文档零改动：盒仍在 `LayoutItem` 里，命中、框选、Auto Layout、Inspector、动画一行未动。
- 「曲线几何编辑会话」的 Scenario「退出会话恢复手柄」随之失效并改写：退出后回到的是**轮廓**，
  而曲线是唯一能进入几何编辑的类型，因此那条 Scenario 在改后完全不成立。
