## 1. 规范与包基座

- [x] 1.1 Strict validate `add-operation-log` 的协议、持久化、面板和示例需求
- [x] 1.2 建立 `@compose-ui/operation-log` 包、构建入口、样式入口、README 和 changeset

## 2. 日志模型与存储（Red → Green → Refactor）

- [x] 2.1 Red：锁定标记快照、不可用值、64KiB 截断和稳定预览
- [x] 2.2 Green：实现快照编码与公共日志类型
- [x] 2.3 Red：锁定 800ms 紧邻合并、中断、scope 隔离和 1000 条保留
- [x] 2.4 Green：实现日志控制器、内存 store 和 IndexedDB store
- [x] 2.5 Refactor：统一写入队列、存储错误降级和 scope 生命周期

## 3. React 面板（Red → Green → Refactor）

- [x] 3.1 Red：锁定 Provider 加载/降级、搜索、分类/组件筛选和详情可访问性
- [x] 3.2 Green：实现 Provider、Hook、紧凑列表和详情面板
- [x] 3.3 Refactor：补充键盘交互、空状态、截断/错误状态及默认 UE4 风格

## 4. 示例集成（Red → Green → Refactor）

- [x] 4.1 Red：锁定成功操作记录、属性合并、非数据操作忽略和刷新恢复 E2E
- [x] 4.2 Green：在工具栏、场景树、属性和 bindings 成功提交边界接入 recorder
- [x] 4.3 Visual：替换伪日志列表并生成底部日志面板黄金文件

## 5. 文档与回归

- [x] 5.1 更新根 README、project 架构说明、包文档与 pack dry-run
- [x] 5.2 运行 OpenSpec strict validation、lint、typecheck、test、build、Chromium E2E 和 diff check

## 执行证据

- Spec command/result：`openspec validate add-operation-log --strict` 通过；仅遥测域名不可达警告，
  不影响规范验证。
- Model Red command/result：`bun run --cwd packages/operation-log test` 按预期 7/7 失败，
  失败边界为尚未实现的 snapshot、store 与 runtime。
- Model Green command/result：同一命令 7/7 通过；`bun run --cwd packages/operation-log typecheck`
  通过。
- Retention Red command/result/reason：`bun run --cwd packages/operation-log test -- controller.test.ts`
  1/5 失败；初始化只裁剪响应式列表，store 仍保留超限旧记录。Green 后 5/5 通过。
- React Red command/result/reason：刷新 workspace 链接后运行包测试，5/5 React 用例因 Provider Hook
  与 Panel 尚未实现而按预期失败。Green/Regression：最终包测试 15/15 通过。
- Demo E2E Red command/result/reason：目标 Chromium 用例找不到“操作日志”region；示例仍使用伪列表。
  Green：成功提交、合并、忽略 UI 操作、reload 和 scope 隔离目标用例通过。
- Visual command/result：生成并人工检查 `operation-log-panel.png`；真实日志面板引起的 3 个全页
  基线差异仅位于底部日志区和当前常驻绑定入口，审核后更新。
- Regression command/result：`bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`
  均通过；Chromium E2E 43/43 通过；`bun run pack:dry-run` 包含 operation-log 并通过。
- Final gate command/result：`bun run test:e2e` 重新构建后 43/43 通过；
  `openspec validate add-operation-log --strict` 与 `git diff --check` 通过。
