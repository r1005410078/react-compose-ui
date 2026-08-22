# 任务

## 1. 几何

- [x] 1.1 `CadArcShape` 与 `CadCurve` 联合（`kind: 'segment' | 'arc'`）
- [x] 1.2 `pointToArcDistanceSquared`：角度在扫掠内取到圆的距离，否则取端点较小者
- [x] 1.3 `arcBounds`：紧包围盒，判四个轴向极值角是否落在扫掠内
- [x] 1.4 `flattenCadArc`：按弦高误差分段
- [x] 1.5 `arcPointAt` / `arcEndpoints` / `arcQuadrants` / `arcMidpoint`
- [x] 1.6 `circleThroughPoints`：三点外接圆，共线返回 `null`
- [x] 1.7 `curveNearPoint` / `curveWithinBounds` / `curveCrossesBounds` 统一入口

## 2. 协议

- [x] 2.1 `CadArc` Component、`getCadArc`、`createCadArcEntity`
- [x] 2.2 校验：`entity.invalid-geometry` 覆盖半径与角度

## 3. 遍历与消费者

- [x] 3.1 `collectCadVisibleSegments` → `collectCadVisibleCurves`，返回 `CadCurve`
- [x] 3.2 块展开：等比（含镜像）→ 精确弧；非等比 → 拍扁
- [x] 3.3 `findCadHit` / `findCadEntitiesInBounds` 按 `CadCurve` 分派
- [x] 3.4 `findCadSnap`：`center` / `quadrant` 模式与弧的端点、中点
- [x] 3.5 `translateCadEntity` 的圆弧分支（只移圆心）

## 4. 命令

- [x] 4.1 `CIRCLE` / `C` 会话与命令定义
- [x] 4.2 `ARC` / `A` 会话：三点定弧，共线拒绝且不结束
- [x] 4.3 i18n 文案与命令注册

## 5. 画布

- [x] 5.1 圆弧渲染：`|sweep| >= 360` 用 `<circle>`，否则 `<path>` 的 `A` 命令
- [x] 5.2 圆心与象限点捕捉标记

## 6. 验证

- [x] 6.1 单测：距离闭式解、紧包围盒、三点外接圆、镜像翻转、非等比降级、两条会话
- [x] 6.2 组件测：画圆画弧、圆心捕捉、整圆与弧的渲染分支
- [x] 6.3 e2e：非 100% 缩放下画圆、捕圆心、框选一段弧
- [x] 6.4 每条新断言先确认去掉实现后变红
- [x] 6.5 五道门槛一起跑：`lint` / `typecheck` / `test` / `build` / `test:e2e`

## 7. 过程中发现的缺陷

- [x] 7.1 **提交点的捕捉沿用了上一帧 hover 的结果**。`pointerdown` 可能赶在 React 为上一次
      `pointermove` 重渲染之前到达，那时 `indicated.snap` 还停在旧位置，落点被吸回用户已经
      离开的特征点上。画圆时的症状是「半径不能为零」——圆心与半径点被吸到同一处。
      改为按**这次按下自己的坐标**重算捕捉（`resolveCommittedPoint`），拖动预览与提交也
      共用这一个函数。
- [x] 7.2 该缺陷**只有 e2e 拦得住**：jsdom 里 `fireEvent` 每次都会 flush，pointerdown 与
      pointerup 之间 React 已经重渲染，因此写出来的组件测试加不加修复都是绿的。
      已删掉那条不判别的用例——看起来像覆盖率的假测试比没有测试更糟。
- [x] 7.3 **整圆不该有端点与中点候选**。它们只是「起始角写在哪」的产物，一次等价重写就会
      跳到别处；AutoCAD 对圆同样只给圆心与象限点。由「扫掠外的象限点」那条用例带出来。
