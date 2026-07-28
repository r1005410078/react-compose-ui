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
- 新增 `ComposeInput`，作为 Dialog 与其他表单场景可复用的 Shadcn source-adapted 输入 Primitive；
  它和 `ComposeButton` 使用同一组主题派生前景色，保证 Dark/Light 下主要与破坏性操作均满足可读性。
- 将 Shadcn 的语义色映射到现有 Compose Theme token，保留 Dark/Light 与宿主 token override；不引入
  Shadcn 默认 `:root`/`.dark` 主题，也不向宿主注入 Preflight。
- 将后续共享 Primitive/Pattern 的默认实现约定写入 `AGENTS.md`、包 README 和架构检查：优先使用
  Shadcn source primitive；领域 Widget 继续留在各自领域包，原始 Shadcn 内部名称不作为公共 API。
- 为新增 Primitive 提供 Compose 命名的公共 API、共置测试和 Storybook Story；既有虚拟 `ComposeTree`
  不做无收益的机械替换。
- 新增 Shadcn/Base UI 源码适配的 `ComposeContextMenu` 与 `useComposeContextMenu`；将 Scene Tree、
  Asset Browser 和 Property Panel 中的全部右键菜单迁移到共享 Primitive，保留非右键的普通下拉菜单。
- 新增 Shadcn/Base UI 源码适配的 `ComposeDialog` 组合部件，提供全视口 Portal 遮罩、焦点管理和
  Compose Theme/I18n 继承；Dialog 内容保持可配置尺寸，遮罩不受 Dockview 面板的 overflow、stacking
  context 或尺寸限制。
- 将 Dockview 工作区中的 Settings，以及 Asset Browser 的新建/重命名、删除、未保存更改和 revision
  冲突弹框迁移到共享 Dialog。Canvas settings 与变量绑定 picker 继续是锚定式非模态 popover，不迁移。
- 将 Asset Browser 弹框内遗留的原生按钮和输入替换为 `ComposeButton`、`ComposeInput`，移除领域包的
  专用弹框颜色、尺寸和焦点样式，使其遵循 Shadcn 的紧凑表单、footer 与按钮层级。
- 将默认资源浏览器恢复为“目录树 + 当前目录网格”：单击文件仅选择，文件双击或键盘激活后在中央
  Canvas Group 打开可关闭、可复用的资源文档标签。图片、SVG、脚本和未知二进制的预览从浏览器
  面板迁移到该资源文档；Canvas 标签始终保留。
- 导出可独立组合的 `ComposeAssetPreview`，并让默认 Editor 为 dirty 资源文档的关闭、重命名、移动与
  删除接入既有共享 Dialog 决策；资源写入继续只通知 Provider/宿主审计，不进入 ComposeDocument。
- 扩展共享 `ComposeColorPicker` 与 Property Panel 的 `Color` 语义类型：除完全透明外，提供可访问的
  Alpha 滑条。用户编辑后规范化为小写 `#rrggbb`（100%）或 `#rrggbbaa`（其余透明度），并继续读取
  `transparent` 和现有 CSS 色值。

## Impact

- Affected specs: `components`、`scene-tree`、`asset-browser`、`property-panel`、
  `editor-workspace-layout`、`editor-preferences`。
- Affected packages: `@compose-ui/components`、`@compose-ui/scene-tree`、`@compose-ui/asset-browser`、
  `@compose-ui/property-panel`、`@compose-ui/materials`、`@compose-ui/editor`、私有 Storybook workspace；不改变 core、assets、
  stage-engine 或 ComposeDocument。
- New runtime dependencies are added only when selected Shadcn primitives require them; CLI and CSS build tooling
  remain development dependencies.
