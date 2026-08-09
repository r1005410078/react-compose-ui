## 上下文

React Compose UI 当前把一份严格 JSON `ComposeDocument v6` 直接保存为 `.page.json`。Renderer 的
authoring props 也是严格 `JsonObject`，Stage 与 Preview 把同一对象交给宿主 Renderer。属性面板已经
能够让宿主提供 `{ id, scope, value }` 变量快照，并用目标 Valibot Schema 过滤和解析值绑定，但变量的
创建、页面所有权、持久化与运行生命周期均明确留给宿主，Function 也不能进入严格 JSON。

本变更采用以下产品模型：

```text
React Component = component logic + JSX
Compose Page    = setup script    + ComposeDocument visual template
```

setup 脚本不是第二份页面结构，也不返回 JSX。它只返回当前页面实例可供画布绑定的命名作用域；视觉树、
字面 Props、层级和布局继续由 ComposeDocument 唯一表达。

## 目标/非目标

### 目标

- 允许页面脚本用普通 JavaScript 和显式 State Cell 管理响应式状态，不引入源码编译转换。
- 让 setup 返回的值与方法分别绑定到兼容的 React value prop 与 event callback prop。
- 保持 ComposeDocument、事务、Patch 和页面文件为严格 JSON，不持久化 Function 或运行值。
- 让 Editor Stage、独立 Preview 与嵌套 Page Slot 使用同一绑定和生命周期语义。
- 保留字面 Props 作为值绑定的确定 fallback，并让脚本或单项导出错误只降级受影响目标。

### 非目标

- 不实现 Svelte 式 `num++` 编译转换；State 使用 `num.value++`。
- 不实现不可信代码沙箱、Worker RPC 或浏览器权限隔离。
- 不实现 TypeScript 编译、npm/相对模块图打包或源码级热更新状态保留。
- 不实现应用级 setup、多脚本优先级、跨页面共享 State 或持久化 State。
- 不实现 formatter、predicate、render prop、`ref`、ReactNode 返回值或同步方法结果绑定。
- 不允许脚本动态创建、删除或重排 Entity；这些仍必须通过文档命令和正式交互规范完成。

## 决策

### 1. 页面是 Document 与 setup 引用的聚合

页面文件从裸 ComposeDocument 改为版本化包装：

```ts
interface ComposePageFile {
  readonly kind: 'compose-page'
  readonly pageSchemaVersion: 1
  readonly document: ComposeDocument
  readonly setupScript: ComposePageSetupReference | null
}

interface ComposePageSetupReference {
  readonly providerId: string
  readonly assetKey: string
  readonly scope: 'persistent' | 'session'
}
```

`ComposeDocument` 继续独立表达视觉模板，因此文档校验、命令和布局不因 setup 引用改变。页面文件解析器
识别旧裸 `ComposeDocument v6`，但只返回显式迁移结果；运行时和写入路径不维持两种长期格式。空白页面
直接创建新包装格式。

选择包装而不是给 ComposeDocument 增加顶层 `setupScript`，是为了让独立文档渲染继续与页面生命周期
解耦，也避免仅为页面资源升级 ComposeDocument schemaVersion。

### 2. 每页至多一个 setup，绑定不引用脚本资源

页面与 setup 是零或一关系。一个 setup 可以被多个页面文件引用，但每个页面渲染实例都会重新调用
`setup(ctx)`，State 不共享。

Entity 绑定只保存页面作用域和返回名称：

```ts
interface ComposePageExportReference {
  readonly scope: 'page'
  readonly exportName: string
}
```

它不保存 setup assetKey。用户更换页面的 setup 文件时，只要新脚本仍返回同名成员，既有绑定即可继续
解析；缺失成员产生诊断但不自动删除引用。首期不做应用级/global setup，因此没有作用域遮蔽或优先级。

### 3. 无编译的 setup 与 Signal Cell

setup 模块必须导出名为 `setup` 的函数：

```js
export function setup(ctx) {
  const num = ctx.state(0)

  ctx.effect(() => {
    const timer = setTimeout(() => {
      num.value += 100
    }, 2_000)
    return () => clearTimeout(timer)
  })

  const onAdd = () => {
    num.value += 1
  }

  return { num, onAdd }
}
```

`ctx.state(initial)` 返回带品牌标记和可读写 `.value` 的 State；`ctx.computed(read)` 返回带只读
`.value` 的 Computed；`ctx.effect(run)` 立即运行并跟踪执行期间读取的 State/Computed。State 以
`Object.is` 判等，同一调用栈的多次写入在 microtask flush 中合并。Effect 重跑前执行上次 cleanup，
实例 dispose 时按反向注册顺序执行剩余 cleanup。

`setup` 只执行一次并必须同步返回普通对象。返回成员按以下规则规范化：

- Compose State/Computed：响应式 value export，运行时对绑定方暴露当前 `.value`。
- Function：method export，首期只允许绑定 event-handler Prop。
- 其他值：普通 value export，是 setup 时的静态快照。

若脚本作者返回 `{ num: num.value }`，该成员是非响应式快照；必须返回 State/Computed 本身才能持续更新。
无初始值的 State 初始为 `undefined`，只有目标 Prop Contract 接受 undefined 时才兼容。

### 4. 受信任的同 Realm JavaScript

首期默认模块加载器通过稳定资源引用读取最新 JavaScript Blob，再以新的模块 URL 执行自包含 ESM。
它只接受约定的 JavaScript media type/扩展名，不转译 TypeScript，不解析相对或 npm import 图。CSP 拒绝
动态模块、资源缺失、语法错误、缺少 setup 或 setup 抛错都转为结构化 diagnostic。

脚本与宿主运行在同一 Realm，拥有同等浏览器权限。这是为了让 Function 能直接适配 React callback 的
同步调用约定；它不是安全边界。公共 API 同时定义可替换 `ComposeScriptModuleLoader` 端口，宿主可以
提供预编译模块或未来的 Worker 实现，但 Worker 实现不得假装支持同步/DOM React Props。

### 5. Authored Props 与 Runtime Props 分层

文档中的 `Renderer.props` 继续是 `JsonObject`，称为 authored props。绑定解析后传给 React 的对象称为
runtime props：

```ts
type ComposeRuntimeProps = Readonly<Record<string, unknown>>

interface ComposeRendererProps {
  readonly props: ComposeRuntimeProps
  readonly authoredProps: JsonObject
  // 其余现有上下文保持不变
}
```

这是有意的公共 API 破坏性调整：`props` 应代表 Renderer 实际使用的值，现有 Renderer 若只消费 JSON
字段通常无需行为修改，但需要接受更宽的类型；需要发出编辑命令、显示字面值或序列化时必须读取
`authoredProps`/`renderer.props`。

### 6. `Bindings` Component 只保存顶层 Renderer Prop 引用

首期在 Entity 上使用可选内建 `Bindings` Component：

```ts
interface ComposeBindings extends JsonObject {
  readonly version: 1
  readonly props: Readonly<Record<string, ComposePageExportReference>>
}
```

每个 key 对应一个顶层 Renderer Prop。Entity 必须同时拥有 Renderer；Core 只校验 JSON 形状、作用域与
非空名称，不依赖运行时 Registry，因此未知 Renderer/Prop 绑定仍会被保留。Registry 在解析阶段判断目标
是否存在和兼容。

首期不把现有 Property Panel 的嵌套 path/renderer sub-target 持久化为此 Component。它们可以继续作为
宿主受控能力存在；后续若要统一，必须另行定义稳定的嵌套 Prop Contract 与迁移。

### 7. Renderer Prop Contract 是匹配权威

React/TypeScript Props 类型在运行时已被擦除，因此 Renderer Definition 必须显式声明可绑定 Prop：

```ts
type ComposeRendererPropContract =
  | {
      readonly kind: 'value'
      readonly label: string
      readonly validate: (value: unknown) => true | string
      readonly affectsMeasurement?: boolean
    }
  | {
      readonly kind: 'method'
      readonly label: string
      readonly role: 'event-handler'
    }
```

Registry 不依赖 Valibot；Materials 可以用同一 Valibot Schema 构造 Inspector 和 `validate`。value export
必须通过目标 validate；method export 只能进入 method contract。旧 Renderer 未声明 contract 时继续
使用 authored props，但没有正式脚本绑定入口。

值绑定成功后覆盖同名 authored prop；缺失、错误或不兼容时回退 authored prop。方法绑定成功时注入
捕获同步异常和 Promise rejection 的 wrapper；缺失或错误时该 Prop 为 undefined。方法返回值被忽略，
Renderer Contract 要求它只在用户事件后调用。

### 8. 属性面板显示值与方法目标

现有 Schema 字段仍由 Valibot 决定类型、约束和语义 editor。Property Panel 增加可独立渲染的受控
binding-only target row，供没有 JSON 字面输入的方法 Prop 使用。默认选择器按 `value`/`method` kind
过滤：值目标再执行目标 Schema/Contract 校验，方法目标只显示 method export。

绑定、换绑、解绑写入 Entity 的 Bindings Component，并通过正式文档事务进入 undo/redo；脚本 State
变化只更新 runtime snapshot，不触发 `onValueChange`、文档事务或操作历史。

### 9. 页面实例、Stage、Preview 与嵌套页面

每个渲染实例拥有独立 setup scope：编辑器页面、独立 Preview、以及每个 Page Slot 分别创建实例。
setup 文件相同也不共享 State。页面/Slot 卸载、引用变化或脚本 revision 变化会 dispose 旧实例；首期
重新执行 setup 并重置 State，不保留 HMR 状态。

Editor Stage 执行 setup、Effect 和 value binding，以便画布显示实时值；普通编辑模式中的 method prop
使用保持存在但不执行用户脚本的 no-op wrapper，防止选择/拖拽误触业务行为。Preview 使用真实 method
wrapper。未来交互预览模式需单独规范。

State/Computed 更新只通知引用对应 exportName 的 Entity。value contract 默认视为可能影响测量；只有
显式 `affectsMeasurement: false` 才跳过 Layout/measurement invalidation。method 更新不会使布局失效。

### 10. 编辑与保存流程

页面新建时 `setupScript` 为 null。Editor 通过 Asset Browser 的既有宿主菜单扩展提供：创建页面脚本、
打开页面脚本、更换页面脚本、解除页面脚本。创建默认生成 `<PageName>.setup.js` 与最小 setup 模板；
先创建脚本资源，再以页面 expected revision 写入引用。第二步冲突或失败时不静默删除已创建文件，而是
报告孤立脚本及恢复操作。

页面文件与脚本文件拥有独立 revision、dirty 和冲突处理。脚本成功保存且 revision 更新后，运行时
dispose 旧实例并重新加载；保存失败继续使用最后一次成功运行的模块。页面 JSON 只读预览显示完整包装。

## 风险/权衡

- 同 Realm 脚本可以访问宿主全局 → 首期明确只接受受信任项目脚本，并在 UI/文档中警示；未来沙箱作为
  不兼容执行能力单独设计。
- 页面文件格式破坏兼容 → 提供确定解析、显式迁移和完整页面 Store/API 迁移，不长期双写两种格式。
- Prop Contract 与 Inspector Schema 可能重复 → Materials 从同一 feature-local Schema 派生 validator，
  Registry 保持无 Valibot 依赖。
- Effect 自触发可能形成循环 → scheduler 限制单次 flush 的重复执行次数，超限暂停该 Effect 并报告诊断。
- Stage 运行 Effect 可能产生外部副作用 → 首期 Context 不提供宿主业务 capability；文档声明普通浏览器
  API 仍由受信任脚本自行承担，未来增加编辑交互模式或 capability 门禁。
- 顶层 Prop 绑定无法覆盖复合 editor 子目标 → 首期保持范围可实现；嵌套目标统一另立变更。
- JavaScript blob module 受 CSP 与 import 限制 → 暴露 Loader 端口并产生结构化失败，不使用 `eval` 绕过。

## 迁移计划

1. 增加页面文件包装解析器与 `migrateLegacyComposePageFile()`，保持 ComposeDocument v6 不变。
2. 迁移 Page Store、Loader、Editor 页面标签和 Page Slot 到聚合页面 API。
3. 增加 Bindings Component、Prop Contract 与 authored/runtime props 分层。
4. 增加 Script Runtime、默认 JavaScript Loader 和页面实例协调器。
5. 接入 Property Panel、Stage、Preview、Materials 与完整纵向 E2E。
6. 更新示例页面文件、README、AGENTS 与 project context；不自动改写用户 Provider 中的外部文件。

回滚时可以解除 setup 引用并删除 Bindings Component，使新页面退化为纯字面渲染；已经迁移为包装格式的
页面必须通过显式导出工具恢复为裸 ComposeDocument，不能把外层文件直接交给旧 Page Store。

## 待解决问题

- 应用级 setup/global scope 的所有权、生命周期以及页面访问方式留给后续提案。
- 模块 import 图、TypeScript 转译和 Monaco 类型声明由后续脚本工具链提案决定。
- 是否需要可交互的 Editor Play 模式，以及它与 Preview 状态是否共享，留给交互系统提案。
- 嵌套 Prop、renderer sub-target 与现有 Property Panel binding 地址如何统一，留给后续迁移提案。
