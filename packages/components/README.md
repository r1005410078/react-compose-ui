# @compose-ui/components

跨 Compose UI 包复用的无业务 React 组件。共享 Primitive/Pattern 以包内 Shadcn CLI 生成的源码为
基础，但只公开 Compose 命名 API；Shadcn 不是消费者需要安装的运行时 UI 库。首个公共组件
`ComposeTree<T>` 提供受控选择/展开、多选、Shift 范围选择、键盘导航、Treegrid ARIA、5000+ 节点虚拟化、
祖先保留过滤和可选 Pointer 拖排。

```tsx
import { ComposeButton, ComposeInput } from '@compose-ui/components'
import '@compose-ui/components/styles.css'

<label>
  文件名
  <ComposeInput defaultValue="untitled.ts" />
</label>
<ComposeButton variant="destructive">删除</ComposeButton>
```

`ComposeButton` 与 `ComposeInput` 会直接跟随 `ComposeThemeProvider` 的 Dark/Light 与 token override。
样式仅输出带 `cu:` 前缀的 utility，并且不注入 Preflight 或 Shadcn 的默认全局主题。

`ComposeAnglePicker` 是无文档语义的受控角度编辑器：紧凑状态保留任意有限角度，
快捷弹层提供 0–359° 转盘、精确值与 0°/90°/180°/270° 预设。转盘拖动仅在
pointerup 提交一次，Escape 取消并恢复入口焦点。

```tsx
<ComposeAnglePicker value={rotation} onValueCommit={setRotation} />
```

`ComposeColorPicker` 是受控的纯色 Pattern，基于包内 Shadcn CLI 生成的 Base UI Popover 源码组合
色盘、色相/透明度滑条、透明色、Recent、Common 与可折叠的精确 HEX/Alpha 输入。选择会提交规范的
`#rrggbb`、`#rrggbbaa` 或 `transparent`；无法精确编辑的既有 CSS 色值仍会作为色块预览，直到用户主动修改。

```tsx
import { ComposeColorPicker } from '@compose-ui/components'

<ComposeColorPicker
  label="背景"
  value={backgroundColor}
  onValueChange={setBackgroundColor}
/>
```

需要结构化背景填充时使用 `ComposePaintPicker`。它在同一会话颜色历史中编辑纯色、Linear、Radial 与
Angular gradient；Solid 切换为渐变时会创建“当前颜色 → 透明”的两个色标。`I` 优先调用浏览器原生
`EyeDropper`，不可用时通过 `onEyedropperFallback` 让宿主进入画布图层取色。`ComposeColorHistoryProvider`
默认只保留当前 React 会话的 16 条 MRU，不会读写 localStorage 或任何文档状态。

Paint 类型、色标轨道与内嵌色盘共用一个紧凑 Popover；切换 Solid/Gradient 不会打开第二层颜色面板。

```tsx
import { ComposeColorHistoryProvider, ComposePaintPicker } from '@compose-ui/components'

<ComposeColorHistoryProvider>
  <ComposePaintPicker
    label="背景填充"
    value={backgroundPaint}
    onValueChange={setBackgroundPaint}
    onEyedropperFallback={startStagePaintSampling}
  />
</ComposeColorHistoryProvider>
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

`ComposeDialog` 是面向工作区模态流程的共享弹框。它的 Portal 固定挂到 `document.body`：遮罩与交互
边界覆盖完整浏览器窗口，因而不会被 Dockview 面板、Editor 根节点或任意 `overflow: hidden` 容器截断；
内容本身仍由 `max-width`/`max-height` 控制，并不会被强制全屏。不可逆确认继续使用
`ComposeConfirmDialog`，以保留 `alertdialog` 语义。

```tsx
import {
  ComposeDialog,
  ComposeDialogBackdrop,
  ComposeDialogClose,
  ComposeDialogContent,
  ComposeDialogFooter,
  ComposeDialogPortal,
  ComposeDialogTitle,
  ComposeDialogTrigger,
  ComposeDialogViewport,
} from '@compose-ui/components'

<ComposeDialog>
  <ComposeDialogTrigger>新建文件</ComposeDialogTrigger>
  <ComposeDialogPortal>
    <ComposeDialogBackdrop />
    <ComposeDialogViewport>
      <ComposeDialogContent>
        <ComposeDialogTitle>新建文件</ComposeDialogTitle>
        {/* 表单内容 */}
        <ComposeDialogFooter>
          <ComposeDialogClose>取消</ComposeDialogClose>
        </ComposeDialogFooter>
      </ComposeDialogContent>
    </ComposeDialogViewport>
  </ComposeDialogPortal>
</ComposeDialog>
```

需要在菜单项末尾显示已生效的键位时，使用 `formatComposeKeybindings()` 和已有的
`ComposeContextMenuShortcut`。格式化器按当前平台显示 macOS 符号键或其他平台的 `Ctrl+…`，多个
替代键位以 ` / ` 分隔；它不注册键盘监听器，也不赋予菜单项任何领域动作。

```tsx
import {
  ComposeContextMenuItem,
  ComposeContextMenuShortcut,
  formatComposeKeybindings,
} from '@compose-ui/components'

const shortcut = formatComposeKeybindings([{ code: 'KeyZ', primary: true }])

<ComposeContextMenuItem>
  撤销
  {shortcut ? <ComposeContextMenuShortcut>{shortcut}</ComposeContextMenuShortcut> : null}
</ComposeContextMenuItem>
```

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
