# 任务

## 1. 求解放开到多段线

- [x] 1.1 `resolveWireGeometry` 认 `polyline`：把绑定端写进**首顶点或末顶点**，其余顶点原样
      保留；`line` 分支行为一字不变
- [x] 1.2 Vitest：四顶点多段线只动被绑的那一端，中间拐点与另一端一个都不动
- [x] 1.3 Vitest：两端都绑时首尾各自落到自己的端口上，中间不动

## 2. WIRE 改连续取点

- [x] 2.1 `WIRE` 从两点会话工厂拆出来，改用 `PLINE` 那条攒点路径：`Enter` 结束、`U` 放弃上
      一点、`Escape` 放弃整条
- [x] 2.2 取够两点之前 `Enter` 以 `rejected` 表达，不提交
- [x] 2.3 提交效果里两点写 `line`、三点及以上写 `polyline`；`wire` 标记照旧
- [x] 2.4 绑定只取首尾两个顶点的来源（`wireBindingsFor` 认多段线）
- [x] 2.5 `ARROW` 保持两点，工厂拆开之后行为一字不变
- [x] 2.6 Vitest：取三点得到一个三顶点 polyline Entity；一个点时回车被拒；`U` 回退顶点

## 3. 端点记号

- [x] 3.1 `collectStageWireEnds` 认 `polyline`，端点取首尾两个顶点
- [x] 3.2 组件测试：四顶点导线只在首尾画记号

## 4. 端到端

- [x] 4.1 e2e：`WIRE` 画一条带一个拐点的直角导线（起点吸端口、中间点、终点），
      移动符号后首顶点跟着走而拐点不动
      —— 复用 `port-reveal-and-wire-ends.spec.ts` 已建好的夹具与取景

## 5. 文档

- [x] 5.1 `AGENTS.md`：把「v1 只支持 `kind: 'line'`，没有拐点」改写成「连续取点、首尾绑定、
      不做自动路由」，并记下为什么不做「保持正交」的补偿（两端都可能绑定 + 半条路由规则不可
      预测）
- [x] 5.2 `docs/drafting-interaction-sdd.md` §3.2 的 `WIRE` 小节同步

## 6. 验证

- [x] 6.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 6.2 `bun run test:e2e`（先 `bun run build`——e2e 跑的是预构建产物）
