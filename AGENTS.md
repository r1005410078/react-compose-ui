<!-- OPENSPEC:START -->
# OpenSpec 使用说明

这些说明面向在本项目中工作的 AI 助手。

当请求符合以下情况时，始终打开 `@/openspec/AGENTS.md`：
- 提到规划或提案（例如 proposal、spec、change、plan）
- 引入新功能、破坏性变更、架构调整，或大型性能/安全工作
- 请求含义不明确，需要在编码前查阅权威规范

通过 `@/openspec/AGENTS.md` 了解：
- 如何创建和应用变更提案
- 规范文档的格式与约定
- 项目结构与开发指南

请保留这个托管区块，以便 `openspec update` 能够自动更新这些说明。

<!-- OPENSPEC:END -->

# React Compose UI 项目协作说明

## 项目背景

开始设计、编码或评审前，先阅读根目录的 [`README.md`](./README.md)。README
是项目定位、目标用户、要解决的问题、当前完成度和开发命令的主要入口。

React Compose UI 是一个可嵌入现有 React 项目的低代码 UI 编辑器组件体系，主要服务于
需要在客户现场快速搭建定制化大屏的实施工程师。项目希望把重复的页面编码工作转化为
可视化编排、属性配置、数据绑定、预览和保存发布流程。

## 当前阶段

- 当前仓库已经完成 Bun monorepo、包构建、测试、CI 和发布基座。
- `app/` 提供集成示例和最小 E2E 操作演示，不是正式编辑器产品。
- 目前尚未确定正式的文档 Schema、组件注册协议、拖拽系统、数据源协议和持久化接口。
- 不要把示例应用中的临时状态或演示交互当成稳定公共 API。

## 架构边界

- `@compose-ui/core` 必须保持与 React 和 DOM 无关，承载未来的文档模型、命令及通用逻辑。
- `@compose-ui/editor` 是可嵌入的 React 编辑器入口，可以依赖 `core`。
- `@compose-ui/scene-tree` 是独立受控 React 树组件，不得依赖 `core` 或 `editor`；
  `editor` 可以通过公共入口依赖并默认集成它。
- `@compose-ui/property-panel` 是由同步 Valibot Schema 驱动的独立受控 React 组件，不得依赖
  `core`、`editor` 或 `scene-tree`；`editor` 只通过 `inspectorPanel` 插槽集成它。
- `@compose-ui/preview` 是可独立嵌入的 React 渲染入口，可以依赖 `core`，不得依赖 `editor`。
- `editor` 与 `preview` 必须通过公开协议共享文档状态，禁止彼此引用内部源码。
- 跨包导入必须使用 `@compose-ui/*` 公开入口，禁止使用 `../../packages/.../src`。
- React、ReactDOM 和 JSX runtime 必须保持为 peer dependency/外置依赖，避免宿主加载多份 React。

## 变更规则

- 新能力、公共 API、文档 Schema、架构调整或破坏性变更必须先遵循上方 OpenSpec 流程。
- Bug 修复、文档、测试及非破坏性配置变更可以直接实施，但仍须保持范围最小。
- 新增能力时优先完成一条可运行的纵向流程，再扩展抽象和组件种类。
- 不要提前实现尚未由规范确定的编辑器领域模型。

## 验证要求

提交前至少运行：

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

涉及编辑器交互、示例应用或预览行为时，还必须运行：

```bash
bun run test:e2e
```

需要人工查看浏览器操作流程时，运行：

```bash
bun run test:e2e:ui
```

## 文档同步

- 产品定位、目标用户、解决的问题或当前完成度发生变化时，同步更新 `README.md`。
- 面向 AI/开发代理的架构约束或工作流发生变化时，同步更新本文件。
- 项目约定、技术栈、测试策略或外部依赖发生变化时，同步更新 `openspec/project.md`。
- OpenSpec 托管标记内的内容可能被 `openspec update` 重写；项目专属说明应保留在托管块之外。

## 注释规范

### 公共 API

- 所有从包公共入口导出的组件、Hook、函数、类型和接口必须使用 TSDoc；公共接口的属性和
  方法也应说明业务语义、默认行为或能力限制。
- TSDoc 应根据实际需要使用 `@remarks`、`@param`、`@returns`、`@example`、`@throws`、
  `@defaultValue`、`@public` 或 `@internal`，不得机械重复 TypeScript 已表达的类型信息。
- 每个包的公共入口应使用 `@packageDocumentation` 说明包用途和架构边界。

### 实现注释

- 注释优先解释“为什么”、业务约束、算法不变量、状态转换、性能边界、浏览器兼容性和
  看似可以简化但实际不能简化的处理，不得逐句翻译显而易见的代码。
- 复杂状态机、非直观索引换算、批量操作规范化、虚拟化假设和魔法数来源必须在靠近实现的
  位置说明。代码变化导致约束失效时，必须在同一变更中更新注释。
- 源码注释以中文为主，标识符、API 名称和标准术语保留英文；同一条注释中避免无必要地
  混用语言。
- 禁止保留被注释掉的旧代码、修改历史或作者日期；这些信息由 Git 保存。

### 维护标记与抑制

- 维护标记仅使用 `TODO`、`FIXME`、`WORKAROUND`、`PERF`、`SECURITY` 和
  `ACCESSIBILITY`。`TODO`/`FIXME` 必须关联 Issue、OpenSpec change 或负责人，并说明完成或
  删除条件。
- `eslint-disable` 和 TypeScript 抑制必须限制到最小作用域并在同一行说明原因；优先使用
  `eslint-disable-next-line` 和 `@ts-expect-error`，禁止无原因的文件级禁用与 `@ts-ignore`。
- 不使用注释掩盖应通过命名、类型拆分或函数提取解决的可读性问题。

### 测试注释

- 测试名称负责描述行为并追溯到 OpenSpec Requirement/Scenario；测试内注释只解释不明显的
  夹具、边界条件或失败原因。
- Red → Green → Refactor 的命令、结果和失败原因记录在 OpenSpec `tasks.md`，不要复制成
  源码中的长期注释。
