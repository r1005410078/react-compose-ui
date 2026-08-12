# 任务

## 1. SceneIndex 容器命中排除

- [ ] 1.1 红测：`containerAtPoint` 传入排除集合时不返回集合内 Entity 及其后代
- [ ] 1.2 `containerAtPoint` 增加可选排除参数，实现自身/后代过滤

## 2. 跨容器 reparent 会话

- [ ] 2.1 红测：指针进入容器包围盒内部达到判定比例才产生候选目标 effect
- [ ] 2.2 红测：贴边掠过不产生候选目标，Pointer Up 只更新原父级内坐标
- [ ] 2.3 红测：候选目标提交前失效（锁定/删除/变为非容器）时不提交
- [ ] 2.4 红测：多选拖拽的相对顺序与祖先/后代去重规则与场景树批量移动一致
- [ ] 2.5 `StageInteractionController` 的 `move` 手势实现候选目标判定与 effect，复用
      `createReparentCommand` 的 Flow/Absolute 默认判定，不新增分支
- [ ] 2.6 Escape / 失去指针捕获时清除候选目标且不提交

## 3. Auto Layout 容器内原地重排

- [ ] 3.1 红测：nowrap 容器内拖动 Flow 子级、未越界时只发 `moveEntity`，不发 Transform 命令且
      LayoutItem 不变
- [ ] 3.2 红测：插入位置与原顺序一致时不提交任何命令
- [ ] 3.3 红测：拖动中随指针发布插入位置 effect，且不产生文档事务
- [ ] 3.4 红测：多选混合目标（同容器 Flow + 容器外目标）在一次 Pointer Up 内按各自规则提交
- [ ] 3.5 红测：拖出 nowrap 容器边界后按既有规则烘焙 Absolute
- [ ] 3.6 红测：wrap/wrap-reverse 容器维持现状，拖动即烘焙 Absolute
- [ ] 3.7 实现主轴中点比较得到插入位置，接入 `move` 手势 finish 分支；重排走 `moveEntity`，
      `packages/core/src/builtin-commands.ts` 不需要改动

## 4. Stage 落点反馈

- [ ] 4.1 Overlay 渲染候选容器高亮描边
- [ ] 4.2 Overlay 按 Controller 发布的插入位置渲染容器内重排落点指示
- [ ] 4.3 候选目标清除或提交/取消后两种反馈立即消失
- [ ] 4.4 回归确认：被拖动目标自身的选中框与变换手柄呈现未发生变化

## 5. 端到端

- [ ] 5.1 e2e：把节点拖进容器中心，验证 reparent 到该容器且获得默认 Flow/Absolute
- [ ] 5.2 e2e：把节点拖过容器边缘但不深入，验证不 reparent
- [ ] 5.3 e2e：nowrap 容器内拖动重排两个子级顺序，验证只改 Hierarchy 顺序
- [ ] 5.4 e2e：把 nowrap 容器内的子级拖出容器，验证烘焙为 Absolute

## 6. 验证

- [ ] 6.1 `bun run lint && bun run typecheck && bun run test && bun run build`
- [ ] 6.2 `bun run test:e2e`
- [ ] 6.3 `openspec validate add-stage-container-drop --strict`
