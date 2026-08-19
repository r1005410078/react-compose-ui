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

- 第一方代码采用单向五层结构：无 React/DOM 的 Headless Domain/Protocol（core、assets、pages、
  script-runtime、layout-engine、stage-engine、animation）→ Shared UI Foundation（ui-context、component-registry、components）→
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
- `@compose-ui/script-runtime` 保持与 React、DOM 和 Editor 无关，承载页面 setup Signal、实例作用域
  与受信任自包含 JavaScript ESM Loader；它不是安全沙箱，也不编译 TypeScript。
- `@compose-ui/command-panel` 是订阅 core TransactionRuntime 的独立 React 调试台，只接受宿主
  声明的结构化命令预设，可依赖 components、ui-context，不依赖 editor、history、scene-tree、
  property-panel 或 operation-log。
- `@compose-ui/component-registry` 是实例级 Entity Registry 与 Renderer measurement adapter，统一
  Renderer、Component Definition、Entity Preset 与 Capability，依赖 core、assets 与 script-runtime，以 React 为
  peer，不依赖 editor 或 property-panel；测量禁止读取 Scene Entity DOM。
- `@compose-ui/component-library` 管理 Project Component/Variant 的 Component Asset v2 Store、解析、
  Apply/Revert 与混合目录；可依赖 core、assets、component-registry、components、ui-context，不依赖
  editor、stage、scene-tree 或 asset-browser。Registry Preset 继续代表代码物料，不是项目资源。
- `@compose-ui/pages` 是无 React、无 DOM 的页面目录、页面聚合 Store 与 `app.json` 应用清单读写包，
  只依赖 `core` 与 `assets`；编辑器与独立预览运行时共用同一 Store，因此页面加载不依赖 `editor`。
- `@compose-ui/stage-engine` 是无 React、无 DOM 的 Stage 坐标、SceneIndex、吸附、交互状态机、
  外部拖入和空间命令包；只依赖 core，不依赖 registry、ui-context 或任何 React 包。
- `@compose-ui/layout-engine` 是无 React、无 DOM 的 Yoga 布局求解器，只向外发布 core 的
  LayoutSnapshot 和测量端口协议，Yoga/WASM 实现不得泄漏到公共 API。
- `@compose-ui/animation` 是无 React、无 DOM 的场景动画领域包，只依赖 core，不依赖 editor、
  stage、preview、animation-panel 或任何 UI Context。关键帧轨道存放在被动画 Entity 的
  `Animation` Component 上，动画清单挂在所属 Frame 的 `Animations` Component 上（`items` 是
  会话镜像，`source` 是动画文件的稳定引用）；core 不认识这两个 Component，轨道级校验需要
  宿主主动调用包内校验入口。清单级命令必须显式传 `frameId`；跨 Frame 拖拽用
  `animation.tracks.relocate` 搬迁轨道，且必须排在结构变更之前。动画命令通过
  `TransactionRuntimeOptions.handlers` 注入，不进入 core 的内建命令表。动画文件按所属根
  Frame 分区（`animationSchemaVersion: 2`，1→2 显式迁移），编辑器默认一场景一份文件，
  多场景共享一份的既有文件同样合法，保存按绑定文件聚合回写；`Animations` 整体写入，
  清单命令与 `animation.source.set` 各自带上另一半。绑定是文档
  写入而不是页面文件写入，因此尚未保存的场景也能绑定动画。
- `@compose-ui/stage` 是 DOM Scene/SVG/DOM Overlay 无限编辑舞台适配层，提供固定标尺、文档
  网格与全局辅助线、世界原点和滚动 chrome；依赖 core、assets、script-runtime、stage-engine、
  component-registry、components、ui-context，不依赖 editor、property-panel 或 operation-log。
- `@compose-ui/preview` 依赖 core、assets、component-registry、script-runtime、layout-engine 与
  animation（预览对话框播放动画时逐帧采样文档），拥有默认 Layout
  Runtime/measurement adapter，也可挂接宿主 Runtime；不得依赖 editor 或 stage。
- `@compose-ui/materials` 提供 Group、Container、Widget Switcher、Rectangle、Text、Image、SVG、Component Instance Entity Presets、
  Renderer、Component Definitions 与 Capabilities，依赖 core、assets、component-registry、
  components、layout-engine、property-panel、script-runtime、ui-context、DOMPurify 与 Valibot，不依赖 stage、
  editor 或 asset-browser；layout-engine 只服务 Page Slot 与组件实例嵌套文档 Runtime。
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
- `@compose-ui/preview` 是独立 React 渲染入口，可以依赖 core、assets、component-registry 与
  animation，不得依赖 editor 或 stage。
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
- 当前仓库只支持 `ComposeDocument v7`：显式 Frame 根、统一 ECS Entity/Component 组合、
  `Transform` rotation、`LayoutItem` Fixed/Fill/Hug 与 `Hierarchy + Layout` Auto Layout、
  `Hierarchy` 容器、`Renderer` 内容、同步命令事务、Entity Registry、Godot 风格无限 Stage、
  聚合 Inspector、controller 默认工作区、Frame Preview、事务/会话历史和
  Group/Container/Rectangle/Text/Image/SVG/ECharts、页面聚合、setup Props 绑定与项目组件/Variant
  纵向流程。项目组件采用独立 Component Asset v2，页面文件为 `ComposePageFile 3`。
- Frame 是加在容器 Entity 上的 Component，不是新的 Entity 类型；它同时是坐标原点、独立布局
  Runtime、裁剪、动画时间线、脚本作用域与预览/导出单位这六重边界。`Frame ⇒ Hierarchy`，
  Frame 不接受 Hug，尺寸事实来源是 `Frame.size`。升格只加 `Frame`，Appearance、Clip 与动画
  轨道原地保留；唯一入口是 core 的 `promoteComposeEntityToFrame`。
- 界面上 Frame 称作「场景」，协议标识符不变。页面以 `ComposePageFile.activeFrameId` 记录
  **激活场景**：预览默认目标与生成真实页面用的都是它，没有选择时 Frame 动作也回退到它，
  但它 MUST NOT 覆盖显式选择。激活在页面文件里而不是文档里，因此切换激活是资源写入、
  不进撤销历史；新建场景改文档、可撤销，且不自动激活。
- Hug container 由 Flow children、padding、gap 与 border 决定；Hug leaf 通过 Registry measurement
  definition 同步读取缓存，并以可选 prepare/subscribe 处理字体、资源和页面 revision。测量缓存、
  diagnostics 与 Yoga 树只增加 LayoutSnapshot revision，不属于文档、事务或历史。
- `ComposeDocument.canvas` 持久化网格、智能吸附设置与全局世界辅助线；viewport、选择、工具、
  surface 尺寸和动态滚动范围是会话状态。输出边界由根 Frame 自身的 `Frame.size` 定义，背景是
  它的 `Appearance.backgroundPaint`（默认与 Container Preset 同底色，但边框宽度为 0——布局求解
  把边框计入内容盒，场景又是绝对坐标原点，默认边框会让吸附后的子级坐标整体偏 1）；
  Preview 接受 v7、渲染目标是**一块 Frame**，并忽略 canvas 编辑元数据。v5、v6 只允许显式单向
  迁移。场景是普通 Entity：它进入 Entity 选择与 SceneTree，选中即打开普通容器 Inspector
  （含场景分组），画布上与容器共用同一条呈现管线、同一个图标，只有标题标签不同。
- 根层落点按类型分流：在所有场景之外新建时，容器类 Entity 升格为一块新场景，其余 Entity 落进
  激活场景并把世界坐标钳制进边界。任何新建路径都不得回退到 `rootIds[0]`。
- 动画按场景独立、脚本按页面共享：动画作用域跟随选中对象所属的场景（无选择时回退激活场景），
  页面 setup 脚本保持 `ComposePageFile` 上的页面级单值。这个不对称是设计——绑定是页面级平坦
  命名空间，动画自身的播放绑定也解析页面作用域，按场景切分脚本会让实体跨场景移动即失去绑定。
  `Animations.source` 住在文档里，因此绑定走可撤销的文档命令；判据是看字段住在哪里——
  `setupScript` 与 `activeFrameId` 在页面文件上，才走不进撤销历史的资源写入。
- 每个场景 Entity 必须拥有 `Composition`、`Transform`、`LayoutItem`、`Visibility`、`Lock`，并至少拥有
  `Renderer` 或 `Hierarchy`。Component Key 使用 PascalCase，字段使用 camelCase；未知合法
  Component 保留并由 Registry 边界降级。
- 页面文件包装 `ComposeDocument` 与零或一个 setup 稳定引用；`Bindings.rendererProps.fields` 保存
  顶层字段的页面返回名称，解析以 authored Props 为基础并逐字段覆盖。运行 State、
  Computed 与 Function 不进入文档、Patch 或历史；Renderer `propContracts` 是唯一可绑定边界，
  `propCategories` 决定 Inspector 分类，未分类 Prop 进入“高级”且空分组不显示。默认执行模型只适用于
  受信任脚本。
- 项目组件只支持同 Provider/scope、最多八层继承与嵌套、显式更新；不支持 Detach、跨 Provider 变体
  或自动批量更新。
- 实例覆盖只含结构操作；暴露属性已删除，需要稳定参数契约时须单独设计。页面场景可直接编辑实例内部：
  Scene Tree 惰性投影内部层级、Stage 双击逐层下钻，编辑写入实例覆盖。实例子树是封闭编辑域，跨越实例
  边界的移动一律拒绝；重命名、可见性与锁定不在稳定操作代数内，因此内部节点对应能力位保持关闭而不是
  静默失效。
- 组件源保存后依赖实例自动同步，只有覆盖失效时才要求确认；判据是覆盖能否应用而不是变更来源。
- 数据源协议与正式发布持久化接口尚未完成；事务副作用留在宿主 observer/订阅边界。
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

- npm 包：React、ReactDOM、Yoga Layout、Dockview、Tailwind CSS、Shadcn、Base UI、TanStack React Virtual、Monaco Editor、Valibot、Vite、
  Vitest、Testing Library、Playwright、Turbo；示例应用单独使用 ECharts，属性面板公共包不依赖
  ECharts。
- 浏览器运行时：操作日志包默认使用 IndexedDB，失败时降级为进程内存；不依赖服务器数据库。
- CI：GitHub Actions `ubuntu-24.04` 与 Playwright Chromium。
- 发布：Changesets 经 GitHub Actions Release 工作流发布到 npm registry（带 provenance）。
- 当前运行时不依赖数据库、远端服务或第三方业务 API。
