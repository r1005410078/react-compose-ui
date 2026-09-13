## 1. 偏好与接线
- [x] 1.1 `ComposeEditorPreferences.crosshairReach`、默认值与规范化
- [x] 1.2 `ComposeWorkspaceSession.crosshairSize` 删除，`sessionPort` 不再读写它
- [x] 1.3 controller 的 `crosshairSize` 由编辑器从偏好同步

## 2. 设置面板
- [x] 2.1 十字光标一节拆成「画笔」与「长度」两组，各带说明
- [x] 2.2 画笔说明删掉「贯穿图面」字样；搜索匹配集加入长度相关词；中英文案

## 3. 用例
- [x] 3.1 规范化用例
- [x] 3.2 端到端：设置里选「短」之后画布上的臂真的变短
- [x] 3.3 `e2e/builtin-workspaces.spec.ts` 不再从工作区读臂长

## 4. 验证
- [x] 4.1 `openspec validate add-crosshair-size-preference --strict`
- [x] 4.2 `bun run lint && bun run typecheck && bun run test && bun run build`
- [x] 4.3 `bun run test:e2e`
