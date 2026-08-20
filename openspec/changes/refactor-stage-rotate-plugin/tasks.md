# 任务：把旋转工具拆成交互插件

- [x] 1.1 `StageSession.cancel` 接收 ctx；pan 与 rotate 的 cancel 各自还原快照并释放捕获
- [x] 1.2 新增 `isCompatibleWith` 与 `arbiter.revalidate`，接进 `updateContext`
- [x] 1.3 新增 rotate 插件：三条 claim 路径、拉线预览、提交复用 `planTransformCommit`
- [x] 1.4 legacy 删除全部 rotate 分支（claim / update / startTransform / 联合变体 / 提交类型）
- [x] 2.1 插件与契约单测 9 例：三条 claim 路径、标尺不接管、拖动预览与单条提交、
      文档变化与工具切换各自中止、未实现 `isCompatibleWith` 时始终成立
- [x] 3.1 `interaction-controller.ts` 2621 → 2509 行（净减 112）
- [x] 3.2 lint、typecheck 46/46、test 45/45（stage-engine 235，内核 50）、build 24/24、e2e 99/99
- [x] 3.3 `interaction-controller.test.ts` 2225 行一行未改
