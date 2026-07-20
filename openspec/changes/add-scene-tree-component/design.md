## 上下文

场景树需要独立发布、在编辑器中默认使用，并在完全展开的 5000 节点数据下保持可交互。
仓库尚未定义页面文档 Schema，因此树不能拥有业务数据或直接修改宿主状态。

## 目标/非目标

- 目标：稳定的 React 公共接口、受控状态、操作意图、虚拟化、检索、批量交互和可访问性。
- 目标：scene-tree 可独立消费，editor 默认集成且保持旧插槽兼容。
- 非目标：文档 Schema、ID 分配、系统剪贴板、撤销重做、持久化、异步子节点和跨树拖拽。

## 决策

- `@compose-ui/scene-tree` 不依赖 `core` 或 `editor`；React/ReactDOM 为 peer dependency。
- `nodes`、`selectedIds`、`expandedIds` 均由宿主控制；组件只发出选择、展开及操作意图。
- `useSceneTreeCommands` 只保存组件实例内的树剪贴板，并根据最新受控节点计算命令可用性；
  复制粘贴发出 `duplicate`，剪切粘贴发出 `move`，ID 分配和业务数据克隆仍由宿主负责。
- `SceneTree` 接受可选 command controller；省略时创建内部 controller，传入时菜单、快捷键
  和外部工具栏共享同一剪贴板状态。
- 使用迭代式索引与扁平化，固定 24px 行高，虚拟化 overscan 为 12；行背景左右内缩 4px，
  以 5px 圆角呈现 hover、选中和键盘焦点状态。
- 拖拽使用内部 Pointer Events 状态机；源节点保持静止，浮动预览跟随指针。单节点预览名称，
  多节点预览实际移动数量；前后插入显示落点横线，成为子项时高亮目标整行，Pointer Up 时
  才发出一次 `move` 操作意图。
- 横向指针位置按 16px 量化为目标深度；向右最多增加一级，向左可以提升到根层。
  折叠且可包含子项的有效目标稳定悬停 600ms 后请求展开。
- 搜索状态由组件内部持有。搜索仅匹配名称，保留祖先路径；清空时恢复原展开状态。
- `sceneGraphPanel` 是否为 `undefined` 决定是否覆盖默认树，因而显式 `null` 表示空面板。
- 两个包分别使用 Tailwind 前缀并禁用 Preflight。第三方 Dockview CSS、CSS 变量和伪元素
  规则保留在 Tailwind layer 中。
- editor 的 CSS 构建合并 scene-tree CSS；scene-tree 同时发布自己的 `styles.css`。

## 风险/权衡

- 虚拟化 DOM 不完整会影响树语义 → 每行显式计算 ARIA 层级、同级位置和集合大小。
- 自实现指针拖拽需要处理虚拟化和滚动 → 使用固定行高计算命中位置、Pointer Capture
  保持会话，并在视口上下边缘启动逐帧纵向自动滚动。
- 正则可能无效或代价高 → 捕获语法错误、显示零结果；仅对 5000 个短标签同步匹配。
- Tailwind 可能污染宿主 → 禁用 Preflight、限制扫描源并为每个包设置独立前缀。

## 迁移计划

1. 新增独立包及测试，不改变现有 editor 行为。
2. editor 增加依赖和 `sceneTreeProps`，再切换默认 Scene Graph 内容。
3. 示例应用移除临时树 JSX，改用受控场景树数据。
4. 更新文档、构建、E2E 和发布检查。

## 待解决问题

- 无。
