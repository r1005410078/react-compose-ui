# 任务

判别性断言先验红：断言在既有实现下必须失败，且失败原因正是本条要建立的行为。

## 1. core · 弧的形状运算（搬运）

- [x] 1.1 `cad-arc-geometry.ts` 搬进 `core`（角度包含判定、点到弧距离、象限包围盒、
      三点定弧、拍扁），`cad` 侧改别名转导
- [x] 1.2 `cad-polyline-geometry.ts` 同上
- [x] 1.3 **CAD 既有用例不改一行即全绿**——改了一行就说明搬运顺手改了语义

## 2. core · 协议扩展

- [x] 2.1 红：`arc` 与 `polyline` 通过校验；扫掠为 0、半径非正、顶点少于两个被拒
- [x] 2.2 红：跨象限的弧归一化后盒覆盖该象限点（**只用端点算会漏**）
- [x] 2.3 红：整圆是 `sweep` 绝对值 360 的弧；矩形是四顶点 `closed` 多段线
- [x] 2.4 红：既有 `line` 文档校验与归一化逐字段不变（零迁移护栏）
- [x] 2.5 绿：`ComposeCurve` 三元联合；`composeCurveBounds` / `translateComposeCurve` /
      `distanceToComposeCurve` / `composeCurvePoints` / 校验逐 kind 分派
- [x] 2.6 `entity.curve.set` 覆盖全部 kind，仍是唯一漏斗

## 3. stage-engine · 命中与捕捉

- [x] 3.1 红：弧的圆心与扫掠内象限点作为候选返回
- [x] 3.2 红：多段线中间顶点按**端点**优先级返回
- [x] 3.3 红：点击弧包围盒内远离弧身处不命中（非 100% 缩放下断言）
- [x] 3.4 绿：`findStageFeaturePoint` 逐 kind 分派；窄相位调用点**一行不改**
- [x] 3.5 既有直线捕捉用例全绿

## 4. materials · 渲染与 Inspector

- [x] 4.1 红：整圆渲染成 `circle` 而不是起终点重合的 `path`
- [x] 4.2 红：四顶点多段线在图面上是**一个**元素
- [x] 4.3 绿：Renderer 逐 kind 出 SVG，透明加宽 stroke 照旧承担命中
- [x] 4.4 Inspector 逐 kind 呈现几何字段，全部走漏斗命令

## 5. stage-engine · 四条命令

- [x] 5.1 红：`PLINE` 取四点结束后只产出**一个** Entity
- [x] 5.2 红：`PLINE` 的放弃关键字回退一个顶点且此时尚无文档事务
- [x] 5.3 红：`ARC` 三点共线时 `rejected` 且不结束会话
- [x] 5.4 绿：`ARC` / `CIRCLE` / `REC` / `PLINE`，接进 `createStageDraftingCommands`
- [x] 5.5 `StageDraftingEffect` 承载新几何；宿主的创建路径复用既有归一化漏斗

## 6. 端到端

- [x] 6.1 纵向：绘图模式 `C↵` 画圆 → `REC↵` 画矩形 → `ARC↵` 画弧 → 切设计模式，
      场景树三行、各自可选中可撤销
- [x] 6.2 圆心捕捉：第二个圆的圆心吸到第一个圆的圆心（**非 100% 缩放**下断言）
- [x] 6.3 弧上打旋转关键帧并绕基点摆动——新词汇一落地就接上步骤 3 的闭环

## 7. 五道门 + 文档

- [x] 7.1 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
- [x] 7.2 路线图回填 4a 结果
- [x] 7.3 AGENTS.md：三元联合、整圆/矩形两条判断、弧的象限包围盒、多段线是一个 SVG 元素
