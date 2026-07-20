# 变更：新增独立场景树组件包

## 原因

编辑器左侧目前由示例 JSX 临时填充，既没有稳定的树组件协议，也无法在大量节点下保持可用。
需要提供可独立复用、可嵌入编辑器并能支撑 5000 个节点的场景树能力。

## 变更内容

- 新增 `@compose-ui/scene-tree` 公共包及独立样式入口，提供受控树状态与操作意图协议。
- 使用 `@tanstack/react-virtual` 虚拟化树行，并通过内部 Pointer Events 状态机实现
  VS Code 风格的静态节点、单项/多项拖拽预览、父级高亮、落点横线和层级调整。
- 提供展开、选择、重命名、删除、可见性、锁定、右键新增和检索交互。
- 提供公共 `useSceneTreeCommands` controller，统一右键菜单、键盘快捷键和外部工具栏的
  新增、删除、复制、剪切与树内粘贴操作意图。
- 检索栏包含一个新增按钮，以及大小写敏感、全词和正则表达式三个匹配开关。
- `@compose-ui/editor` 默认集成空场景树，并允许 `sceneTreeProps` 提供状态或由原
  `sceneGraphPanel` 插槽完整覆盖。
- editor 与 scene-tree 的自有样式使用无 Preflight、带包前缀的 Tailwind CSS 构建；
  editor 样式入口包含 scene-tree 样式。
- 示例应用接入真实场景树并提供确定性的 5000 节点 E2E 夹具。

## 影响

- 受影响规范：新增 `scene-tree`；修改 `editor-workspace-layout`
- 受影响代码：新增 `packages/scene-tree`，修改 `packages/editor`、`app`、根构建与发布配置
- 新增依赖：Tailwind CSS 4、`@tanstack/react-virtual`
- 兼容性：保留 `sceneGraphPanel`；未提供时由占位内容改为默认空场景树
