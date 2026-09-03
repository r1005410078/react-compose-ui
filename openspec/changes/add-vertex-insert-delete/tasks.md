# 任务：几何编辑会话内插入与删除顶点

- [ ] 1.1 `core`：三次贝塞尔的 de Casteljau 分割（给定 `t` 分成两段，形状不变）与单测
- [ ] 1.2 `stage-engine`：段上落点 → 插入顶点的纯函数，覆盖 `line`（同时换 kind 成 `polyline`）、
      `polyline`（含闭合的收尾段）与 `path`（分割那一段）
- [ ] 1.3 `stage-engine`：删除顶点的纯函数，相邻段合并；下限校验（每条轮廓至少两个顶点）
- [ ] 1.4 弧不受理，两个操作都以 `rejected` 说明
- [ ] 1.5 `stage`：会话内双击段触发插入，落点走既有解算（吸附/捕捉/动态输入照旧）
- [ ] 1.6 `stage`：会话内有夹点被作用着时 `Delete`/`Backspace` 删顶点；否则照旧删 Entity 的
      分级用例
- [ ] 1.7 写入走 `entity.curve.set`，撤销一步回到原几何与原 kind
- [ ] 1.8 端到端：矩形上双击一条边加点、拖走；再删掉它回到四顶点
- [ ] 1.9 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
