## 1. 树协议与菜单

- [x] 1.1 `ComposeSceneTreeAddMenuGroup` / `ComposeSceneTreeAddMenuItem` 与可选 `addMenu` prop
- [x] 1.2 `{ type: 'add'; itemId }` 操作意图
- [x] 1.3 工具栏 `+` 在 `addMenu` 非空时成为菜单触发器（`aria-haspopup` / `aria-expanded`），
      按按钮矩形左下角定位，关闭后焦点回到按钮
- [x] 1.3a 菜单封顶到 `min(60vh, var(--available-height, 60vh))` 并自己滚——货架实测 1884px，
      不封顶时整块菜单被顶到屏幕上沿；回退值必须给，那个变量首次测量时还不存在
- [x] 1.3b 菜单行首图标封到 16px：货架给的是不带尺寸的 SVG，不封时一个图标就把整块菜单撑成
      一张图。`stage` 的右键菜单有一条逐字相同的规则，重复是包边界造成的（`scene-tree` 不依赖
      `stage`，而 `components` 的菜单 Pattern 不带图标槽）
- [x] 1.4 `addMenu` 缺席或为空时行为不变（发 `create`）
- [x] 1.5 组件测试：弹出并选中发 `add`、空货架退回 `create`、键盘打开不落在屏幕左上角、
      关闭后焦点回到按钮

## 2. Editor 接线

- [x] 2.1 把既有 `addComponentMenu` 的分组交给场景树（同一份货架、同一套条目 id）
- [x] 2.2 `add` 意图路由到与点击物料面板瓦片相同的 `external.add`（不带 clientPoint）
- [x] 2.3 `scene-operations` 补 `add` 规划器（不产生文档命令，落点由交互控制器决定）

## 3. 验证

- [x] 2.4 添加后展开落进去的那个容器：被选中却藏在折叠父级里的行等于什么都没发生
- [x] 3.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 3.2 `e2e/scene-tree-add-menu.spec.ts`：菜单开在按钮附近而不是视口左上角、列出同一份货架、
      选中一项后新对象落进选中的容器且作为选中行可见
