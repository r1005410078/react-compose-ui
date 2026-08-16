## 1. 规格与 Headless 规划器（Red → Green → Refactor）

- [x] 1.1 严格验证提案，并为四种顺序、多选块、跨父级、锁定、边界、Flow 与 Undo 建立 Scenario 测试映射。
- [x] 1.2 Red：添加 stage-engine 层级规划器单测，记录当前缺少公共操作和命令的预期失败。
- [x] 1.3 Green：实现操作类型、availability 与原子 move/batch 规划，仅修改同级 Hierarchy 顺序。
- [x] 1.4 Refactor：统一父级分组、连续块与稳定分区逻辑，补齐公共 TSDoc 和包入口。

## 2. Stage 与 Editor 入口（Red → Green → Refactor）

- [x] 2.1 Red：添加 Stage 默认键位、宿主接管、右键子菜单及 Editor 动作目录/偏好/双语契约测试。
- [x] 2.2 Green：接入四个 shortcut action、Figma 默认键位、层级子菜单和共享动作执行层。
- [x] 2.3 Refactor：统一菜单与动作 availability，保持选择、History、输入隔离及旧偏好 normalization。

## 3. 浏览器流程与交付

- [x] 3.1 Red/Green：用重叠节点验证菜单与快捷键改变前景命中、场景树同步及 Undo 恢复。
- [x] 3.2 检查菜单 actual/diff 后更新并审核确定性视觉黄金。
- [x] 3.3 运行 OpenSpec strict validation、lint、typecheck、test、build、完整 E2E 与 diff check，记录结果。

## 验证记录

- Stage Engine Red：`commands.test.ts` 新增用例因公共规划器尚未实现而失败；Green 后 18 条命令测试通过。
- Stage/Editor Red：新增快捷键、菜单、偏好与动作目录用例分别按预期失败；Green 后 Stage 62 条、Editor 152 条测试通过。
- `openspec validate add-stage-layer-order-actions --strict`、`bun run lint`、`bun run typecheck`、`bun run build` 与 `git diff --check` 通过。
- 完整 Playwright：新增层级流程和黄金图通过，总计 47/48 通过；唯一失败仍为既有 `integration.spec.ts:564` 场景树遮挡 Stage 点击基线问题，与本变更无关。
- `bun run test` 的本次相关包全部通过；全仓并发下既有 Monaco tokenizer 用例触发 5 秒超时，单独运行 1/1 通过，Storybook 浏览器测试单独运行 44/44 通过。
