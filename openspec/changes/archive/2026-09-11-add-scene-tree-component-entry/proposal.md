# 变更：场景树从实例行进入组件

## 原因

场景树上的组件实例行只有一个入口——左边的展开三角，它展开的是**这一个实例**的内部层级，
在里面的编辑落成 `instanceOverrides`。想改**组件本身**（改一次、所有实例跟着变）只能绕到
组件库或资源浏览器里去找那份资源，而用户此刻正指着画面上的那个符号。

Unity 的 Hierarchy 上这两件事是一对：左边三角展开实例内部，右边箭头进入 Prefab 资源。
本变更补上右边那一半。

而进去之后**不该多出一份文件**。Unity 的 Prefab Mode 从头到尾没有开过第二个窗口或标签：
Hierarchy 顶部长出一栏写着当前 Prefab、一个返回箭头退回一步，打开第二个 Prefab 是替换第一个。
「进去看这个实例的定义」是当前画布的一次**导航**，而「打开一份组件文件来编辑」是另一件事，
后者才该是标签。把前者做成标签，用户得为一次顺手的下钻承担一条要自己关、还得记得存的标签。

底层机制已经全部就位——实例内部投影、复合地址、覆盖写回、组件文档独立 Runtime、活动文档
切换后整棵换树——缺的只有入口、返回路径，树协议里「这个节点能进去」这个词，以及把**呈现**
与**身份**分开：一份会话按 assetKey 唯一，但它可以呈现为一条标签，也可以呈现为压在某条标签
上的一层。

## 变更内容

- `@compose-ui/components`：共享 Tree 新增 `renderLeading` 行首插槽（`renderActions` 的镜像）。
- `@compose-ui/scene-tree`：新增 `ComposeSceneTreeNode.canEnter` / `canExit` 与
  `{ type: 'enter' | 'exit' }` 操作意图及内建文案。
- 实例行右侧新增常驻「进入」箭头；实例行双击、行右键菜单首项同为进入。
- 有来路时组件根行成为**来路出口**：行首朝左的返回控件 + 整行铺满的头部底色。返回是一步的事，
  因此不做多层导航条——那条常驻横带会把面板的常驻检索栏挤走。
- Editor：`enter` 意图解析实例引用，把该组件会话压成**当前文档之上的一层**——不新增文档标签，
  标签条继续把来路那条呈现为活动标签。维护会话级来路栈；返回弹出该层、还原来路选区并展开祖先。
- 一个 assetKey 至多一份会话：进入已经开着的组件复用那份会话，它在层存续期间不再同时占一条标签。
- 返回时被弹出的层按一条规则决定去留：**进入前就已存在，或有未保存修改**时升格为标签，否则关闭。
  未保存的修改必须在屏幕上有一个家，而弹一个保存确认是把选择推给一个只想返回的人。
- 画布在层存续期间给出一处**不依赖文字**的模式提示，使「我此刻改的不是页面」在场景树面板
  不可见时仍然读得出来。
- Inspector 实例头栏新增「打开组件」按钮（Unity 的 `Open`），与「创建变体」分开。

进的是实例**当前引用的那份资源**（引用变体就进变体，不追到根 Base），与「Apply 写回直接
父源」同一条判断。

## 影响

- 受影响规范：`components`、`scene-tree`、`editor-workspace-layout`
- 受影响代码：`packages/components/src/tree`、`packages/scene-tree`、
  `packages/editor/src/editor-controller/controller.tsx`、
  `packages/editor/src/editor-controller/scene-operations.ts`、
  `packages/editor/src/component-workspace/use-component-entry.ts`、
  `packages/editor/src/compose-editor/compose-editor.tsx`、
  `packages/editor/src/workspace-layout/workspace-chrome.tsx`、
  `packages/editor/src/workspace-layout/workspace-panels.tsx`、
  `packages/component-library/src/component-instance-overrides-panel`
- 非破坏性：新增字段与 props 全部可选，未声明 `canEnter` 的树观感与行为一个字节不变。
  组件文档从组件目录与资源目录打开的行为不变，仍是标签。
