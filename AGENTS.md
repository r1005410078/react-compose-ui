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
- 当前正式文档协议为仅支持 v3 的隐式 Canvas 根、统一 Frame 容器与 Component 叶节点；
  数据源协议和持久化接口仍未确定。
- 不要把示例应用中的临时状态或演示交互当成稳定公共 API。

## 架构边界

- `@compose-ui/ui-context` 是跨包共享的 React 主题与国际化 Context，只依赖 React peer；
  第一方 React chrome 包可以依赖它，但必须在构建中外置，避免产生多份 Context 实例。
- `@compose-ui/core` 必须保持与 React 和 DOM 无关，承载 v3 文档模型、命令及通用逻辑。
- `@compose-ui/assets` 是无 React、无 DOM 的资源 Provider、稳定引用与运行时 Resolver 协议包；
  不得依赖资源浏览 UI、编辑器、文档历史或组件注册表。
- `@compose-ui/editor` 是可嵌入的 React 编辑器入口，可以依赖 `core`。
- `@compose-ui/components` 是跨第一方包复用的 React 交互组件层，可依赖 `ui-context`，
  不包含场景、资源 Provider、文档命令或持久化语义。
- `@compose-ui/scene-tree` 是独立受控 React 树组件，可依赖 `components` 和 `ui-context`，
  不得依赖 `core` 或 `editor`；`editor` 可以通过公共入口依赖并默认集成它。
- `@compose-ui/asset-browser` 是独立文件浏览预览和 Monaco 编辑包，可依赖 `assets`、
  `components` 与 `ui-context`，不得依赖 `core`、`editor`、`scene-tree` 或文档历史；
  Provider 类型只从 `assets` 兼容转导。
- `@compose-ui/property-panel` 是由同步 Valibot Schema 驱动的独立受控 React 组件，可依赖
  `ui-context`，不得依赖 `core`、`editor` 或 `scene-tree`；`editor` 只通过
  `inspectorPanel` 插槽集成它。
- `@compose-ui/history` 是独立的 React 会话快照历史与受控面板，可依赖 `ui-context`，不得依赖
  `core`、`editor`、`scene-tree` 或 `property-panel`；`editor` 可以通过公共入口依赖并默认集成它。
- `@compose-ui/component-registry` 是实例级宿主组件注册协议，可以依赖 `core` 和 `assets`，以 React 为
  peer dependency，不得依赖 `editor` 或 `property-panel`。
- `@compose-ui/stage-engine` 是无 React、无 DOM 的坐标、场景索引、吸附、手势状态机与空间命令
  包，只能依赖 `core`，不得依赖任何 React chrome、registry 或 UI Context 包。
- `@compose-ui/stage` 是 DOM Scene 与 SVG Overlay 组合的无限编辑舞台适配层，可以依赖 `core`、
  `assets`、`stage-engine`、`component-registry` 和 `ui-context`，不得依赖 `editor`、`property-panel`
  或 `operation-log`。
- `@compose-ui/preview` 是可独立嵌入的 React 渲染入口，可以依赖 `core`、`assets` 和
  `component-registry`，不得依赖 `editor` 或 `stage`。
- `@compose-ui/materials` 是 Frame、Rectangle、Text、Image、SVG 的独立基础物料包，可以依赖
  `core`、`assets`、`component-registry`、`stage`、`property-panel`、`ui-context`、DOMPurify
  和 Valibot，不得依赖 `editor` 或 `asset-browser`。
- `editor` 与 `preview` 必须通过公开协议共享文档状态，禁止彼此引用内部源码。
- 跨包导入必须使用 `@compose-ui/*` 公开入口，禁止使用 `../../packages/.../src`。
- React、ReactDOM 和 JSX runtime 必须保持为 peer dependency/外置依赖，避免宿主加载多份 React。

## React 组件架构与目录规范

### 分层与依赖方向

第一方代码按职责分为以下五层；依赖只能从较高层指向较低层，现有“架构边界”中的包级约束
比本节的通用分类优先：

1. **Headless Domain / Protocol**：`core`、`assets`、`stage-engine`，不得依赖 React 或 DOM。
2. **Shared UI Foundation**：`ui-context`、`component-registry`、`components`，提供跨包协议、
   Context 与无业务语义的交互组件。
3. **Domain Components / Widgets**：`stage`、`scene-tree`、`asset-browser`、`history`、
   `property-panel`、`operation-log`、`command-panel`、`materials`，拥有明确领域职责。
4. **Composition / Entry**：`editor`、`preview`，负责组合 Provider、领域组件和宿主协议。
5. **Application**：`app`，只承担集成示例与端到端演示。

不得为了复用方便让低层包反向依赖高层包。需要跨层共享时，先判断应下沉的是无框架协议、
无业务 UI primitive，还是由上层通过 prop、slot、adapter 注入；不得通过深层源码导入、
循环依赖或在低层复制领域类型绕过边界。

### 组件分类

新增或评审 React 组件时必须先确认其类别与归属：

- **Primitive**：Button、Input 等无业务语义基础 UI。
- **Pattern**：Tree、Dialog、SplitPane、VirtualList 等完整但无业务语义的交互模式。
- **Domain Component**：ComposeSceneTree、AssetPreview、HistoryList 等包含领域词汇的组件。
- **Widget**：Stage、ComposeAssetBrowser、ComposePropertyPanel 等可独立完成一块用户任务的组件。
- **Shell**：Editor、Preview 等负责跨域组合、Provider 和宿主接线的入口。

`@compose-ui/components` 只接收 Primitive 和 Pattern。包含 ComposeDocument、资源 Provider、
事务历史、场景命令、物料或编辑器工作流语义的组件必须留在对应领域包。ComposeSceneTree 和
AssetTree 应组合共享 Tree，而不能把业务分支塞回 Tree。

### Feature-first 目录

- 包内默认按功能或公共组件组织目录，不按 `components/`、`hooks/`、`types/`、`utils/`
  等技术类型横向堆放。
- `@compose-ui/components` 中每个公共组件必须拥有独立目录，例如 `src/tree/`、
  `src/dialog/`；目录内共同放置实现、类型、纯模型、样式、测试和可选 Story。
- 复杂领域包按用户能力拆分，例如 Asset Browser 可拆为 `asset-tree/`、`asset-grid/`、
  `asset-preview/`、`script-editor/` 和 `operations/`，而不是建立一个包级大 `components/`。
- 与单一功能绑定的 Hook、类型、常量和辅助函数必须与该功能同目录。只有具有稳定、单一、
  可说明的跨功能职责时才能上移；禁止创建含义模糊的 `common`、`shared`、`helpers` 或
  万能 `utils` 大杂烩。
- 包根 `src/index.ts`/`src/index.tsx` 只定义公共入口；功能目录使用自己的 `index.ts`
  控制导出。其他包不得绕过公共入口导入内部文件。
- 不要求为简单私有 JSX 片段机械创建目录；当它形成独立公共 API、拥有自己的状态机/样式/
  测试，或包含三个及以上协同实现文件时，再提升为独立功能目录。

复杂公共组件建议采用以下结构，并按实际职责删减，不得为凑结构创建空文件：

```text
src/tree/
├── index.ts
├── tree.tsx
├── tree-types.ts
├── tree-model.ts
├── tree-keyboard.ts
├── tree-parts.tsx
├── styles.css
├── tree.test.tsx
└── tree.stories.tsx
```

### React、状态与 Headless 边界

- React 组件负责渲染、Context 消费、DOM 测量、浏览器事件归一化和 Effect 应用；可确定性
  业务规则、几何、状态转换和命令规划优先放入纯函数、reducer、model 或 headless controller。
- 复杂拖拽、虚拟化、异步操作或多阶段交互不得全部堆在一个 TSX 文件中；至少分离状态模型/
  session、React 适配和渲染部分。简单展示组件不应为了形式强制引入 controller。
- 只保存最小且不可派生的状态，避免重复、矛盾和深层嵌套状态。局部瞬时状态留在最近组件；
  Theme/I18n 等横切配置使用共享 Context；文档、事务和资源事实来源遵守各自公开协议。
- Context 不得作为普通 prop 透传或局部状态管理的默认替代。优先使用 props、children、slot
  和组合；只有跨越多个层级且语义稳定的配置才进入 Context。
- Headless 包和协议不得暴露 React Event、HTMLElement 或浏览器对象。React 公共回调优先
  返回规范化的业务数据；确需暴露原生事件时必须在 TSDoc 中说明用途和生命周期限制。

### 公共组件准入与 API

组件进入 `@compose-ui/components` 或成为其他包的公共导出前，必须满足：

- 职责、非目标、受控/非受控模式、默认值和状态归属明确。
- 事件回调表达用户动作或规范化结果，不能要求消费者读取内部 DOM 才能理解结果。
- loading、empty、error、disabled、readonly 等适用状态具有确定行为。
- Theme/I18n 通过 `ui-context` 消费；不得硬编码第一方 chrome 颜色或可翻译文案。
- 样式使用包内语义 token 并与功能同目录；显式 `className`/`style` 的覆盖能力和优先级保持稳定。
- 异步组件定义取消、迟到结果、并发冲突和卸载清理；Blob URL、订阅、observer、model 和
  全局监听必须可释放。
- 公共入口、组件、Hook、函数和类型遵守本文件的 TSDoc 规则；内部实现默认不导出。

只有已经被至少两个第一方包复用，或明确作为经过评审的公共 Pattern/Primitive 发布时，
才能将领域包内组件上移到 `@compose-ui/components`。不得以“未来可能复用”为理由提前抽象。

### 可访问性与测试

- 交互组件必须选择并完整实现对应的 WAI-ARIA Pattern，包括 role、accessible name、状态、
  键盘、焦点进入/退出和焦点恢复；不能只添加 ARIA 属性而缺少交互语义。
- selection、focus、active、expanded 和 checked 是不同状态，不得用一个布尔值或同一视觉
  样式含混表示。虚拟化组件还必须维护正确的集合位置和焦点可达性。
- 纯 model/reducer/算法使用 Vitest；React 契约、键盘、焦点、ARIA、异步清理使用 Testing
  Library；真实布局、Pointer capture、跨包流程使用 Playwright。
- 测试断言用户可观察行为，不以私有 state、内部方法或脆弱 DOM 层级为主要契约。
- 仓库引入 Storybook 前，可复用视觉状态由组件测试与既有黄金图承载；引入后 Story 应与
  功能同目录，并覆盖正常、空、加载、错误、禁用、长文本和大数据量等适用状态。

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
