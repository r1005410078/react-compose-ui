# @compose-ui/scene-tree

可独立嵌入 React 应用的受控场景树组件。它使用虚拟化行支持 5000 个节点，并提供选择、
展开、检索、重命名、删除、可见性、锁定、新增、复制、剪切、粘贴和拖拽操作意图。

拖拽使用组件内部 Pointer Events 实现：节点在拖动期间保持静止，单节点显示名称预览，
多节点显示实际移动数量。节点上下边缘的蓝色横线表示前后插入，节点主体整行高亮表示成为
其子项；横向移动指针可以调整横线目标层级，松手后才发出一次 `move` 操作意图。拖动已选
节点会按可见顺序移动选择集合；拖动未选节点会先请求单选该节点。

## 使用

```tsx
import { SceneTree } from '@compose-ui/scene-tree'
import '@compose-ui/scene-tree/styles.css'

<SceneTree
  nodes={nodes}
  selectedIds={selectedIds}
  expandedIds={expandedIds}
  onSelectionChange={(ids) => setSelectedIds([...ids])}
  onExpandedChange={(ids) => setExpandedIds([...ids])}
  onOperation={handleOperation}
/>
```

需要让外部工具栏与树的右键菜单共享命令状态时，可创建并传入同一个 controller：

```tsx
import { SceneTree, useSceneTreeCommands } from '@compose-ui/scene-tree'

const commands = useSceneTreeCommands({ nodes, selectedIds, onOperation })

<>
  <button onClick={() => commands.execute('copy')}>复制</button>
  <SceneTree
    commands={commands}
    nodes={nodes}
    selectedIds={selectedIds}
    expandedIds={expandedIds}
    onOperation={onOperation}
  />
</>
```

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

节点聚焦后，macOS 和 Linux 使用 Enter 开始重命名，Windows 使用 F2；双击仅执行普通
选择，不会进入重命名状态。编辑框内按 Enter 提交，按 Escape 取消。

`styles.css` 由禁用 Preflight 且带包前缀的 Tailwind CSS 构建，不会重置宿主全局样式。
