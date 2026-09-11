## 1. 树协议与内建文案

- [x] 1.1 `ComposeSceneTreeNode.canEnter`、`{ type: 'enter'; nodeId }` 操作意图
- [x] 1.2 `canExit` 与 `exit` 意图；共享 Tree 的 `renderLeading` 行首插槽
- [x] 1.3 zh-CN / en-US 文案：进入、进入组件、返回上一层

## 2. 行上的进入

- [x] 2.1 进入图标与返回图标
- [x] 2.2 `renderActions` 末位常驻进入按钮（仅 `canEnter` 行）
- [x] 2.3 行双击发出 `enter`（仅 `canEnter` 行，且不来自行内按钮）
- [x] 2.4 右键菜单首项 + 分隔线

## 3. 来路出口行

- [x] 3.1 `renderLeading` 挂返回控件；`data-scene-exit` 驱动头部态
- [x] 3.2 整行铺满、不内缩、不加圆角；展开控件与缩进让位
- [x] 3.3 检索栏的新增按钮移到检索框之后
- [x] 3.4 组件测试：`exit` 意图、头部标记、普通行不受影响

## 4. Editor 接线

- [x] 4.1 `sceneEntity` 为组件实例声明 `canEnter`
- [x] 4.2 `scene-operations` 补 `enter` 规划器（不产生文档命令）
- [x] 4.3 `useComponentEntry`：来路栈、`enter` → 解析引用 → 打开会话 → 压栈
- [x] 4.4 返回：回到来路、截断栈、待还原选区到位再应用并展开祖先
- [x] 4.5 当前文档切到栈外时丢弃来路；会话关闭时截断；有来路才标记根行

## 5. Inspector 入口

- [x] 5.1 `ComposeComponentInstanceOverridesPanel` 可选 `onOpen` 与「打开组件」按钮
- [x] 5.2 compose-editor 接到同一条进入路径

## 6. 进入层：不产生文档标签

- [x] 6.1 `useComponentEntry` 的栈段记下**进入前该会话是否已经存在**；`enter` 在压栈前
      先查目标是否已在栈中，在则截断到那一段而不是再压一层
- [x] 6.2 `WorkspaceDocumentTabs`：条目列表剔除栈中除栈底外的 panelId；层存续期间把**栈底**
      那条呈现为活动标签（当前文档 id 照旧指向层，只有条目与高亮改读来路）
- [x] 6.3 `exit` 弹出层后按「进入前已存在 或 有未保存修改」决定去留：成立则保留（回到标签条），
      否则关闭该会话；关闭走既有关闭路径但**不弹**确认对话框
- [x] 6.4 画布模式提示：层存续期间给文档表面一圈强调色描边，页面文档上不出现；
      提示不含文字、不占纵向空间。走覆盖伪元素——内嵌阴影画在子元素背景之下，露不出来
- [x] 6.5 组件测试：`useComponentEntry` 六项（干净返回即关闭、脏的返回升格、进入已开着的组件
      复用会话、回到栈中已有的一段、切到栈外丢弃来路、来路被关闭即截断）；
      `WorkspaceDocumentTabs` 两项（层不占标签条且高亮停在来路、没有层时照旧）

## 7. 顺带修掉的缺陷

- [x] 7.1 属性面板的列分隔线伸进了 chrome 带，把落在它那一列 x 上的工具带按钮整个挡住
      （新增「打开组件」按钮把 Apply 推到了那个位置上，`component-library.spec.ts:356` 因此超时）。
      分隔线的 `top` 按名义 `--pp-toolbar-height` 算，而 chrome 里还有一条状态条；
      修法是把 chrome 抬到分隔线之上（`z-index` 6 → 9）

## 8. 自评修掉的问题

- [x] 8.1 共享 Tree 的 `.compose-tree--dragging` 光标规则被 `.compose-tree__leading` 的插入
      改坏（选择器被截断，`cursor: grabbing` 落到了每一行上、且被后面的 `cursor: default`
      吃掉，拖拽期间不再变光标）——修回原样，`__leading` 单独成一条
- [x] 8.2 `useComponentEntry` 的返回值改为 memo：它每次渲染换一个新对象，宿主用它 memo
      场景树受控属性等于白写，整棵虚拟化的树跟着编辑器每一次渲染重渲
- [x] 8.3 连点两下进入按钮会发两次 `enter`，第二次把这一层记成「进入前就存在」，返回时留下
      一条谁也没要过的标签——加在途守卫。守卫必须读 **ref**：两次调用来自同一次渲染的同一个
      闭包，状态那一份还是旧值（第一版写成状态，用例当场红）
- [x] 8.4 `sceneEntity` 对每个实例解析了两遍实例事实（`instanceHasInnerChildren` 里一遍、
      `canEnter` 判据一遍）——改成解析一次两处共用
- [x] 8.5 来路出口行补亮色主题：那组硬编码深色比亮色主题的既有覆盖更具体，不补会在亮色面板上
      横一条深色头栏；行高从钉死的 24px 改成 100%，跟着虚拟行走
- [x] 8.6 `planEnter` 同时服务 `enter` 与 `exit`，改名 `planNavigationOnly`；`BackIcon` 的
      TSDoc 还停在被否掉的路径条上

## 9. 验证

- [x] 9.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 9.2 `e2e/scene-tree-component-entry.spec.ts`：进入 → 标签条条目数不变、树只剩组件节点、
      画布出现层提示 → 返回 → 原实例仍选中、标签条无新条目、组件会话已关闭 → 再次进入仍只有一份
- [x] 9.3 `bun run test:e2e` 全量：276 passed / 7 failed，7 条与 HEAD 上完全一致（`git stash` 核对过），
      全部属于刚落地的物料面板改动，与本变更无关
