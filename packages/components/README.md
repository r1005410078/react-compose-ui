# @compose-ui/components

跨 Compose UI 包复用的无业务 React 组件。共享 Primitive/Pattern 以包内 Shadcn CLI 生成的源码为
基础，但只公开 Compose 命名 API；Shadcn 不是消费者需要安装的运行时 UI 库。首个公共组件
`ComposeTree<T>` 提供受控选择/展开、多选、Shift 范围选择、键盘导航、Treegrid ARIA、5000+ 节点虚拟化、
祖先保留过滤和可选 Pointer 拖排。

```tsx
import { ComposeButton } from '@compose-ui/components'
import '@compose-ui/components/styles.css'

<ComposeButton variant="destructive">删除</ComposeButton>
```

`ComposeButton` 会直接跟随 `ComposeThemeProvider` 的 Dark/Light 与 token override。样式仅输出带
`cu:` 前缀的 utility，并且不注入 Preflight 或 Shadcn 的默认全局主题。

`ComposeColorPicker` 是受控的颜色 Pattern，基于包内 Shadcn CLI 生成的 Base UI Popover 源码组合色盘、
色相滑条和透明选项。触发器与弹层均不显示 HEX/RGB/HSL 文本；选择只会提交小写 `#rrggbb` 或
`transparent`。无法精确编辑的既有 CSS 色值仍会作为色块预览，直到用户主动修改。

```tsx
import { ComposeColorPicker } from '@compose-ui/components'

<ComposeColorPicker
  label="背景"
  value={backgroundColor}
  onValueChange={setBackgroundColor}
/>
```

`ComposeContextMenu` 是可同时服务声明式区域与虚拟列表委托事件的共享右键菜单。Portal 内容会自行
继承 Compose Theme/I18n token，因此不会因为脱离 Editor 根节点而丢失深浅主题或语言；它不拥有
场景命令、资源权限等领域语义。

```tsx
import {
  ComposeContextMenu,
  ComposeContextMenuContent,
  ComposeContextMenuItem,
  ComposeContextMenuTrigger,
  useComposeContextMenu,
} from '@compose-ui/components'

// 静态区域使用声明式 Trigger。
<ComposeContextMenu>
  <ComposeContextMenuTrigger>在此处右键</ComposeContextMenuTrigger>
  <ComposeContextMenuContent aria-label="节点操作">
    <ComposeContextMenuItem>重命名</ComposeContextMenuItem>
    <ComposeContextMenuItem variant="destructive">删除</ComposeContextMenuItem>
  </ComposeContextMenuContent>
</ComposeContextMenu>

// 虚拟化列表或事件委托路径在领域选择同步后精确打开。
const menu = useComposeContextMenu<string>()
<div onContextMenu={(event) => menu.openAt(event, assetId)} />
<ComposeContextMenu {...menu.rootProps}>...</ComposeContextMenu>
```

Hook 的 `openAt()` 会阻止浏览器原生菜单、保存关闭后的焦点目标并返回 `open`、`payload` 与
`anchorPoint`。`ComposeContextMenuContent` 使用固定虚拟锚点和非模态的 Base UI Menu 后端处理视口
避让、Escape、外部按压、roving focus 与子菜单。

```tsx
import { ComposeTree } from '@compose-ui/components'
import '@compose-ui/components/styles.css'

<ComposeTree
  items={items}
  adapter={{
    getId: (item) => item.id,
    getLabel: (item) => item.name,
    getChildren: (item) => item.children,
  }}
  selectedIds={selectedIds}
  expandedIds={expandedIds}
  onSelectionChange={setSelectedIds}
  onExpandedChange={setExpandedIds}
/>
```

本包不包含场景可见性/锁定、资源 Provider、文档命令或持久化。

## 添加共享 Primitive

在仓库根目录使用包内锁定的 CLI：

```bash
bun run --cwd packages/components shadcn add <component>
```

将生成源码迁入对应 Feature-first 目录后，改为 `Compose*` 公共命名并通过根入口导出；为它添加
共置测试、Story 和 TSDoc。若 Shadcn 无法满足所需交互或领域语义，保留领域包实现并记录原因。
