## 1. 模型与偏好

- [x] 1.1 `ComposeEditorWorkspaceDefinition`（id / title / icon / description / layout（面板名 preset 或不透明快照，不给 builder 函数）/ session）、
      `COMPOSE_DEFAULT_WORKSPACES = [page]`（builder 就是今天的默认布局）、`workspaces` prop、
      重名抛错
- [x] 1.2 偏好 `workspace` 字段：`lastUsed`、`byDocument`、`layouts`、`custom`；规范化与默认值
      factory；缺席按默认补齐
- [x] 1.3 Vitest：重名抛错；规范化补齐；引用不存在工作区的条目保留不报错

## 2. 面板可拖与硬约束

- [x] 2.1 去掉 `locked: 'no-drop-target'` 与 `disableDnd`；浮动组与弹出窗口关闭
- [x] 2.2 画布面板标签无 ×、`removePanel` 拒绝；每种面板至多一个；时间线面板加入 / 移除走动画
      模式，不进快照
- [x] 2.3 组件测试：拖拽移动不重建画布（`skipDispose` 路径）

## 3. 快照与稳定宿主元素

- [x] 3.1 `toJSON` 在布局变化后记入 `layouts[id]`（防抖）；`fromJSON` 前校验版本号、面板 id、
      画布面板存在；失败丢快照回 builder
- [x] 3.2 三级回退：记忆 id 不在列表 → `lastUsed` → 第一个；快照失败 → builder；builder 也没有 →
      从列表删掉并提示
- [x] 3.3 稳定宿主元素：画布、场景图、属性面板各自渲染进一个长期存活的元素，Dockview 面板挂载时
      `appendChild`，卸载时不销毁
- [x] 3.4 StrictMode 组件测试：挂载→清理→再挂载后画布仍是同一个 React 实例；`fromJSON` 之后
      命令会话、选择集、视口原样
- [x] 3.5 Vitest：校验与回退三种失败；切换纯函数不产生 `EditorCommand`

## 4. 切换器、记忆与管理

- [x] 4.1 切换器（`radiogroup`，方向键按索引循环，hover / focus 提示会换的东西）与管理菜单 `▾`
      放进文档标签条右端、设置按钮之前
- [x] 4.2 切换：应用快照 + 会话开关（角度约束、增量角、网格可见、十字光标臂长、Gizmo）；记入
      `lastUsed` 与当前文档的 `byDocument`；动画模式开着时加回时间线面板并展开底部组
- [x] 4.3 按文档记忆：激活标签时应用该文档记着的工作区，没记过不切；新建文档继承当前；删掉
      「边缘面板按文档类型记忆」的 Hook
- [x] 4.4 修改点：面板挪位后段上出现，重置后消失；尺寸 / 折叠 / 活动标签记入但不点亮
- [x] 4.5 菜单：另存为工作区…（对话框：名字 + 列出复制的内容；重名自动加序号；创建即切换）、
      重命名、重置布局、删除（确认框写明记着它的文档数与回退去处）、只看画布
- [x] 4.6 内建与宿主注入的不可删、不可重命名：菜单项灰掉并标「内建」
- [x] 4.7 只看画布：`maximizeGroup(canvas)` / `exitMaximizedGroup`，按工作区记忆
- [x] 4.8 动作目录：`workspace.switch.<id>`、`workspace.next`、`workspace.previous`、
      `workspace.focusCanvas`、`workspace.saveAs`、`workspace.reset`；可在命令行键入；默认不绑键
- [x] 4.9 Testing Library：切换器 ARIA 与循环、提示文案、菜单灰项、另存为对话框、删除确认

## 5. 端到端

- [x] 5.1 把基础组件面板拖到右栏，切走再切回仍在右栏；重置后回到左栏；画布内容没有重挂载
- [x] 5.2 `LINE` 取到一个点之后切工作区，命令行提示仍是「指定下一点」，第二个点落地成一段；
      事务日志没有新行
- [x] 5.3 「另存为」之后切换器多一段、当前文档记忆指向它；删除后切到回退去处、记着它的文档不再指向它；内建的删除项灰掉（「受控偏好回传后重开还在」示例应用是非受控偏好，由 preferences 规范化的单元测试承担）
- [x] 5.4 A 页在自定义工作区、B 页在页面，A→B→A 之后布局跟着回来；从未打开过的 C 页激活时不切换
- [x] 5.5 画布面板标签没有 ×；只看画布后画布组占满、再次触发回来
- [x] 5.6 在自定义工作区里关掉网格显示，切到页面再切回，网格仍是关的

## 6. 文档与验证

- [x] 6.1 `README.md` 补工作区一节；`AGENTS.md` 当前阶段补「工作区不是模式、不绑定文档」两条判据
- [x] 6.2 `bun run lint`、`typecheck`、`test`、`build`、`test:e2e` 全绿
