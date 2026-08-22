# 任务

## 1. core：Curve Component 与校验

- [x] 1.1 `ComposeCurve` 类型（`kind: 'line'`，盒局部 `start`/`end`）与
      `COMPOSE_BUILTIN_COMPONENT_KEYS.curve`，getter `getComposeCurve`
- [x] 1.2 校验：`Curve` 出现时几何字段必须有限；必须与 Renderer 组合；不得与 Hierarchy 组合
- [x] 1.3 测试钉住：不含 Curve 的既有文档校验结果不变；含 Curve 的合法/非法文档各一
- [x] 1.4 `schemaVersion` 保持 7，迁移器不动

## 2. core：几何写入漏斗

- [x] 2.1 内建命令：设置端点 → 写 `Curve` + 重算 `LayoutItem` 紧包围盒（退化轴钳 1）+
      归一化 offset，一个事务
- [x] 2.2 量化走 `roundComposeGeometry`；撤销一步回到原几何
- [x] 2.3 单测：普通线、水平线（退化轴）、撤销往返

## 3. stage-engine：距离窄相位

- [x] 3.1 `entityAtPoint` 对带 `Curve` 的 Entity 改用点到线段距离 ≤ 容差（局部坐标）
- [x] 3.2 容差从屏幕像素按 zoom 换算；宽相位 bounds 不动
- [x] 3.3 单测：命中线附近选中、盒内空角不选中、旋转后命中正确、非 100% 缩放下容差正确
- [x] 3.4 修正：Stage 的**点选**是 DOM 驱动的，`entityAtPoint` 只服务取色采样。线状节点
      另由 `.is-segment` + 物料的透明加宽 stroke 承担，判定按 `Curve` Component 而不是
      Renderer 类型（见 design D4）

## 4. materials：curve 物料

- [x] 4.1 Preset「线」+ 默认值（默认斜线）；SVG Renderer，`overflow: visible`
- [x] 4.2 描边 Renderer props（颜色、线宽、线型）与 Valibot Schema、绑定 Contract
- [x] 4.3 Component Definition：端点编辑派发 2.1 的漏斗命令；描边走 Renderer props
- [x] 4.4 组件测：渲染、Inspector 编辑端点、描边变更

## 5. stage / editor：点击添加

- [x] 5.1 Palette「Curve」项，点击添加落进激活场景（不走升格；见 design D8）
- [x] 5.2 场景树、预览零改动即可见
- [x] 5.3 `pointerDrop` helper 补 `scrollIntoViewIfNeeded`——Palette 可滚动，新增 Preset
      会把靠后的物料挤出视口；Palette 黄金图随新增 tile 更新

## 6. 验证

- [x] 6.1 每条新断言先确认去掉实现后变红（窄相位空角断言尤其）
- [x] 6.2 e2e：添加线 → 场景树出现 → 点线附近选中、点盒空角不选中（非 100% 缩放）→
      Inspector 改端点 → 拖动移动 → 撤销 → 预览渲染该线
- [x] 6.3 e2e：给线打位置关键帧并播放（既有动画轨道，证明零改动可用）
- [x] 6.4 五道门槛：`lint` / `typecheck` / `test` / `build` / `test:e2e`
