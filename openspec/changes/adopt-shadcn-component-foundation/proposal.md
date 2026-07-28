# Change: 在共享组件包采用 Shadcn 基础设施

## Why

`@compose-ui/components` 当前只有手写的 `ComposeTree`，后续新增通用控件会重复处理变体、可访问性、
焦点样式和 Tailwind 工具组合。需要在该共享包内建立 Shadcn 的源码型组件基线，使后续通用
Primitive 以一致、可维护且可审查的方式开发。

## What Changes

- 在 `@compose-ui/components` 初始化 Shadcn CLI 配置，使用包内 `components.json`、包内 import alias
  和受版本锁定的 CLI 开发依赖。
- 引入首个 `ComposeButton` 作为端到端基线；组件代码由 Shadcn registry 生成后由本仓库拥有，
  不把 `shadcn` 作为浏览器运行时 UI 库。
- 将 Shadcn 的语义色映射到现有 Compose Theme token，保留 Dark/Light 与宿主 token override；不引入
  Shadcn 默认 `:root`/`.dark` 主题，也不向宿主注入 Preflight。
- 将后续共享 Primitive/Pattern 的默认实现约定写入 `AGENTS.md`、包 README 和架构检查：优先使用
  Shadcn source primitive；领域 Widget 继续留在各自领域包，原始 Shadcn 内部名称不作为公共 API。
- 为新增 Primitive 提供 Compose 命名的公共 API、共置测试和 Storybook Story；既有虚拟 `ComposeTree`
  不做无收益的机械替换。
- 新增 Shadcn/Base UI 源码适配的 `ComposeContextMenu` 与 `useComposeContextMenu`；将 Scene Tree、
  Asset Browser 和 Property Panel 中的全部右键菜单迁移到共享 Primitive，保留非右键的普通下拉菜单。

## Impact

- Affected specs: `components`、`scene-tree`、`asset-browser`、`property-panel`。
- Affected packages: `@compose-ui/components`、`@compose-ui/scene-tree`、`@compose-ui/asset-browser`、
  `@compose-ui/property-panel`、私有 Storybook workspace；不改变 core、assets、stage-engine 或
  ComposeDocument。
- New runtime dependencies are added only when selected Shadcn primitives require them; CLI and CSS build tooling
  remain development dependencies.
