# 任务

## 1. cad 包骨架

- [x] 1.1 `packages/cad/`：package.json（依赖 core + assets）、tsconfig、vite、vitest、README
- [x] 1.2 根 `pack:dry-run` 加入新包；`AGENTS.md` 补架构边界与五层归属

## 2. 文档协议

- [x] 2.1 `CadDocument` / `CadLayer` 类型与稳定问题机器码
- [x] 2.2 `createEmptyCadDocument()`：带默认图层 `0`
- [x] 2.3 `validateCadDocument`：版本、单位、图层非空且 id 唯一、rootIds 可解析、
      entities key 与 id 一致、无孤儿
- [x] 2.4 共置单测

## 3. 文件协议与 Store

- [x] 3.1 媒体类型、`.cad.json` 文件名助手、parse / serialize
- [x] 3.2 `createComposeCadStore`：list / read / create / save
- [x] 3.3 写入前校验；列举时损坏文件单独报告
- [x] 3.4 共置单测

## 4. 编辑器接线

- [x] 4.1 `cadDocument` panel 类型与 `createCadDocumentPanelId`
- [x] 4.2 `ComposeCadDocumentSession` 加入文档会话联合
- [x] 4.3 新建 CAD 上下文菜单项 + 打开流程
- [x] 4.4 CAD 标签不参与 `stageHostPanelId`
- [x] 4.5 i18n：zh-CN 与 en-US **同时**补齐（Stage 那几刀的教训）

## 5. 边缘面板按文档类型记忆

- [x] 5.1 按文档类型记录左右边缘的收起状态，CAD 初值为收起
- [x] 5.2 `onDidCollapsedChange` 把用户操作记进当前类型
- [x] 5.3 组件测试覆盖「CAD 默认收起」与「用户选择被记住」

## 6. 验证

- [x] 6.1 `bun run lint`
- [x] 6.2 `bun run typecheck --force`
- [x] 6.3 `bun run test --force`
- [x] 6.4 `bun run build --force`
- [x] 6.5 `bun run test:e2e`，含新增的「新建 → 打开 → 存盘 → 重开」用例

## 7. 实施中的发现与偏离

- [x] 7.1 **步骤 2 的泛型化漏了一层**：`DocumentValidationResultOf<TDocument>` 仍把问题类型
      写死成 ComposeDocument 的 `DocumentValidationIssue`，CAD 的机器码塞不进去。本刀补上
      `DocumentValidationIssueShape` 与第二个类型参数（默认仍是 `DocumentValidationIssue`），
      并把它贯穿 `TransactionRuntime`、`TransactionRuntimeOptions` 与 `TransactionResetResult`。
      既有调用点因默认参数原样编译。
- [x] 7.2 孤儿判定当前等价于「未被 rootIds 引用」，因为步骤 4 尚无图元词汇、也就没有层级。
      第一个图元落地时这里必须扩展成按层级遍历，否则子级会被误判成孤儿——已在实现处注明。
- [x] 7.3 `packages/cad/src/test-fixtures.ts` 与 `@compose-ui/pages` 的同名夹具形状相同但各自
      独立。让测试夹具跨包依赖会引进 `cad → pages` 这条本不存在的边，代价大于这点重复。
- [x] 7.4 `hostContextMenuItems` 上原有的 `react-hooks/refs` 抑制变成了「未使用指令」——规则
      对同一条链路只上报一次，抑制点前移到 `cadContextMenuItems` 之后它就不再触发。改为普通
      注释说明原因，避免留下一条会让 lint 失败的死指令。
- [x] 7.5 e2e 用例最终在 `Pages` 目录下创建 CAD 文件而不是根目录：右键文件夹本身时
      `context.parentId` 指向该文件夹的父级，创建出的文件不在预期的网格里。
