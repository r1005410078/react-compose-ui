## 1. OpenSpec 与测试映射

- [x] 1.1 proposal、design、tasks 与五项能力增量通过 strict validate
- [x] 1.2 每个新增/修改 Scenario 建立 `OpenSpec: <capability> / <Requirement> / <Scenario>` 测试

## 2. ComposeDocument v2 与命令

- [x] 2.1 Red：覆盖 v2 canvas 校验、默认值、v1 拒绝和非法 grid/guide
- [x] 2.2 Green：实现 v2 类型、校验、默认 factory 并迁移仓库 fixture
- [x] 2.3 Red/Green：实现 canvas configure 与 guide create/move/delete 的 noop/rejection/inverse
- [x] 2.4 Regression：core test、typecheck、lint、build 通过并记录证据

## 3. Stage 几何与吸附

- [x] 3.1 Red/Green：实现自适应 grid/ruler tick、offset、世界原点和选择尺寸标记纯计算
- [x] 3.2 Red/Green：move 与 resize 接入智能优先、网格回退和 Cmd/Ctrl 临时关闭
- [x] 3.3 Red/Green：实现动态 scroll range、thumb 映射和边缘扩展
- [x] 3.4 Regression：Stage geometry 及现有变换测试通过并记录证据

## 4. Stage 交互与 Editor

- [x] 4.1 Red/Green：重构 Stage surface，渲染 ruler、主/细网格、原点轴和可访问 scrollbar
- [x] 4.2 Red/Green：实现 guide 创建、双轴创建、移动、删除、取消和 Pointer 原子性
- [x] 4.3 Red/Green：实现 toolbar 快捷开关、设置 draft 校验、Apply/Cancel 与清空辅助线
- [x] 4.4 Red/Green：用真实 surface size 驱动 fit Frame/selection

## 5. Preview、示例与完成门禁

- [x] 5.1 升级 Preview、示例、README/project 文档和 changeset 到 v2
- [x] 5.2 Playwright 覆盖刻度调整、move/resize 吸附、辅助线历史和 scrollbar 导航
- [x] 5.3 更新并人工审查默认、选择标尺、网格、辅助线与负坐标黄金文件
- [x] 5.4 运行 strict validate、lint、typecheck、test、build、pack dry-run、test:e2e、diff check

## 执行证据

- Red command/result/reason：`bun run test:e2e:update` 首次执行在负坐标可见性断言处失败；
  第一个负刻度位于标尺裁剪边界外，证明验收需要判断“可视区域内存在负刻度”而不是依赖首个
  DOM tick。修正为基于标尺可视矩形的断言后继续 Green。
- Green command/result：`bun run --cwd packages/core test`（44 tests）、
  `bun run --cwd packages/stage test`（44 tests）、`bun run --cwd packages/editor test`
  （32 tests）、`bun run --cwd packages/preview test`（8 tests）全部通过。
- Visual command/result：`bun run test:e2e:update` 7/7 通过并刷新默认、命令拒绝、选择尺寸、
  网格吸附、辅助线和负坐标滚动黄金图；已逐张人工检查层级、刻度、轴线、选区与 scrollbar。
- Regression command/result：`openspec validate --all --strict` 13/13，`bun run lint`、
  `bun run typecheck`、`bun run test`、`bun run build`、`bun run pack:dry-run`、
  `bun run test:e2e`（7/7）和 `git diff --check` 全部通过。
