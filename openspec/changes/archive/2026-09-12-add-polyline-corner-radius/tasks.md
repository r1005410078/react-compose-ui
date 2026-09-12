## 1. 协议与几何（core）

- [x] 1.1 `ComposePolylineCurve.cornerRadius?: number`；校验要求在场时是有限正数
- [x] 1.2 `composeRoundedPolylineOutline`：有序轮廓片段（缩短直段 + 角弧），按角平分线求切点
      与圆心，逐角钳到相邻两段长度的一半
- [x] 1.3 `composeCurveSegments` / `distanceToComposeCurve` / `isPointInsideComposeCurve`
      改读轮廓片段
- [x] 1.4 单元测试：矩形四角圆到相邻边一半时不重叠、共线角不圆、开放折线两端不圆、
      钳制不回写、缺席时逐字段与今天相同

## 2. 渲染（materials）

- [x] 2.1 `cornerRadius` 在场时走 `<path>`，缺席时一个字节不变
- [x] 2.2 Inspector 的「圆角」数值字段
- [x] 2.3 组件测试：圆角在场时是 `<path>`、缺席时仍是 `<polygon>`

## 3. 手柄与读数（stage）

- [x] 3.1 命中类型与插件：圆角手柄排在缩放手柄之上
- [x] 3.2 手柄层：空心圆 + 垫底描边，位置取角弧圆心；重合时不画
- [x] 3.3 拖动求解：指针到角顶点的距离沿角平分线投影出半径，四角同写一个值，
      走 `entity.curve.set`
- [x] 3.4 半径读数：被量的那一段是圆心到弧上，复用既有标注摆位

## 4. 端到端

- [x] 4.1 选中矩形四个圆角手柄显形
- [x] 4.2 拖一个手柄四个角同时圆，撤销一步回到尖角

## 5. 文档与验证

- [x] 5.1 `AGENTS.md` 与 `openspec/specs`
- [x] 5.2 `lint` / `typecheck` / `test` / `build` / `test:e2e`
