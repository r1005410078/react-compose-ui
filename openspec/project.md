# Project Context

## Purpose

React Compose UI 是一组可嵌入现有 React 项目的低代码 UI 组件，主要服务于需要在客户现场
快速搭建和调整定制化数据大屏的实施工程师与前端开发者。项目将重复的页面编码工作逐步
转化为可视化编排、属性配置、数据绑定、预览及保存发布流程；当前仍处于基础能力验证阶段。

## Tech Stack

- Bun 1.3.14 monorepo 与 Turbo
- TypeScript、React 18.3/19、ReactDOM 18.3/19
- Vite 8 与 ESM 包构建
- Dockview 7 编辑器工作区、Tailwind CSS 4、Shadcn source primitives、Valibot 1.4 Schema 属性面板、Monaco Editor
- TanStack React Virtual 与内部 Pointer Events 场景树交互
- Vitest、Testing Library 与 Playwright Chromium

## Project Conventions

### Code Style

- TypeScript 使用严格类型检查；公共 API 必须具有明确类型，避免无理由的 `any`。
- 遵循仓库 ESLint 配置和现有无分号格式，不进行与当前任务无关的机械重写。
- 文件、变量和函数使用描述性英文名称；用户界面文案按产品场景使用中文。
- 新增抽象前优先完成一条可运行的纵向流程，避免为尚未确定的领域协议提前设计框架。

### Architecture Patterns

- 第一方代码采用单向五层结构：无 React/DOM 的 Headless Domain/Protocol（core、assets、
  stage-engine）→ Shared UI Foundation（ui-context、component-registry、components）→
  Domain Components/Widgets → Composition/Entry（editor、preview）→ Application（app）。
  高层可以依赖低层，低层不得反向依赖高层；下列包级约束优先于此通用分类。
- React 包内部采用 Feature-first 目录。每个共享公共组件拥有独立功能目录，并将实现、类型、
  纯模型、样式和测试 colocate；不得按 `components/hooks/types/utils` 横向堆放，也不得创建
  含义模糊的 `common`、`shared`、`helpers` 大杂烩。
- React 组件负责 DOM/浏览器适配和渲染；可确定性业务规则、状态转换、几何与命令规划优先
  下沉到纯函数、reducer、model 或 headless controller。复杂交互必须分离状态模型、React
  适配和渲染部分，简单组件不强制引入 controller。
- `@compose-ui/components` 只接收无业务语义的 Primitive 和 Pattern，并且必须已经被至少两个
  第一方包复用或经过公共 API 评审；Domain Component、Widget 与 Shell 留在各自领域包。
- `@compose-ui/components` 的新增共享 Primitive/Pattern MUST 以包内 Shadcn CLI 生成的源码为默认
  起点；生成源码仍是第一方代码，必须保持 Compose 命名、Feature-first、TSDoc、共置测试/Story
  与单一公开入口。只有 Shadcn 无法覆盖所需语义时才可手写并说明原因。不得公开转导原始
  Shadcn 名称、引入 Preflight 或 Shadcn 默认全局主题；语义色 MUST 映射 Compose Theme token。
- 公共交互组件必须定义受控状态、状态归属、语义事件、异步清理、Theme/I18n、WAI-ARIA
  键盘与焦点行为，并以纯逻辑单测、Testing Library 组件测试和必要的 Playwright 流程分层验证。
- `@compose-ui/ui-context` 提供跨包共享的 React Theme/I18n Context，只依赖 React peer；
  第一方 React chrome 包可以依赖它，并必须在构建时外置以保持 Context 单例。
- `@compose-ui/core` 保持与 React 和 DOM 无关，承载版本化 JSON 文档、同步命令、可逆 Patch、
  事务历史及通用逻辑。
- `@compose-ui/assets` 保持与 React、DOM 和 ComposeDocument 无关，承载资源 Provider、稳定
  `assetKey` 引用与运行时 Resolver 协议。
- `@compose-ui/command-panel` 是订阅 core TransactionRuntime 的独立 React 调试台，只接受宿主
  声明的结构化命令预设，可依赖 components、ui-context，不依赖 editor、history、scene-tree、
  property-panel 或 operation-log。
- `@compose-ui/component-registry` 是实例级 Entity Registry，统一 Renderer、Component
  Definition、Entity Preset 与 Capability，依赖 core 与 assets，以 React 为 peer，不依赖
  editor 或 property-panel。
- `@compose-ui/stage-engine` 是无 React、无 DOM 的 Stage 坐标、SceneIndex、吸附、交互状态机、
  外部拖入和空间命令包；只依赖 core，不依赖 registry、ui-context 或任何 React 包。
- `@compose-ui/stage` 是 DOM Scene/SVG/DOM Overlay 无限编辑舞台适配层，提供固定标尺、文档
  网格与全局辅助线、世界原点和滚动 chrome；依赖 core、assets、stage-engine、
  component-registry、components、ui-context，不依赖 editor、property-panel 或 operation-log。
- `@compose-ui/materials` 提供 Container、Rectangle、Text、Image、SVG Entity Presets、
  Renderer、Component Definitions 与 Capabilities，依赖 core、assets、component-registry、
  components、property-panel、ui-context、DOMPurify 与 Valibot，不依赖 stage、editor 或
  asset-browser。
- `@compose-ui/editor` 是可嵌入 React 编辑器入口，可以依赖 core、registry、stage、
  stage-engine 与独立面板包。
- `@compose-ui/components` 是共享的无业务 Tree 等 React 交互组件包，可依赖 `ui-context`；
  不拥有场景命令、资源 Provider 或持久化。
- `@compose-ui/asset-browser` 是独立目录浏览、文件预览与 Monaco 脚本编辑包，可依赖
  `assets`、`components` 和 `ui-context`，不依赖 core、editor、scene-tree 或文档历史；
  Provider 类型由 assets 定义并从此包兼容转导。
- `@compose-ui/scene-tree` 是受控 React 树组件，可依赖 `components` 与 `ui-context`，不依赖 `core` 或 `editor`；editor 可以依赖
  它，preview 不得依赖它。
- `@compose-ui/property-panel` 是同步 Valibot Schema 驱动的受控 React 组件，内建无文档语义的
  Vector2、Size、Color 等基础属性 editor，可依赖 `components`、`ui-context`，不依赖 `core`、`editor` 或
  `scene-tree`；宿主通过 editor 的 `inspectorPanel` 插槽组合它。
- `@compose-ui/operation-log` 是独立的本地操作审计包，可依赖 `components`、`ui-context`，不依赖
  `core`、`editor`、`scene-tree` 或
  `property-panel`；宿主在成功提交边界显式记录，并通过 editor 的 `transactionLogPanel` 插槽组合面板。
- `@compose-ui/history` 提供当前 React 实例内的不可变快照历史、快捷键和受控面板，可依赖
  `components`、`ui-context`，不依赖
  `core`、`editor`、`scene-tree` 或 `property-panel`；editor 可以通过公共入口组合它。
- `@compose-ui/preview` 是独立 React 渲染入口，可以依赖 core、assets 与 component-registry，不得依赖
  editor 或 stage。
- 跨包导入只使用 `@compose-ui/*` 公共入口，不得引用其他包的内部源码。
- React、ReactDOM 和 JSX runtime 保持为 peer dependency 和外置依赖。
- 示例应用只承担集成与 E2E 演示，不得把临时状态提升为稳定公共 API。

### Testing Strategy

#### TDD 基本原则

- 所有新增或修改行为 MUST 遵循 Red → Green → Refactor。
- OpenSpec 中每个新增或修改的 Scenario MUST 至少映射到一个自动化测试。
- 每个测试映射 MUST 使用 `OpenSpec: <capability> / <Requirement> / <Scenario>` 作为测试标题或紧邻测试的注释；同一 Scenario 的多个测试可以在末尾追加用例说明。
- `openspec validate` 不校验测试覆盖关系；自动映射检查进入 CI 前，代码审查 MUST 逐项核对新增或修改的 Scenario 与上述标识。
- 未建立 Scenario 到测试的映射前，MUST NOT 编写实现代码。
- Bug 修复 MUST 先添加能够复现缺陷的失败测试，再修改实现。
- 文档、注释、纯格式调整以及无法改变运行行为的配置修改可以豁免 TDD，但 MUST 在任务中说明豁免原因。

#### Red 阶段

- 实现代码前 MUST 先编写测试。
- 新测试 MUST 在当前实现上运行并失败。
- 失败 MUST 由目标行为尚未实现或现有缺陷导致。
- 因语法错误、类型错误、依赖缺失、环境异常、选择器错误或测试自身错误产生的失败，不得视为有效 Red。
- 开始实现前 MUST 在 `tasks.md` 对应任务下记录实际测试命令、失败结果和目标行为缺失这一预期原因。
- 如果测试在实现前已经通过，MUST 检查测试是否缺少有效断言、Scenario 是否已经实现，或规范是否需要调整。

#### Green 阶段

- 每次 MUST 只实现使当前失败测试通过所需的最小行为。
- MUST NOT 在 Green 阶段提前实现尚无失败测试覆盖的能力。
- 一个测试转绿后，MUST 重新运行受影响测试，确认没有引入回归。
- 只有当前 Red 测试已经转绿，才可以继续处理下一个最小行为增量。
- 不得通过删除断言、放宽无依据的阈值、跳过测试或更新黄金文件来制造 Green。

#### Refactor 阶段

- Refactor MUST 在相关测试全部通过后进行。
- Refactor MUST NOT 改变 OpenSpec 所定义的外部行为。
- 每次结构调整后 MUST 重新运行相关测试。
- 如果 Refactor 引入新的外部行为，MUST 返回 Red 阶段，先补充 Scenario 和失败测试。
- 不得为了测试方便而扩大公共 API 或暴露内部实现细节。

#### 测试层级

- 纯逻辑、状态转换和无框架领域行为 MUST 使用 Vitest 单元测试。
- React 组件渲染、属性透传、状态同步和可访问性行为 MUST 使用 Vitest 与 Testing Library。
- 跨组件、浏览器布局、用户操作流程和宿主集成 MUST 使用 Playwright E2E。
- 一个行为能够由较低层级可靠验证时 SHOULD 在较低层级测试；关键用户流程仍 MUST 保留至少一个 E2E 测试。
- 测试 MUST 断言用户可观察行为，不得主要依赖内部实现、私有状态或脆弱的 DOM 层级。

#### E2E 规范

- 每个关键用户纵向流程 MUST 至少有一个 Playwright E2E 测试。
- E2E 测试 MUST 使用稳定的角色、可访问名称或明确的测试标识定位元素。
- E2E 测试 MUST 使用确定性的测试数据、viewport、locale、timezone 和 color scheme。
- E2E 测试不得依赖执行顺序、其他测试留下的状态或不受控制的外部服务。
- 功能、状态和可访问性 MUST 使用精确断言验证，不得只依赖截图判断。

#### 视觉黄金文件

- 视觉布局、主题、尺寸或关键状态发生规范性变化时 MUST 添加 Playwright 截图黄金文件。
- 黄金文件 MUST 对应明确的 OpenSpec Scenario、viewport 和界面状态。
- 截图前 MUST 等待字体和界面状态稳定，并禁用动画、隐藏光标及屏蔽非确定性内容。
- 黄金文件 MUST 纳入版本控制。
- expected 黄金文件 MUST 使用仓库锁定的 Chromium、1280×720 viewport、
  `deviceScaleFactor: 1`、`zh-CN` locale、`Asia/Shanghai` timezone、dark color scheme、
  固定字体和确定性测试数据生成；不限制生成黄金文件的操作系统。
- 为吸收不同操作系统的字体栅格化差异，截图比较 MAY 设置不超过 1% 的
  `maxDiffPixelRatio`；不得以此掩盖几何、颜色、内容或状态回归。
- CI MUST NOT 使用 `--update-snapshots`，不得新增、覆盖或接受 expected 黄金文件；CI MAY 生成 actual、diff 和测试报告作为失败产物。
- 黄金文件更新 MUST 使用独立的 `bun run test:e2e:update` 命令执行，不得把更新参数加入普通 `test:e2e`。
- 更新前 MUST 检查 expected、actual 和 diff，确认每一处像素变化符合已批准的规范。
- 不得仅为使 CI 通过而更新黄金文件、扩大差异阈值或遮罩稳定内容。
- 参考设计图属于设计输入，不得直接视为测试黄金文件；黄金文件必须由确定的测试场景生成。
- 当前仓库已经启用视觉黄金文件、独立更新命令和 CI 比较门禁。

#### 完成门禁

- `tasks.md` MUST 按最小可观察行为组织 Red、Green、Refactor 小步循环，不得把所有测试和所有实现分别批量完成；每个 OpenSpec Scenario MUST 映射到一个或多个行为循环。
- 任务标记完成前 MUST 在对应任务下按 `Red command/result/reason`、`Green command/result`、`Regression command/result` 格式记录执行证据。
- 所有相关单元测试、组件测试和 E2E 测试 MUST 通过。
- 新增或修改的 OpenSpec Scenario MUST 有对应测试。
- 测试中不得遗留 `skip`、`only`、无断言用例或未经说明的宽松阈值。
- 涉及黄金文件时，提交 MUST 同时包含测试代码和经过审查的黄金文件。

### Git Workflow

- 使用 Conventional Commits 风格的一行提交信息，例如 `feat: add editor workspace`。
- 每个提交保持范围聚焦，不混入无关格式化、依赖更新或用户已有修改。
- 测试代码、实现代码和已审核的相关黄金文件应在同一功能提交或可追溯的连续提交中交付。
- 未经明确请求不推送分支、创建 PR、归档 OpenSpec 变更或发布包。

## Domain Context

- 目标用户需要在客户现场快速调整数据大屏，编辑器必须能嵌入现有 React 宿主。
- 当前仓库只支持 `ComposeDocument v5`：隐式 Canvas 根、统一 ECS Entity/Component 组合、
  `Hierarchy` 容器、`Renderer` 内容、同步命令事务、Entity Registry、Godot 风格无限 Stage、
  聚合 Inspector、controller 默认工作区、文档/Container Preview、事务/会话历史和
  Container/Rectangle/Text/Image/SVG/ECharts 纵向流程。
- `ComposeDocument.canvas` 持久化网格、智能吸附设置与全局世界辅助线；viewport、选择、工具、
  surface 尺寸和动态滚动范围是会话状态。`document.output` 定义固定原点输出边界；Preview
  接受 v5 并忽略 canvas 编辑元数据。output 默认透明；Stage 输出边界可作为独立 Canvas
  Inspector 会话目标，但不进入 Entity 选择或 SceneTree。
- 每个场景 Entity 必须拥有 `Composition`、`Transform`、`Visibility`、`Lock`，并至少拥有
  `Renderer` 或 `Hierarchy`。Component Key 使用 PascalCase，字段使用 camelCase；未知合法
  Component 保留并由 Registry 边界降级。
- 数据源协议与持久化接口尚未完成；事务副作用留在宿主 observer/订阅边界。
- 示例中的临时状态、面板 ID 和 Dockview 对象都不是编辑器领域模型或公共协议。

## Important Constraints

- 新能力、公共 API、Schema、架构调整或破坏性变更必须先通过 OpenSpec 提案审批。
- 不得提前实现尚未规范化的编辑器领域模型或持久化协议。
- `editor` 与 `preview` 只能通过未来的公开协议共享文档状态，不得相互引用内部源码。
- 修改编辑器交互、示例应用或预览行为时，除常规质量检查外必须运行 Chromium E2E。
- 工作区必须由宿主提供确定的非零高度；当前布局状态只存活于组件实例。
- `useHistory` 继续提供独立会话快照历史；core TransactionRuntime 以 forward/inverse Patch
  提供结构兼容的正式事务历史。两者都不跨刷新持久化。

## External Dependencies

- npm 包：React、ReactDOM、Dockview、Tailwind CSS、Shadcn、Base UI、TanStack React Virtual、Monaco Editor、Valibot、Vite、
  Vitest、Testing Library、Playwright、Turbo；示例应用单独使用 ECharts，属性面板公共包不依赖
  ECharts。
- 浏览器运行时：操作日志包默认使用 IndexedDB，失败时降级为进程内存；不依赖服务器数据库。
- CI：GitHub Actions `ubuntu-24.04` 与 Playwright Chromium。
- 发布：Changesets 经 GitHub Actions Release 工作流发布到 npm registry（带 provenance）。
- 当前运行时不依赖数据库、远端服务或第三方业务 API。
