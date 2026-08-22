# 任务：绘制接上吸附，几何数值统一 2 位精度

## 1. core：精度约定

- [x] 1.1 新增 `core/src/geometry-precision.ts`：`COMPOSE_GEOMETRY_PRECISION`、
      `roundComposeGeometry`、`formatComposeNumber`，从 `core/src/index.ts` 公开
- [x] 1.2 `formatComposeSceneSize` 改走 `formatComposeNumber`
- [x] 1.3 单测：量化残渣、格式化不补零不留尾随零、负数与 0

## 2. stage-engine：绘制吸附与写入量化

- [x] 2.1 `interaction-controller.ts` 绘制起点（pointer.down）与终点（pointer.move）
      各自过一次 `snapResizePoint`，handle 用 `se`（两轴自由），Cmd 禁用
- [x] 2.2 吸附排在 `constrainedDrawingPoints` 之前，Shift 正方形边长仍是网格倍数
- [x] 2.3 `geometry.ts` 的 `toComposeTransform` 量化 position/size/rotation
- [x] 2.4 单测：网格吸附、智能候选吸附、Cmd 禁用、Shift 组合、量化
- [x] 2.5 既有绘制用例的期望值改为吸附后的结果；Shift 正方形的终点角改为吸附落点
      （与 resize 一致，光标只是引导）

## 3. 显示精度

- [x] 3.1 `property-panel` 的 `SemanticNumberInput`：显示走本地格式化，
      未编辑失焦不提交（本地实现 + 边界注释）
- [x] 3.2 `materials` 的 `InspectorNumberDraftInput` 与 `AxisSizingControl`：显示走
      `formatComposeNumber`
- [x] 3.3 单测：长尾小数按 2 位显示、点一下不产生事务、编辑后按输入值提交

## 4. 验证

- [x] 4.1 `bun run lint && bun run typecheck && bun run test && bun run build`
- [x] 4.2 `bun run test:e2e`
- [x] 4.3 e2e：非 100% 缩放下绘制容器，Inspector 读数为网格倍数且无长尾小数
- [x] 4.4 同步 AGENTS.md（绘制吸附与几何精度约定）
