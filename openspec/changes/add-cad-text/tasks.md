# 任务

## 1. 几何

- [x] 1.1 `CadTextGeometry` 与伞类型 `CadGeometry = CadCurve | CadTextGeometry`
- [x] 1.2 `CAD_TEXT_ADVANCE_RATIO` / `ASCENT` / `DESCENT` 三个比例常数，与图面字体栈成对
- [x] 1.3 `cadTextCorners`：按对齐与旋转求四角
- [x] 1.4 `pointToTextDistanceSquared`：框内为 0，框外取到框边的距离
- [x] 1.5 `textBounds`：四角的轴对齐盒
- [x] 1.6 `pointToGeometryDistanceSquared` / `geometryBounds` / `geometryWithinBounds` /
      `geometryCrossesBounds` / `geometryNearPoint` 接入文字分支

## 2. 协议

- [x] 2.1 `CadText` Component、`getCadText`、`createCadTextEntity`
- [x] 2.2 校验：`content` 非空、`height` 为正、`rotation` 有限、`align` 是三个之一

## 3. 遍历与消费者

- [x] 3.1 `collectCadVisibleCurves` → `collectCadVisibleGeometry`，返回 `CadGeometry`
- [x] 3.2 块内文字：跟随实例变换（等比缩放字高；非等比按 x 轴，文字不是曲线，不拍扁）
- [x] 3.3 `findCadHit` / `findCadEntitiesInBounds` 按 `CadGeometry` 分派
- [x] 3.4 `insertion` 捕捉模式：文字锚点与块实例插入点
- [x] 3.5 `translateCadEntity` 的文字分支（只移锚点）

## 4. 命令

- [x] 4.1 `TEXT` / `T` 会话：插入点 → 字高（回车/键入/指点）→ 内容；空内容拒绝
- [x] 4.2 i18n 文案与命令注册

## 5. 画布

- [x] 5.1 `<text>` 渲染：等宽字体栈、`text-anchor` 对齐、旋转 transform、禁止选中
- [x] 5.2 插入点捕捉标记

## 6. 验证

- [x] 6.1 单测：四角与旋转、框内距离为 0、框选、校验、块内变换、会话三步
- [x] 6.2 组件测：画字、命中框与字形一致、插入点捕捉
- [x] 6.3 e2e：非 100% 缩放下写一条标注并选中它
- [x] 6.4 每条新断言先确认去掉实现后变红
- [x] 6.5 五道门槛一起跑：`lint` / `typecheck` / `test` / `build` / `test:e2e`
