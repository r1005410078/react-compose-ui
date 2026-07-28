# @compose-ui/scene-tree

独立受控场景树。内建搜索、菜单、操作与 ARIA 统一消费 `@compose-ui/ui-context` 的主题和语言；
宿主节点 label、icon 和业务内容保持原文。

可独立嵌入 React 应用的受控场景树组件。它使用虚拟化行支持 5000 个节点，并提供选择、
展开、检索、重命名、删除、可见性、锁定、新增、复制、剪切、粘贴和拖拽操作意图。

拖拽使用组件内部 Pointer Events 实现：节点在拖动期间保持静止，单节点显示名称预览，
多节点显示实际移动数量。节点上下边缘的蓝色横线表示前后插入，节点主体整行高亮表示成为
其子项；横向移动指针可以调整横线目标层级，松手后才发出一次 `move` 操作意图。拖动已选
节点会按可见顺序移动选择集合；拖动未选节点会先请求单选该节点。

## 使用

```tsx
import { ComposeSceneTree } from '@compose-ui/scene-tree'
import '@compose-ui/scene-tree/styles.css'

<ComposeSceneTree
  nodes={nodes}
  selectedIds={selectedIds}
  expandedIds={expandedIds}
  onSelectionChange={(ids) => setSelectedIds([...ids])}
  onExpandedChange={(ids) => setExpandedIds([...ids])}
  onOperation={handleOperation}
/>
```

使用 `ComposeUIProvider` 设置 zh-CN/en-US，覆盖检索、菜单、错误和 ARIA 文案；宿主节点 label 不翻译。

需要让外部工具栏与树的右键菜单共享命令状态时，可创建并传入同一个 controller：

```tsx
import { ComposeSceneTree, useComposeSceneTreeCommands } from '@compose-ui/scene-tree'

const commands = useComposeSceneTreeCommands({ nodes, selectedIds, onOperation })

<>
  <button
    disabled={!commands.isEnabled('create-suggested')}
    onClick={() => commands.execute('create-suggested')}
  >
    新增节点
  </button>
  <button onClick={() => commands.execute('copy')}>复制</button>
  <ComposeSceneTree
    commands={commands}
    nodes={nodes}
    selectedIds={selectedIds}
    expandedIds={expandedIds}
    onOperation={onOperation}
  />
</>
```

## 从外部新增节点

`useComposeSceneTreeCommands` 可以驱动场景树之外的工具栏、菜单或快捷入口。新增命令只会通过
`onOperation` 发出 `{ type: 'create', parentId, index }`，宿主仍负责生成节点 ID、构造业务
数据并更新受控 `nodes`：

```tsx
import type { ComposeSceneTreeNode, ComposeSceneTreeOperation } from '@compose-ui/scene-tree'

const handleOperation = (operation: ComposeSceneTreeOperation) => {
  if (operation.type === 'create') {
    const node: ComposeSceneTreeNode = {
      id: crypto.randomUUID(),
      label: '新节点',
    }

    // insertNodeAt 是宿主自己的树更新函数；scene-tree 不持有文档数据。
    setNodes((current) => insertNodeAt(
      current,
      operation.parentId,
      operation.index,
      node,
    ))
    return
  }

  applyOtherOperation(operation)
}

const commands = useComposeSceneTreeCommands({
  nodes,
  selectedIds,
  onOperation: handleOperation,
})

<button
  disabled={!commands.isEnabled('create-suggested')}
  onClick={() => commands.execute('create-suggested')}
>
  新增节点
</button>
```

外部入口可以选择以下位置语义：

- `commands.execute('create-suggested')`：容器选中时追加为子节点；叶节点选中时插入为其后
  兄弟节点；没有选择时追加为根节点。
- `commands.execute('create-child', parentId)`：追加到指定父节点的子级末尾。
- `commands.execute('create-sibling', nodeId)`：插入到指定节点之后。
- `commands.execute('create-root', null)`：追加到根级末尾。

执行前应调用相同目标的 `commands.isEnabled(command, targetId)`。`targetId` 省略时使用
`selectedIds` 中最近选择的节点，显式传入 `null` 表示根级空白区。外部入口应把同一个
controller 传给 `ComposeSceneTree.commands`，从而与树内右键菜单共享选择解析和剪贴板状态。

宿主必须为组件提供确定的非零高度。组件不会修改、保存或撤销宿主数据，只通过
`onOperation` 发出 `create`、`rename`、`delete`、`move`、`duplicate`、
`set-visibility` 和 `set-locked` 操作意图。复制粘贴使用 `duplicate`，宿主负责深拷贝节点
并生成新 ID；剪切粘贴使用 `move`。剪贴板只存活于 Hook 实例，不访问系统剪贴板，也不会
持久化或跨页面共享。

检索框支持普通文本、大小写敏感、Unicode 全词和正则表达式匹配。正则无效时输入框会
标记错误且不会抛出异常。

顶部工具区采用 VS Code 式紧凑密度：32px 工具栏内使用无边框的 24px 新增按钮和检索框，
检索文字为 11px；大小写、
全词和正则模式启用后显示蓝色背景。节点使用 24px 虚拟间距和 22px 可见行高；拖拽命中区
同步采用 4px / 16px / 4px 三段布局。

节点行使用 VS Code Dark 式三态反馈，并以左右内缩 4px 的 5px 圆角胶囊呈现：悬停为
`#2a2d2e`，选中为低调的 `#37373d`，键盘聚焦为 `#062f4a` 并叠加 `#007fd4` 内描边。
键盘聚焦优先于悬停和选中状态。

Ctrl/Cmd 点击用于切换单个节点的选择状态，Shift 点击用于连续范围选择。节点右键菜单提供
新增子节点、兄弟节点、复制、剪切、粘贴和删除；空白区菜单提供根级新增与粘贴。聚焦树行后
可使用 Ctrl/Cmd+C、X、V 和 Delete，搜索与重命名输入框保留原生文本编辑快捷键。
菜单由 `@compose-ui/components` 的 `ComposeContextMenu` 呈现；本包仅保留选择同步、命令顺序和
可用性判断。菜单只在复制、剪切和删除末尾显示实际键位；粘贴菜单项不会标记 Ctrl/Cmd+V，因为
键盘执行的是建议粘贴，并不等价于某个指定父级或同级目标。

节点聚焦后，macOS 和 Linux 使用 Enter 开始重命名，Windows 使用 F2；双击仅执行普通
选择，不会进入重命名状态。编辑框内按 Enter 提交，按 Escape 取消。

`styles.css` 由禁用 Preflight 且带包前缀的 Tailwind CSS 构建，不会重置宿主全局样式。

## 内部测试分层

`ComposeSceneTree` 只负责受控数据、虚拟化和内部模块连线。选择、键盘、拖拽阈值、坐标命中、自动
滚动速度和 Portal 边界均为不依赖 DOM 的纯模型，使用表驱动 Vitest 直接验证输入与输出；
Pointer Capture、600ms 延迟展开、RAF 和焦点等副作用由内部 Hook 测试负责。Toolbar、节点
行、右键菜单和拖拽反馈作为展示组件验证 ARIA 与事件透传，完整 Pointer 和视觉流程继续由
Playwright 与版本控制中的黄金文件覆盖。这些内部模型、Hook 和展示组件不属于公共 API。
