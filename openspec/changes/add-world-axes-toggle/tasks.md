## 1. stage
- [x] 1.1 `ComposeStagePolicy.worldAxes`（默认 true）透传给 `StageWorldUnderlay`
- [x] 1.2 关闭时轴线与原点标记都不渲染；网格与场景边界不受影响
- [x] 1.3 用例：关闭时两者都不在，网格仍在

## 2. editor
- [x] 2.1 `ComposeEditorPreferences.showWorldAxes`、默认值与规范化
- [x] 2.2 controller 把它并进 `stagePolicy`
- [x] 2.3 设置 › 画布 新增「世界坐标轴」一节；中英文案；搜索能命中
- [x] 2.4 用例：规范化、设置里勾掉之后画布上两者都消失

## 3. 验证
- [x] 3.1 `openspec validate add-world-axes-toggle --strict`
- [x] 3.2 `bun run lint && bun run typecheck && bun run test && bun run build`
- [x] 3.3 `bun run test:e2e`
