# 任务

## 1. 先红

- [x] 1.1 `e2e/polyline-grips.spec.ts`：三顶点多段线出 3 个顶点夹点 + 2 个中点夹点
- [x] 1.2 同文件：拖中点夹点后几何有 4 个顶点，新顶点落在落点上
- [x] 1.3 同文件：中点夹点与顶点夹点渲染成不同形状
- [x] 1.4 同文件：直线的中点夹点仍是平移（护栏）
- [x] 1.5 跑 1.1–1.3 确认**都红**；1.4 确认绿

## 2. stage-engine

- [x] 2.1 多段线的 `localGrips` 补段中点（闭合时含收尾段），id 为 `m{段下标}`
- [x] 2.2 `StageCurveGrip` 加 `role` 与可选 `angle`
- [x] 2.3 `applyStageCurveGrip` 认识 `m{i}`：在第 `i` 段中间插入一个顶点并置于落点
- [x] 2.4 单元用例：插入位置、闭合收尾段、每次只插一个、直线不受影响

## 3. stage

- [x] 3.1 `StageEditablePathVertex` 加 `role` 与 `angle`，几何编辑把夹点的原样带上
- [x] 3.2 覆盖层按 `role` 画方块或条形，条形按 `angle` 旋转
- [x] 3.3 样式：曲线夹点方块、中点条形；运动路径的菱形不动

## 4. 文档

- [x] 4.1 `AGENTS.md`：段中点的用途从「留给顶点增删」变成「已兑现」；形状的判据
- [x] 4.2 `docs/drafting-unification-roadmap.md` 记一条

## 5. 五道门

- [x] 5.1 `bun run lint`
- [x] 5.2 `bun run typecheck`
- [x] 5.3 `bun run test`
- [x] 5.4 `bun run build`
- [x] 5.5 `bun run test:e2e`

## 6. 观察项

- [x] 6.1 `snapping-angles` 断言闭合矩形有 4 个夹点，改成 8（四顶点 + 四段中点）
- [x] 6.2 黄金图零变红：几何编辑会话不在任何一张里
- [x] 6.3 `stage-interactions` 的层级操作那条：它在同一个点上连点四下，相邻两下被判成双击而
      进入几何编辑，而取样点正是矩形**上边中点**——那里现在有夹点，点击被它吃掉。取样点改到
      四分之一处。这是真实的产品后果而不只是测试问题
- [x] 6.4 `boundingBox()` 量不出条形：它是转过角度的，Playwright 给的是旋转后的轴对齐外框，
      45 度的条形算出来接近正方形。改成量 `width`/`height` 属性并单独断旋转角
