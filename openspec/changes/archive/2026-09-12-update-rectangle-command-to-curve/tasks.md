## 1. 命令会话

- [x] 1.1 `createStageRectangleSession` 的 `preview` 与提交共用同一个几何构造，产出四顶点
      闭合多段线；两点在任一轴上重合仍 `rejected` 且不结束会话
- [x] 1.2 单元测试：提交效果里有 `curves` 且没有 `boxes`；四个顶点按左上起顺时针；
      `closed` 为 true；退化两点被拒绝

## 2. 拆掉盒那条路径

- [x] 2.1 删 `StageDraftingEffect.boxes`
- [x] 2.2 删 `createStageDraftingBoxCommand`，保留 `entityFromDrawingSeed` 与
      `boundsInParentSpace`（拖拽绘制容器与文字仍在用）
- [x] 2.3 删 `use-stage-drafting` 的盒落地循环与预览里的盒→折线换算

## 3. 端到端

- [x] 3.1 重写 `e2e/rectangle-material.spec.ts`：场景树里是 Curve 而不是 Rectangle
- [x] 3.2 取第二点之前的预览仍是闭合矩形轮廓（五个点、首尾相同），不是一条对角线
- [x] 3.3 双击画出来的矩形进入几何编辑，夹点显形

## 4. 文档

- [x] 4.1 `AGENTS.md`：改写「`RECTANGLE` 命令产出的是矩形物料」那段决定，保留「按 kind
      反推是错的」那半句——它管的是 `Curve` 协议内部要不要另立 `rect`，与本变更无关
- [x] 4.2 `openspec/specs` 里所有说「矩形产出盒」的地方

## 5. 验证

- [x] 5.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 5.2 `bun run test:e2e`
