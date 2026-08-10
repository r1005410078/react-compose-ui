# 任务

> **本变更在 main 上尚未实施。** 下方清单全部未勾选，是重新实施时的待办。
> 实现曾在已删除分支 `feat/add-linked-component-library`（`135f8f4`，2026-08-03）上完成，
> 当时的命令与结果保留在文末「历史执行记录」中，仅供参考，不代表 main 当前状态。
> 详见 `proposal.md` 的「状态」一节。

## 1. 规范与 Core

- [ ] 1.1 定义 Component Document v1、引用、暴露属性、覆盖与嵌套校验

## 2. Component Library

- [ ] 2.1 新增目录、Store、缓存、订阅、取消和冲突测试与实现
- [ ] 2.2 新增聚合基础 Preset 与项目组件的受控面板

## 3. 实例物料与编辑器

- [ ] 3.1 新增 component-instance Asset Drop、快照渲染、显式覆盖与嵌套保护
- [ ] 3.2 接入保存子树、独立标签、属性暴露、更新提示和单事务更新

## 4. 验证

- [ ] 4.1 完成关联组件纵向 Playwright 流程
- [ ] 4.2 运行 lint、typecheck、test、build、test:e2e 与严格 OpenSpec 校验

## 历史执行记录（已删除分支 `feat/add-linked-component-library`）

以下记录来自 2026-08-03 的分支实现，基线是分叉点 `4ea3c46`。此后 main 已前进 16 个提交，
Editor Inspector、Scene Tree、组件库 dock 与命令面板均被重构，因此这些命令、测试数量和
文件布局都可能不再适用；重新实施时以当前 main 为准，本节只用于回溯当时的判断依据。

### 1.1 定义 Component Document v1、引用、暴露属性、覆盖与嵌套校验

- Red command/result/reason: `bun run --cwd packages/core test -- component/component-document.test.ts`；3 tests failed；合法解析、嵌套判定和 override 应用尚未实现，符合预期。
- Green command/result: `bun run --cwd packages/core test -- component/component-document.test.ts`；3 tests passed。
- Regression command/result: `bun run --cwd packages/core typecheck && bun run --cwd packages/core lint && bun run --cwd packages/core test`；12 files / 83 tests passed。

### 2.1 新增目录、Store、缓存、订阅、取消和冲突测试与实现

- Red command/result/reason: `bun run --cwd packages/component-library test`；2 suites failed；Store 与面板模块尚不存在，符合预期。
- Green command/result: `bun run --cwd packages/component-library test`；2 files / 7 tests passed，包含目录请求失效与 UI 响应乱序回归。
- Regression command/result: `bun run --cwd packages/component-library typecheck && bun run --cwd packages/component-library lint && bun run --cwd packages/component-library build`；全部通过。

### 2.2 新增聚合基础 Preset 与项目组件的受控面板

- Red command/result/reason: 与 2.1 共用 Red；双来源面板模块尚不存在。
- Green command/result: `bun run --cwd packages/component-library test`；未配置 Store 与 Asset Drop 两种场景通过。
- Regression command/result: `bun run --cwd packages/component-library typecheck && bun run --cwd packages/component-library lint && bun run --cwd packages/component-library build`；全部通过。

### 3.1 新增 component-instance Asset Drop、快照渲染、显式覆盖与嵌套保护

- Red command/result/reason: `bun run --cwd packages/materials test -- component-instance/component-instance.test.tsx`；4 tests failed；隐藏 Preset、Asset Drop 和快照 Renderer 尚未实现，符合预期。
- Green command/result: `bun run --cwd packages/materials test -- component-instance/component-instance.test.tsx`；关联实例创建、离线快照、Preview 交互与嵌套错误场景通过。
- Regression command/result: `bun run --cwd packages/materials test`；60 tests passed；`typecheck`、`lint`、`build` 全部通过。

### 3.2 接入保存子树、独立标签、属性暴露、更新提示和单事务更新

- Red command/result/reason: `bun run --cwd packages/core test -- component/component-document.test.ts`；2 tests failed；子树导出与 override 对账尚未实现，符合预期。
- Green command/result: Core 子树导出与 override 对账测试、Editor 关联实例更新 undo/redo 测试通过。
- Regression command/result: `bun run --cwd packages/editor test`；108 tests passed；Stage 25 tests、Scene Tree 66 tests passed，相关包 `typecheck`、`lint`、`build` 全部通过。

### 4.1 完成关联组件纵向 Playwright 流程

- Red command/result/reason: `bunx playwright test e2e/integration.spec.ts --grep "linked-component-library"`；项目组件目录在创建期间恢复了过期请求结果，导致新组件不可见。
- Green command/result: 同一命令；创建、保存、插入、显式 override、源更新提示与 override 重放流程 1 test passed。
- Regression command/result: Component Store 与面板新增两条请求时序单测，2 files / 7 tests passed。

### 4.2 运行 lint、typecheck、test、build、test:e2e 与严格 OpenSpec 校验

- Result: `bun run lint`、`bun run typecheck`、`bun run test`、`bun run build` 全部通过；Storybook 19 files / 44 tests、全仓 Turbo 39 tasks 通过。
- E2E result: `bun run test:e2e`；32 tests passed。
- Spec result: `bunx openspec validate add-linked-component-library --strict`；valid。
