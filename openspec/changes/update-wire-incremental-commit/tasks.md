# 任务：导线每点一下就落地

- [ ] 1.1 `commands`：`ComposeCommandStep` 的 `cancelled` 分支加可选 `effect`；TSDoc 说明
      它只服务「中途落地过的会话」
- [ ] 1.2 `stage-engine`：`StageDraftingEffect` 加 `replaceLastCreated` 与 `pending` 两个标记
- [ ] 1.3 `stage-engine`：`WIRE` 会话改成每取一个点就提交——第二点新建、之后替换、`U` 收回、
      取消带上「删掉我建的那一个」；预览改成只画待定的那一段
- [ ] 1.4 `stage`：落地那一步支持替换（`entity.curve.set`，父级取当前父级不重算），
      `pending` 时跳过接入节点
- [ ] 1.5 `stage`：取消结果带效果时先落地再决定重开；栈上多记一个顶点数，文档被改小时按差值
      回退会话
- [ ] 1.6 收掉两处与代码矛盾的陈旧规范场景（`WIRE 不再是一条命令`、把 `WIRE` 当两点命令写的
      重开场景）
- [ ] 1.7 单测：会话四个分支（新建/替换/放弃/取消）与预览；宿主的替换与跳过接入
- [ ] 1.8 端到端：画三个点的直角导线，第二个点落下时场景树里就有它；中途路过另一条导线不建
      节点，最后一点落在它上面才建
- [ ] 1.9 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
