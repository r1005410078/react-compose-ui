## 1. 谓词

- [x] 1.1 `core/curve.ts` 新增 `isComposeClosedCurve`：`polyline && closed`，或
      `arc && isComposeFullCircle`，其余为假
- [x] 1.2 删除 `isComposeRectangleCurve` 与它的导出——唯一的消费者就是这条判据
- [x] 1.3 单元测试：闭合多段线（非矩形顶点数）为真、未闭合折线为假、整圆为真、
      扫掠 90 的弧为假、直线为假

## 2. 选中呈现

- [x] 2.1 `compose-stage.tsx` 的 `selectionOutline` 判据换成 `isComposeClosedCurve`
- [x] 2.2 圆角手柄的判据**不动**（`Composition.presetId` 是矩形 Preset），与本条正交
- [x] 2.3 组件测试：六边形与整圆画盒 + 八手柄、零圆角手柄；未闭合折线与一段弧仍画轮廓

## 3. 端到端

- [x] 3.1 `POLYGON` 画的六边形选中后有选区框与八个手柄、没有轮廓
- [x] 3.2 判别性用例：同一条**闭合**四顶点折线与**未闭合**三顶点折线，前者画盒后者画轮廓
      ——只断多边形会让「按 presetId 判」这种错误实现也绿

## 4. 文档

- [x] 4.1 `AGENTS.md` 那一段从「矩形是第三个答案」改写成「闭合是一般规则、矩形是它的实例」，
      并记下「不用面积占比」的理由

## 5. 验证

- [x] 5.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 5.2 `bun run test:e2e`
- [x] 5.3 `openspec validate update-closed-curve-selection-box --strict`
