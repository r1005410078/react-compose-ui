# 变更：把 Stage 键盘动作收敛成独立 Hook

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 5 的第二刀。上一刀搬走的是与
React 无关的纯函数；剩下的 2647 行里，`ComposeStageReady` 仍有约 2300 行，需要按**用户能力**
逐块切成 Hook。

`keyboardCommand` 是其中最大也最独立的一块：**308 行、一个调用点**（`onKeyDown`），承载
「用户用键盘操作舞台」这一条完整能力——临时平移、退出手势、工具切换、视口适配与缩放、吸附
开关、层级顺序、复制/编组/删除、方向键微调。

它现在是渲染函数里的一个闭包，依赖靠作用域捕获，读代码时无从判断它到底碰了哪些东西。搬进
Hook 之后依赖变成一份显式的参数契约。

## 变更内容

- 新增 `use-stage-keyboard.ts`：`useStageKeyboardCommands(params)` 返回 `onKeyDown` 处理器。
  参数对象即依赖清单，**不接受 `latestRef` 这类聚合可变引用**——那只会把作用域捕获换个位置藏。
- 新增 `nudge-planning.ts`：方向键微调的命令规划（约 70 行几何换算，原先内联在级联末尾）
  抽成纯函数 `planStageNudge`，附单测。它要处理 absolute/flow 定位、父级边框内缩与
  fill 尺寸三种情况，是这段级联里唯一有分支逻辑值得独立断言的部分。
- `compose-stage.tsx` 相应减去这两块。

## 抽出来才看见的一处死分支

微调换算原本有两条内缩分支：`absolute` 按自身 offset 反推父级内容盒原点，其余定位按父级
边框宽度算。**第二条不可达**——`positioning` 只有 `flow` 与 `absolute` 两个取值，而 `flow`
在上一步的 `movableIds` 过滤里已经被排除了。

写单测时才发现：为了覆盖那条分支，夹具必须伪造一个不存在的 `positioning` 值。这正是纯函数
抽取的附带收益——内联在 300 行级联中间时，没人会去核对这两个过滤条件的交集。删掉之后连带
去掉了父级查找与 `resolveComposeAppearance` 调用。

**级联顺序原样保留。** 分支次序本身是行为：`Escape` 的编辑态分支必须排在 `isEditableTarget`
守卫之前，宿主委派必须排在内建动作之前，`editableIds.length === 0` 的提前返回决定了后半段
是否可达。这一刀只搬位置，不重排、不合并、不改判定。

## 影响

- 受影响的规范：`stage`（适配层组织）
- 受影响的代码：`stage-surface/compose-stage.tsx`、新增 `use-stage-keyboard.ts` 与
  `nudge-planning.ts`
- 用户可见行为：无。既有 `compose-stage.test.tsx`、`shortcut-delegation.test.tsx` 与 e2e
  黄金图不改一行。
