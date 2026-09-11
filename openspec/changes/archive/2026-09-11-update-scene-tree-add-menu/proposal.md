# 变更：场景树的新增按钮改为弹出货架菜单

## 原因

场景树检索栏上的 `+` 今天只做一件事：**当场建一个容器**。用户想放的其余每一样——矩形、文字、
图片、项目里已经做好的那些组件——都够不着，得绕到物料面板去。而那颗按钮就坐在层级面板的顶上，
正是用户看着树、想在里面加点东西的那一刻手会落到的地方。

画布右键的「添加组件」菜单已经落地，它按当前货架列出**基础组件 / 项目组件 / 资源文件夹**。
场景树的 `+` 接同一份货架即可，不需要第二套弹层——两处入口列的是同一批东西，各写一份必然漂移。

## 变更内容

- `@compose-ui/scene-tree`：新增可选 `addMenu`（分组 + 条目，条目 id 对树不透明）与
  `{ type: 'add'; itemId }` 操作意图。`addMenu` 非空时 `+` 成为菜单触发器，选中一项发出一次
  `add`；缺席或为空时行为与今天**逐字相同**（发 `create`）。
- 菜单**不携带落点**：这颗按钮不指向树里的某一行，树因此不替宿主编造一个 `parentId`。
- Editor：把已有的 `addComponentMenu` 那一份货架同时交给场景树，`add` 走与**点击物料面板瓦片
  完全相同**的那条路（`external.add`，不带 clientPoint）——落点因此是「当前选区所在的容器」，
  与用户正指着的那一行一致。
- 容器不会因此丢失入口：它就是菜单里「基础组件」下的一项。

## 影响

- 受影响规范：`scene-tree`、`editor-workspace-layout`
- 受影响代码：`packages/scene-tree/src/index.tsx`、`packages/scene-tree/src/scene-tree-toolbar.tsx`、
  `packages/scene-tree/src/scene-tree/compose-scene-tree.tsx`、
  `packages/editor/src/compose-editor/compose-editor.tsx`
- 破坏性：无。`addMenu` 可选，未提供的宿主一个字节不变。
