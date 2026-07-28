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
