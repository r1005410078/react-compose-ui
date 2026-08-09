# 变更：增加页面 setup 脚本运行时与 React Props 绑定

## 原因

当前页面只是一份可视化 `ComposeDocument`，属性面板虽然已有宿主受控的值变量绑定能力，但项目没有
正式的变量来源、页面脚本生命周期、方法绑定或 Stage/Preview 共享运行协议。实施工程师因此无法像编写
React 组件一样，把页面视觉结构留在画布中，同时用一段脚本维护响应式状态和事件方法。

本变更把画布定义为 JSX/template 的可持久化视觉表达，把页面 setup 脚本定义为同一页面实例的逻辑
作用域。脚本通过 `setup(ctx)` 返回普通值、响应式值和事件方法，Entity 的 Renderer Props 通过稳定引用
绑定这些返回成员。

## 变更内容

- **BREAKING**：把页面资源从裸 `ComposeDocument v6` 升级为包含 `document` 与可选
  `setupScript` 稳定资源引用的版本化页面文件；提供旧裸 v6 页面到新包装格式的显式迁移。
- 新增 `@compose-ui/script-runtime`，以无需编译转换的 `ctx.state()`、`ctx.computed()` 和
  `ctx.effect()` 运行每页一个可选的 `setup(ctx)` 模块，并提供订阅、诊断和确定的释放语义。
- 首期把脚本定义为受信任的同 Realm JavaScript：State/Computed 以 `.value` 读写，返回的 Function
  可以直接绑定事件型 React callback；不把函数写入文档、Patch、历史或持久化文件。
- 在 `ComposeDocument v6` 中增加可选 `Bindings` Component，只保存顶层 Renderer Prop 到
  `{ scope: 'page', exportName }` 的引用。绑定不保存脚本 assetKey，因此更换页面 setup 文件时可以按
  相同返回名称继续解析。
- **BREAKING**：Renderer Definition 增加实例级 Prop Contract，区分可绑定的 value prop 与
  event-handler method prop；Renderer 接收解析后的 runtime props 和独立的 authored JSON props。
- 扩展属性面板绑定 UI，使没有 JSON 字面编辑器的方法 Prop 也能显示、选择、解绑和报告错误；值 Prop
  继续以目标 Valibot Schema 为类型权威。
- Page Store、Editor、Stage、Preview 与 Page Slot 共同采用页面聚合加载协议：每个页面渲染实例拥有
  独立 setup 状态，值变化精确刷新依赖 Entity，可能影响 Hug 的值变化使对应测量失效，卸载时清理
  Effect、订阅与迟到异步结果。
- Editor 为页面提供创建、打开、更换、解除 setup 脚本以及查看页面返回作用域的流程；setup 文件继续
  使用 Asset Provider 的独立 revision、dirty 和写入冲突语义。

## 首期边界

- 每个页面只能关联零或一个 setup 脚本；复用逻辑留给普通模块系统或后续模块加载能力。
- 只正式支持页面作用域，不增加应用级/global setup 脚本。
- 默认加载器只执行受信任的自包含 JavaScript 模块，不编译 TypeScript，也不承诺安全沙箱。
- 方法绑定只支持返回值被忽略的事件 handler；不同步支持 formatter、predicate、render prop、`ref`
  或返回 ReactNode 的函数。
- 不增加动态 Entity 树、条件 JSX、列表渲染、数据源、持久化 State、双向属性绑定或脚本 HMR 状态保留。

## 影响

- 受影响的规范：`compose-document`、`pages`、`component-registry`、`property-panel`、`stage`、
  `compose-preview`、`editor-workspace-layout`
- 新增规范：`page-script-runtime`
- 受影响的代码：`packages/core`、`packages/pages`、`packages/component-registry`、
  `packages/property-panel`、`packages/stage`、`packages/preview`、`packages/editor`、
  `packages/materials`、新增 `packages/script-runtime`、示例应用与 E2E
- 文档同步：实现时更新 `README.md`、`AGENTS.md` 与 `openspec/project.md`，说明新页面格式、包边界、
  受信任脚本模型和正式完成度
- 规范修正：`compose-document` 的「页面文件约定」基线仍写着 `ComposeDocument v5`，而
  `packages/core/src/page/page-file.ts` 早已产出 v6。本变更的 MODIFIED 增量在改写为聚合包装的同时
  一并纠正该历史漂移，不再单独提交纠偏变更
- 规范重命名：`pages` 的「默认页面文档 Loader」随语义扩大重命名为「默认页面聚合 Loader」，
  以 RENAMED + MODIFIED 成对表达，避免归档时留下两条互相矛盾的 Loader 需求
- 迁移影响：页面 Store、页面 Loader、Page Slot 及直接构造 `ComposeRendererProps` 的宿主需要适配新公共 API
