# 任务

> 每个行为项必须按 Red → Green → Refactor 完成，并在勾选前记录实际命令、结果和原因。
> 历史提交 `135f8f4` 的执行记录不代表当前 main 的完成状态，不复制其领域模型。

## 1. 规范与架构

- [x] 1.1 修订 proposal、design、全部规范增量与公共包边界
- [x] 1.2 运行 `openspec validate add-linked-component-library --strict` 并记录结果
  - Result: `bunx openspec validate add-linked-component-library --strict`；Change valid。

## 2. First-class Group

- [x] 2.1 [Red → Green → Refactor] Core Group seed、结构校验和公共 TSDoc
  - Red command/result/reason: `bun run --cwd packages/core test -- group.test.ts`；1 test failed；公共 Group seed 工厂不存在。
  - Green/Refactor: `bun run --cwd packages/core test -- group.test.ts`；Group seed、精确组件集合和 legacy 识别全部通过；公共入口与 TSDoc 完成。
- [x] 2.2 [Red → Green → Refactor] Stage Engine Group/Ungroup、legacy 兼容、世界几何和历史往返
  - Red command/result/reason: `bun run --cwd packages/stage-engine test -- commands.test.ts`；2 tests failed；Group 仍写入透明 Container seed，普通 Container 仍可 Ungroup。
  - Green/Refactor: `bun run --cwd packages/stage-engine test -- commands.test.ts`；first-class/legacy Ungroup、坐标归一化和 Undo/Redo 全部通过。
- [x] 2.3 [Red → Green → Refactor] Group 动态后代 bounds、Stage 手柄与命中/吸附反馈
  - Red command/result/reason: `bun run --cwd packages/stage-engine test -- scene-index.test.ts`；1 test failed；Group bounds 仍只读取持久化 LayoutItem。
  - Green/Refactor: `bun run --cwd packages/stage-engine test -- scene-index.test.ts`；可见后代动态并集与空 Group frame fallback 通过；Stage suite 67 tests 通过。
- [x] 2.4 [Red → Green → Refactor] materials 隐藏 Group Preset、Scene Tree/菜单/快捷键图标与可用性
  - Red command/result/reason: `bun run --cwd packages/materials test -- create-basic-materials.test.tsx`；2 tests failed；Registry 尚未注册隐藏 Group Preset。
  - Green/Refactor: `bun run --cwd packages/materials test` 与 `bun run --cwd packages/editor test`；隐藏 Preset、菜单规则、快捷键和语义图标通过。

## 3. Component Asset 与 Store

- [x] 3.1 [Red → Green → Refactor] Base/Variant 判别解析、序列化与显式 legacy 迁移
  - Red command/result/reason: `bun run --cwd packages/core test -- component-asset.test.ts`；4 tests failed；Component Asset 解析、迁移、覆盖和继承 API 均不存在。
  - Green/Refactor: `bun run --cwd packages/core test -- component-asset.test.ts`；严格判别、序列化、显式 legacy 迁移和非法文档拒绝通过。
- [x] 3.2 [Red → Green → Refactor] Variant 稳定操作、diff、继承解析、循环与八层限制
  - Red: `bun run --cwd packages/core test -- component-asset.test.ts`；稳定语义操作与继承解析用例在实现前失败。
  - Green/Refactor: 同一 suite 覆盖 set/remove、Component/子树/reparent、稳定 diff、循环和八层边界；全 Core suite 通过。
- [x] 3.3 [Red → Green → Refactor] Component Store 的 list/read/create/save/resolve/subscribe、取消与冲突
  - Red command/result/reason: `bun run --cwd packages/component-library test -- component-store.test.ts`；3 tests failed；Store factory 尚不存在。
  - Green/Refactor: `bun run --cwd packages/component-library test`；6 files、17 tests 通过，覆盖缓存、订阅、取消、乱序、重名与 revision 冲突。
- [x] 3.4 [Red → Green → Refactor] 混合组件面板、Base/Variant 图标、无 Store 兼容与拖入意图
  - Red command/result/reason: `bun run --cwd packages/component-library test -- compose-component-library-panel.test.tsx`；2 tests failed；混合面板尚不存在。
  - Green/Refactor: `bun run --cwd packages/component-library test`；Preset/Base/Variant 混合目录、无 Store fallback、双击打开与拖入预览通过。

## 4. 实例与创建组件

- [x] 4.1 [Red → Green → Refactor] component-instance seed、离线嵌套 Runtime、属性覆盖与 dispose
  - Red: `bun run --cwd packages/materials test -- component-instance.test.tsx`；隐藏实例 Renderer 与嵌套快照 Runtime 尚不存在。
  - Green/Refactor: `bun run --cwd packages/materials test`；10 files、79 tests 通过，覆盖在线/离线、错误占位、属性覆盖、嵌套上限与释放。
- [x] 4.2 [Red → Green → Refactor] 选区提取、Group 单根归一化、资源写入后原子替换与 Undo/Redo
  - Red: `bun run --cwd packages/stage-engine test -- component-extraction.test.ts`；提取规划器与坐标归一化 API 不存在。
  - Green/Refactor: `bun run --cwd packages/stage-engine test` 与 Editor controller focused tests；虚拟 Group、资源优先、副作用失败分支和历史往返通过。
- [x] 4.3 [Red → Green → Refactor] Stage/Scene Tree/Command Panel/Context Menu 创建入口
  - Red: Editor action/controller tests 在创建命令接线前失败。
  - Green/Refactor: `bun run --cwd packages/editor test`；16 files、162 tests 通过，三个入口共享同一命名请求与可用性规则。
- [x] 4.4 [Red → Green → Refactor] SceneTree 普通行 external drag 与 Asset Browser 通用 external drop
  - Red: SceneTree/Asset Browser focused tests 在 external lifecycle 与注册 type drop 接口缺失时失败。
  - Green/Refactor: `bun run --cwd packages/scene-tree test`、`bun run --cwd packages/asset-browser test` 与 Tree tests 通过；树内移动、树外导出和取消互不混淆。

## 5. Variant 工作区

- [x] 5.1 [Red → Green → Refactor] Base/Variant 独立 Runtime 标签、dirty/save/close/revision conflict
  - Red: `bun run --cwd packages/editor test -- use-component-workspace.test.tsx`；独立会话与冲突结果尚不存在。
  - Green/Refactor: Editor workspace tests 与 162-test package suite 通过，覆盖 dirty/save/close/cancel/force overwrite。
- [x] 5.2 [Red → Green → Refactor] 暴露属性、实例属性覆盖与从实例创建 Variant
  - Red: component override panel 与 instance inspector focused tests 在属性 API 缺失时失败。
  - Green/Refactor: Component Library 与 Editor suites 通过，实例叶子只暴露允许覆盖的属性并可建立 Variant。
- [x] 5.3 [Red → Green → Refactor] 单项/全部 Apply、Revert、partial success 与缓存失效
  - Red: Variant operation tests 在 Apply/Revert 规划器和两阶段保存缺失时失败。
  - Green/Refactor: Component Library 17 tests 与 Editor integration tests 通过，覆盖直接父源、单项/全部、依赖确认、partial success 和失效通知。
- [x] 5.4 [Red → Green → Refactor] pending update、冲突预览和一次事务确认更新
  - Red: update planner tests 在 pending 状态与 stable-ID 冲突列表缺失时失败。
  - Green/Refactor: Variant update tests 通过；更新保持显式，保留旧快照或确认丢弃冲突均一次提交。

## 6. 集成与交付

- [x] 6.1 更新示例、README、根 AGENTS、project.md、包 README、公共 TSDoc 与 Changeset
  - Result: 示例加入 Group、Base/Variant、Provider 离线与 revision 冲突演示；架构边界、完成度、包文档、TSDoc 和 Changeset 已同步。
- [x] 6.2 添加创建组件、跨面板拖拽、Variant、离线/冲突和视觉图标 Playwright 场景
  - Result: focused Playwright 离线/冲突场景 1 passed；完整 suite 覆盖创建、跨面板拖拽、Undo/Redo、Revert/Apply 和视觉黄金图。
- [x] 6.3 运行 lint、typecheck、test、build、test:e2e、pack dry-run 与 strict OpenSpec 校验
  - Result: `bun run lint` 通过；`bun run typecheck` 42/42 tasks；`bun run test` 41/41 tasks（含 Storybook 19 files、45 tests）；`bun run build` 22/22 tasks；`bun run test:e2e` 50/50；`bun run pack:dry-run` 全包通过；`bunx openspec validate add-linked-component-library --strict` Change valid。
