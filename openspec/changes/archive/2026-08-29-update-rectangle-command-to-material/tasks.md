## 1. 引擎

- [x] 1.1 `StageDraftingEffect` 新增 `boxes?: readonly StageRect[]`
- [x] 1.2 `RECTANGLE` 的 `preview` 与提交改用 `boxes`
- [x] 1.3 用例：预览与提交都返回盒，且不含 `curves`

## 2. 宿主

- [x] 2.1 `createStageDraftingBoxCommand`：复用 `entityFromDrawingSeed` 与 `boundsInParentSpace`
- [x] 2.2 `commit` 循环 `effect.boxes`
- [x] 2.3 预览轮廓认识 `boxes`

## 3. 测试

- [x] 3.1 组件测试：`R` 画出来的是 `rectangle` 物料，带 `Appearance`，没有 `Curve`
- [x] 3.2 组件测试：预览轮廓在取第二点前就是一个矩形
- [x] 3.3 端到端：画出来的矩形在场景树里是「矩形」而不是「Curve」

## 4. 验证

- [x] 4.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 4.2 `bun run test:e2e`
