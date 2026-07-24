## 1. 规范与公共协议

- [x] 1.1 审批 `compose-document`、`command-transaction` 与 `command-panel` 增量并通过 strict validate
- [x] 1.2 为全部新增公共 API 编写 TSDoc，并建立 core 与 command-panel 包导出/构建基座

## 2. 文档模型 Red → Green → Refactor

- [x] 2.1 Red：按 OpenSpec Scenario 编写 JSON 值、合法多 Frame 文档、拓扑、变换和错误路径测试
  - Red command/result/reason：`bun run --cwd packages/core test -- document.test.ts`，
    9/9 失败；`validateComposeDocument` 尚未导出。
- [x] 2.2 Green：实现最小 `ComposeDocument` 类型与 `validateComposeDocument`
  - Green command/result：同一命令 9/9 通过。
- [x] 2.3 Refactor：提取无 React/DOM 的索引与遍历辅助函数并记录 Red/Green/Regression 证据
  - Regression command/result：`bun run --cwd packages/core test`，包含负世界坐标映射在内
    33/33 通过。

## 3. Patch 与原子运行时 Red → Green → Refactor

- [x] 3.1 Red：覆盖四种 Patch、inverse、候选重验、handler rejection/exception 和原子失败
  - Red command/result/reason：`bun run --cwd packages/core test -- runtime.test.ts`，
    12/12 失败；`createTransactionRuntime` 尚未导出。
- [x] 3.2 Green：实现 Patch 应用、inverse 捕获、handler registry 与同步 dispatch
  - Green command/result：同一命令 12/12 通过。
- [x] 3.3 Refactor：统一 issue/result/event 判别联合并记录 Red/Green/Regression 证据
  - Regression command/result：新增 failure event 与异步副作用失败测试后，core 33/33 通过。

## 4. 事务历史 Red → Green → Refactor

- [x] 4.1 Red：覆盖 undo、redo、navigate、redo 分支截断、750ms 合并、100 条裁剪和 reset
  - Red command/result/reason：`bun run --cwd packages/core test` 在新增“不合并结构操作”
    Scenario 后 1/33 失败；历史中间提交被错误标为 `coalesced: true`。
- [x] 4.2 Green：实现事务时间线、结构兼容的导航 controller、可注入 ID factory 与 clock
  - Green command/result：提交前保存 `wasAtTimelineEnd`，分支提交不再合并，33/33 通过。
- [x] 4.3 Refactor：验证 Strict Mode/订阅稳定性并记录 Red/Green/Regression 证据
  - Regression command/result：`bun run --cwd packages/core typecheck` 与 `lint` 均通过。

## 5. 内置命令 Red → Green → Refactor

- [x] 5.1 Red：覆盖 Frame/Group/Component 创建、删除、复制、重命名、重排、移动、显隐和锁定
  - Red command/result/reason：`bun run --cwd packages/core test -- builtin-commands.test.ts`，
    5/5 因未知内置命令被 rejected。
- [x] 5.2 Green：实现最小结构命令及批处理
- [x] 5.3 Red：覆盖属性路径更新/重置、transform 更新、group/ungroup 和非法目标 rejection
- [x] 5.4 Green：实现属性、变换和分组命令
  - Green command/result：同一命令 5/5 通过。
- [x] 5.5 Refactor：共享拓扑与坐标计算，记录 Red/Green/Regression 证据
  - Regression command/result：core 全量 33/33、typecheck、lint、build 通过。

## 6. CommandPanel Red → Green → Refactor

- [x] 6.1 Red：覆盖三种结果、详情、100 条限制、结构化预设、无效字段和可访问键盘操作
  - Red command/result/reason：首次 `bun run --cwd packages/command-panel test` 7/7 因组件未导出失败；
    补充 source 与 inverse Scenario 后 2/9 因来源和 inverse 列表缺失失败。
- [x] 6.2 Green：实现独立 `@compose-ui/command-panel`、样式入口和包 README
  - Green command/result：面板实现及详情补齐后 9/9 通过。
- [x] 6.3 Refactor：确认无自然语言/脚本执行路径并记录 Red/Green/Regression 证据
  - Regression command/result：command-panel 9/9、typecheck、lint、build 通过；命令输入仅经过
    有限字段解析和宿主 `createCommand`。

## 7. 示例纵向集成 Red → Green → Refactor

- [x] 7.1 Red：验证场景树、属性面板和工具栏命令共享同一事务文档与历史
  - Red command/result/reason：`bun run test:e2e -- --grep "command-transaction"` 的用户点击被
    无确定高度的编辑器容器拦截，纵向工作区不可操作。
- [x] 7.2 Green：迁移示例 fixture 和事件处理器，使用 runtime controller 驱动 HistoryPanel
  - Green command/result：提供确定工作区高度后，创建、属性修改与撤销重做均可执行。
- [x] 7.3 Red：验证 committed/undo/redo 被单点记录，noop/rejected/reset 不进入 Operation Log
  - Red command/result/reason：首次到达 CommandPanel 详情时，E2E 发现来源需要按规范先展开；
    补充 noop、rejected、reset 操作作为明确的审计负例。
- [x] 7.4 Green：实现单一事务日志桥接器和 CommandPanel 示例
- [x] 7.5 Refactor：删除重复 commit/record glue，并记录包测试与 Chromium E2E 证据
  - Regression command/result：命令事务流程并入根路径完整 Stage 示例；目标 Chromium E2E 1/1
    通过，app typecheck、lint、build 通过。

## 8. 文档与完成门禁

- [x] 8.1 更新根 README、core/command-panel 文档、project 当前阶段、依赖和 changeset
- [x] 8.2 逐项核对 Scenario 与 `OpenSpec: <capability> / <Requirement> / <Scenario>` 测试映射
- [x] 8.3 运行 strict validate、lint、typecheck、test、build、test:e2e、pack dry run 和 diff check
  - Regression command/result：两份 change strict validate 通过；root lint、typecheck、test、build、
    pack dry run 均退出 0；完整 Chromium E2E 4/4 通过。
- [x] 8.4 在对应任务下补齐 `Red command/result/reason`、`Green command/result`、
  `Regression command/result` 并仅勾选实际完成项
