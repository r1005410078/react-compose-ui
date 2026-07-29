## Context

Compose UI 以 `ComposeUIProvider` 的 token 作为唯一主题来源，而 Shadcn 是“复制源码到项目中”的
组件分发方式。直接执行默认初始化会产生全局颜色变量、Preflight 和不带 Compose 前缀的工具类，
会与已有多包 CSS 边界和嵌入式宿主约束冲突。

## Goals / Non-goals

- Goals: package-local Shadcn CLI workflow, Compose Theme token integration, source ownership, an initial tested
  primitive, and a durable rule for future shared components.
- Non-goals: rewrite `ComposeTree`, migrate domain widgets, replace ComposeUIProvider, publish Shadcn's raw API,
  or add a second UI/theme system.

## Decisions

- `packages/components/components.json` configures the current Shadcn style, TypeScript, non-RSC mode, Tailwind v4,
  a package-local class prefix, and `#...` package-import aliases. The aliases resolve generated code inside this
  workspace without creating cross-package source imports.
- Generated sources live inside the public component's feature directory. Public exports remain Compose-prefixed
  (`ComposeButton`, `ComposeButtonProps`, etc.); Shadcn's unprefixed implementation symbols are private.
- Tailwind output imports theme and utilities only. It does not import Preflight. Shadcn semantic names such as
  `primary`, `background`, `ring`, and `destructive` resolve to CSS variables backed by Compose semantic tokens
  with standalone fallbacks.
- The package owns a `cn()` utility and uses Shadcn's generated source as a starting point. Generated code is
  reviewed like ordinary first-party code and is updated through the pinned CLI plus tests, not treated as an
  opaque runtime dependency.
- A candidate belongs in `@compose-ui/components` only when it is a generic Primitive/Pattern and is reused by at
  least two first-party packages or has passed public API review. New domain UI continues to use its local feature
  directory; it may compose shared Compose primitives.

## Risks / Mitigations

- Shadcn CLI updates can rewrite sources → keep a package-local configuration, pinned CLI and review generated diffs.
- Theme mismatch → test Dark/Light and token override stories; map to existing semantic Compose tokens rather than
  Shadcn color literals.
- CSS leakage → use a dedicated Tailwind prefix and omit Preflight; preserve the single public styles entry.
- Unnecessary dependency growth → add per-primitive dependencies only when a generated primitive needs them and
  externalize them in the library build.

## Migration Plan

1. Add the source-owned foundation and `ComposeButton` without changing existing Tree behavior.
2. Use the foundation for newly added shared primitives.
3. Evaluate existing simple shared controls opportunistically; migrate only after behavior and visual equivalence
   are covered by tests.

## Context menu extension

- `ComposeContextMenu` 以 Shadcn/Base UI 的 ContextMenu source 为基础，但公开入口、类型和样式全部
  使用 Compose 命名。它支持标准 Trigger 组合，同时由 `useComposeContextMenu<T>` 提供受控的
  `open`、payload 与零尺寸虚拟锚点，供虚拟列表和委托事件在准确指针坐标打开。
- Hook 既接受 React/DOM 右键事件，也接受显式 `{ x, y }`。它会阻止原生菜单、记录可聚焦触发元素，
  并在 Base UI 关闭后恢复焦点；`rootProps` 是唯一把 Hook 状态传给 Root 的适配对象，避免领域包
  复制受控状态和碰撞定位逻辑。
- ContextMenu Content 通过 Portal 渲染，但自身应用 Compose Theme token 与 locale，保证脱离各包根
  节点后仍与 Editor 的 Dark/Light/宿主覆盖一致。Base UI 负责碰撞避让、Escape、外部按压、roving
  focus 和子菜单；菜单默认不阻断其余工作区交互。
- Scene Tree、Asset Browser 和 Property Panel 仍拥有各自的命令、选择和 capability 语义，只在
  右键事件完成领域状态同步后调用 Hook。Scene Tree 的 Ctrl/Meta 特例继续在调用 Hook 前退出。
- Property Panel 的三点 overflow 是普通点击菜单，不迁移；右键路径从其手写 `all` 模式拆出为共享
  ContextMenu。删除只被旧 ContextMenu 使用的 Portal 坐标、键盘循环、外部点击逻辑和专有样式。

## Dialog extension

- `ComposeDialog` 使用 Base UI Dialog 的 source primitive，公开 Root、Trigger、Portal、Backdrop、
  Viewport、Content、Header、Footer、Title、Description 与 Close 等 Compose 命名部件。Root 同时支持
  controlled 与 uncontrolled open；原始 Base UI 符号不成为公共 API。
- Portal 默认挂到 `document.body`，Backdrop 与 Viewport 固定覆盖浏览器 visual viewport。这里的“全屏”
  指遮罩和交互边界覆盖完整宿主窗口，内容仍按其自身 max-width/max-height 居中显示，不能被某个
  Dockview panel 的 overflow 或 z-index 裁剪。首版不暴露限定 Portal container 的公共 prop。
- Portal 内容与 ContextMenu 一样同步 `data-compose-theme`、`lang` 和 token style；Base UI 负责 modal
  focus trap、Escape、遮罩按压和焦点恢复。所有内建 Dialog 保持当前可访问名称、关闭语义和业务回调。
- `ComposeConfirmDialog` 继续使用 AlertDialog 以保留高风险确认的 `alertdialog` 语义，但共享同一全视口
  Portal 与 Compose token 视觉约定；它已经属于 components，不需要被领域包重新实现。
- Editor Settings 删除手写 backdrop/focus-loop，改由 ComposeDialog 处理；快捷键 capture 中 Escape 仍仅
  取消 capture，通过 Content 的 keydown 在 Dialog 收到关闭请求前拦截。打开时 Dockview 继续 inert，关闭后
  保留现有焦点恢复与布局实例。
- Asset Browser 的名称表单、删除确认、dirty 选择和 Monaco revision 冲突都由 ComposeDialog 或既有
  ComposeConfirmDialog 承载。Canvas settings、Property Panel variable binding picker 都是与 trigger 对齐的
  非模态 popover，不得为了复用而改为全屏 Dialog。
- `ComposeInput` 采用 Shadcn Input source 样式，并像 `ComposeButton` 一样在根节点应用 Theme token。
  Dialog 表单使用统一的 `Header → label/Input → Footer` 层级；Asset Browser 不再用领域 CSS 重写 Dialog
  的背景、边框、padding 或按钮。`ComposeButton` 的 primary/destructive 前景色按解析主题派生：Dark 的
  亮色 accent/danger 使用深色文字，Light 的深色 accent/danger 使用白色文字，以满足文字对比度。

## Asset document workspace extension

- `ComposeAssetBrowser` 只维护资源目录的选择、展开、目录网格与 Provider 操作。文件选择不再触发
  `read()`、Blob URL 或 Monaco 动态加载；文件双击和 Tree Enter 通过 `onAssetOpen(entry)` 把打开意图交给
  宿主，目录激活继续只改变当前目录。
- `ComposeAssetPreview` 是独立的预览 surface，保留资源读取取消、Blob URL 回收、SVG 安全预览、Monaco
  model/ResizeObserver 清理、保存与 revision 冲突。其 ref 的 `save()` 返回布尔结果，使 Editor 能在关闭或
  操作前确认保存是否真的成功；预览本身不拥有 Dockview 状态。
- 默认 Editor 以 `provider.id + assetKey（缺失时 entry.id）` 派生稳定资源 document panel ID。动态 panel
  加入已锁定的 Canvas Group，`renderer: 'always'` 确保切换标签不销毁 Monaco 草稿；重复打开仅激活既有
  panel。Canvas panel 没有关闭入口，资源 panel 使用专用关闭按钮。
- Editor 将每个资源文档的 entry、dirty 状态和 `save()` ref 保存在实例会话中。关闭、rename、move、delete
  通过同一串行决策器处理 dirty 文档：保存成功或放弃后才关闭并允许 Provider 操作；取消、保存失败或冲突则
  拒绝整次 Provider 操作。外部 Provider 删除不在可预拦截范围内，读取/保存错误仍由 preview 显示。
- 自定义 `slots.assetBrowser` 是完整宿主替换，不获得自动 Dockview 桥接。默认浏览器仍转发宿主的
  `onAssetOpen`/`onBeforeAssetMutation`，并在其许可后执行 Editor 的资源文档会话逻辑。
