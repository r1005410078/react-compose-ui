# Tasks

## 1. 判别性用例先验红

- [x] 1.1 `e2e/curve-vocabulary.spec.ts` 加一条：`ARC` 画一段弧 → 选中 → 拖右下角手柄拉宽到
      约两倍 → 断言描边的**实际触达**跟着变宽。**先跑确认红**——今天几何是绝对用户单位，
      盒变了弧纹丝不动
- [x] 1.2 同一条继续：在拉宽后的线身上点击选中它，在拉宽**前**那条线经过、现在已不经过的
      位置点击不选中。这条验的是命中跟着几何走
- [x] 1.3 两条都在**非 100% 缩放**下取坐标（`?no-auto-fit` + 显式等 surface 可见）：
      `world = (屏幕 − 视口) / 缩放`，缩放为 1 时盒→几何的比例会被视口缩放掩盖

## 2. `core`：唯一的换算入口

- [x] 2.1 新增盒 → 几何变换与它的逆，按轴独立返回两个比例；退化轴用
      `COMPOSE_CURVE_MIN_EXTENT` 钳（与 `LayoutItem` 尺寸同一个常量，不得另取）
- [x] 2.2 单测：非等比盒给出两个不同比例；水平线不除零；变换与逆互为反函数（几何精度内）
- [x] 2.3 `entity.curve.set` 载荷仍是 parent 局部坐标，命令内部经它映射进几何空间——
      **对调用方不变**，否则每个产出曲线的地方都要认识 viewBox
- [x] 2.4 `normalizeComposeCurveGeometry` 一行不改；它保证的「紧包围盒左上角恒为原点」
      现在描述的是几何空间

## 3. `materials`：viewBox

- [x] 3.0 曲线 Preset 去掉 `GeometryConstraints`（`resize: 'none'`），并把那段注释换成本刀
      给出的答案；手柄因此回来
- [x] 3.1 曲线 SVG 加 `viewBox`（紧包围盒，退化轴钳同上）与 `preserveAspectRatio="none"`
- [x] 3.2 两个 `geometryElement`（命中层与描边层）都加 `vector-effect: non-scaling-stroke`
- [x] 3.3 注释写清 `vector-effect` 与 `calc(px / --compose-canvas-zoom)` 各中和哪一段变换，
      并明确既有那句「`non-scaling-stroke` 在这里不管用」说的是**外层 HTML 变换**
- [x] 3.4 组件测试：非等比盒下两个方向的笔画宽度相同；非 100% 画布缩放下实际触达不变

## 4. `stage-engine`：命中与捕捉

- [x] 4.1 `StageSceneIndex.entityAtPoint` 的曲线分支把**几何**变换到世界再算距离，
      容差仍是 `屏幕像素 / 缩放`。**不要**把光标点变换进几何空间——非等比会把圆容差变成椭圆
- [x] 4.2 `findStageFeaturePoint` 同一个变换；端点/中点/圆心/象限点全部跟着走
- [x] 4.3 弧按缩放是否等比分流：等比走闭式解，非等比拍扁成线段。**照抄 `cad` 侧块内弧的
      既有判断**，不另立一套
- [x] 4.4 单测：等比与非等比各一条弧的命中与捕捉；圆心在非等比下仍是特征点

## 5. `stage`：两条路径一致

- [x] 5.1 按**同一组几何数值**两侧各有断言：`materials` 侧验取景框与
      `preserveAspectRatio`，`stage-engine` 侧验同一组数值下新形状命中、旧形状不命中。
      jsdom 里跑不动真正的 DOM 命中，那一半由 e2e 承担
- [x] 5.2 e2e 覆盖盒角空区：拉宽后的曲线，盒角两条路径都不命中

## 6. 回归

- [x] 6.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 6.2 `bun run test:e2e`。**跑之前先确认没有残留的 preview 进程**：上一刀踩过一次，
      残留会让整轮变慢并伪造出「间歇失败」
- [x] 6.3 黄金图：一张没变——既有曲线的盒本来就等于紧包围盒，比例恒为 1，`viewBox` 是恒等
      映射

## 7. 文档

- [x] 7.1 AGENTS.md：把「盒尺寸是几何的派生」改成「`viewBox` 恒等于紧包围盒，盒自由」，
      并补上「命中与捕捉应用同一个变换」「弧按等比与否分流」两条
- [x] 7.2 `docs/drafting-unification-roadmap.md`：步骤 8 拆成 8a/8b，记下拆的理由
      （反过来切会在中间交出一个回归）
